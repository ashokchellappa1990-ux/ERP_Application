import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";
import { collectQrCodes, validateQrCodes, markQrCodesSold } from "@/lib/sales/qrCodes";
import { postSaleLineMovements } from "@/lib/sales/postSaleLine";
import { nextInvoiceNumber } from "@/lib/sales/invoiceNumber";
import { postSalesJournal } from "@/lib/accounting/post";
import { recordBankMovement } from "@/lib/finance/bank";
import { DEFAULT_SALES_CONFIG } from "@/lib/settings/salesConfigDefaults";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn, terminalListWhere } from "@/lib/pos/terminalGuard";
import { B2bInvoiceCreateSchema, type B2bInvoiceRow, type B2bInvoiceListStats } from "@/lib/contracts/sale";
import { createInlineSettlement } from "@/lib/advance/engine";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
const PERM = "sales.invoice";

// GET /api/sales/invoice — list B2B tax invoices + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "All").trim();

  const tw = await terminalListWhere(user, url.searchParams.get("terminalId"));
  const where: Prisma.SaleWhereInput = { tenantId: user.tenantId, channel: "B2B", ...tw };
  if (status !== "All") where.paymentStatus = status;
  if (q) where.OR = [{ invoiceNo: { contains: q } }, { customerName: { contains: q } }, { customerGstin: { contains: q } }];

  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [rows, count, mtd, unpaid] = await Promise.all([
    prisma.sale.findMany({ where, orderBy: { id: "desc" }, take: 200 }),
    prisma.sale.count({ where: { tenantId: user.tenantId, channel: "B2B" } }),
    prisma.sale.aggregate({ where: { tenantId: user.tenantId, channel: "B2B", saleDate: { startsWith: month } }, _sum: { total: true } }),
    prisma.sale.aggregate({ where: { tenantId: user.tenantId, channel: "B2B", paymentStatus: { in: ["Credit", "Partial"] } }, _sum: { total: true, amountPaid: true } }),
  ]);

  const shaped: B2bInvoiceRow[] = rows.map((s) => ({
    id: s.id, invoiceNo: s.invoiceNo, saleDate: s.saleDate, dueDate: s.dueDate ?? "",
    customerName: s.customerName ?? "", customerGstin: s.customerGstin ?? "",
    total: num(s.total), amountPaid: num(s.amountPaid), paymentStatus: s.paymentStatus, status: s.status, itemCount: s.itemCount,
  }));
  const stats: B2bInvoiceListStats = {
    invoices: count,
    mtdValue: num(mtd._sum.total),
    outstanding: r2(num(unpaid._sum.total) - num(unpaid._sum.amountPaid)),
  };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/sales/invoice — create a B2B tax invoice (channel B2B).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Sale" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = B2bInvoiceCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const rawLines = (body.lines ?? []).filter((l) => Number(l.productId) > 0 && Number(l.qty) > 0);
  if (!rawLines.length) return NextResponse.json({ ok: false, message: "Add at least one line item." }, { status: 422 });

  // --- Honour the Sales Settings (B2B) + POS tax configuration ---------------
  const settingSc = await settingScope(user);
  const [salesRow, posRow] = await Promise.all([
    resolveScoped((where) => prisma.salesSetting.findFirst({ where }), settingSc),
    resolveScoped((where) => prisma.posSetting.findFirst({ where }), settingSc),
  ]);
  const flags = { ...DEFAULT_SALES_CONFIG.flags, ...((salesRow?.config as { flags?: Record<string, boolean> } | null)?.flags ?? {}) };
  const taxIncl = ((posRow?.config as { taxMethod?: string } | null)?.taxMethod ?? "inclusive") !== "exclusive";

  const customerId = body.customerId && Number(body.customerId) > 0 ? Number(body.customerId) : null;
  if (flags.custMasterMandatory && !customerId) {
    return NextResponse.json({ ok: false, message: "A registered business customer is required (Sales Settings → B2B)." }, { status: 422 });
  }
  const customer = customerId ? await prisma.customer.findFirst({ where: { id: customerId, tenantId: user.tenantId } }) : null;
  if (customerId && !customer) return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 422 });
  if (flags.gstMandatoryB2b && !(customer?.gstin && customer.gstin.trim())) {
    return NextResponse.json({ ok: false, message: "Customer GSTIN is mandatory for a B2B invoice (Sales Settings → B2B)." }, { status: 422 });
  }

  const productIds = Array.from(new Set(rawLines.map((l) => Number(l.productId))));
  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId }, select: { id: true, invExpiry: true, valuation: true } });
  if (prods.length !== productIds.length) return NextResponse.json({ ok: false, message: "One or more items are not in your catalog." }, { status: 422 });
  // FEFO consumption when the product's valuation is FEFO (or it's expiry-tracked).
  const fefoSet = new Set(prods.filter((p) => p.valuation === "fefo" || (!p.valuation && p.invExpiry)).map((p) => p.id));

  const interState = !!body.interState;
  const saleDate = (body.saleDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const warehouse = body.warehouse || "Main Store";

  // --- Per-line taxable / tax (inclusive vs exclusive per config) -----------
  let subtotal = 0, itemDiscount = 0, taxableValue = 0, taxTotal = 0, itemCount = 0;
  const lines = rawLines.map((l) => {
    const qty = Number(l.qty) || 0;
    const rate = num(l.rate);
    const gst = num(l.taxPct);
    const gross = qty * rate;
    const discType = l.discType === "val" ? "val" : "pct";
    const discInput = num(l.disc);
    const discAmount = discType === "val" ? Math.min(r2(discInput), gross) : r2(gross * (discInput / 100));
    const discPct = discType === "pct" && discInput > 0 ? discInput : null;
    const net = gross - discAmount;
    const taxable = gst > 0 ? (taxIncl ? r2(net / (1 + gst / 100)) : net) : net;
    const tax = gst > 0 ? (taxIncl ? r2(net - taxable) : r2(net * (gst / 100))) : 0;
    const lineValue = taxIncl ? net : r2(net + tax);
    subtotal += gross; itemDiscount += discAmount; taxableValue += taxable; taxTotal += tax; itemCount += qty;
    return {
      productId: Number(l.productId), productName: String(l.productName ?? ""), sku: l.sku || null, hsn: l.hsn || null, uom: l.uom || null,
      qty, mrp: l.mrp != null && l.mrp !== "" ? num(l.mrp) : null, rate, discPct, discAmount, taxPct: gst || null, taxableValue: taxable, taxAmount: tax, value: lineValue,
      batchNo: l.batchNo || null, mfgDate: l.mfgDate || null, expiryDate: l.expiryDate || null,
    };
  });
  // Scanned QR codes per line (same order as `lines`) — stored one-row-per-code.
  const lineCodes: string[][] = rawLines.map((l) => [...new Set((Array.isArray(l.qrCodes) ? l.qrCodes : []).map((c) => String(c).trim()).filter(Boolean))]);
  // Single-use QR control: a scanned "unique" code can be sold only once.
  const scannedCodes = collectQrCodes(rawLines);
  const qrErr = await validateQrCodes(prisma, user.tenantId, scannedCodes, warehouse);
  if (qrErr) return NextResponse.json({ ok: false, message: qrErr }, { status: 422 });

  const netOfItem = r2(subtotal - itemDiscount);
  const billInput = num(body.billDiscount);
  const billDiscount = body.billDiscType === "val" ? Math.min(r2(billInput), netOfItem) : r2(netOfItem * (billInput / 100));
  const preRound = r2(netOfItem - billDiscount + (taxIncl ? 0 : taxTotal));
  const goodsValue = Math.round(preRound); // taxable + GST (+ round off)
  const roundOff = r2(goodsValue - preRound);
  // Inter-state → IGST; intra-state → CGST + SGST.
  const igst = interState ? r2(taxTotal) : 0;
  const cgst = interState ? 0 : r2(taxTotal / 2);
  const sgst = interState ? 0 : r2(taxTotal - cgst);

  // TDS (deducted by buyer) / TCS (added to the invoice), as amounts. Clamp sane.
  const tcsAmount = Math.max(0, r2(num(body.tcsAmount)));
  const tdsAmount = Math.max(0, Math.min(r2(num(body.tdsAmount)), goodsValue));
  const total = r2(goodsValue + tcsAmount); // invoice total customer is billed
  const payable = r2(total - tdsAmount); // cash the customer actually pays

  const payments = (body.payments ?? []).filter((p) => Number(p.amount) > 0).map((p) => ({ mode: String(p.mode || "Bank Transfer"), amount: r2(num(p.amount)), reference: p.reference || null }));
  const amountPaid = r2(payments.reduce((s, p) => s + p.amount, 0));

  // Customer advances applied to this invoice (Advance Management integration) —
  // they reduce the receivable like a payment. Validated against the customer.
  const adjInput = (body.advanceAdjustments ?? []).filter((a) => Number(a.advanceId) > 0 && Number(a.amount) > 0);
  let advanceTotal = 0;
  if (adjInput.length) {
    if (!customerId) return NextResponse.json({ ok: false, message: "Select the customer to adjust their advances." }, { status: 422 });
    const advs = await prisma.advance.findMany({ where: { id: { in: adjInput.map((a) => Number(a.advanceId)) }, tenantId: user.tenantId, partyType: "Customer", partyId: customerId, status: { in: ["Collected", "Partially Settled"] } } });
    const byId = new Map(advs.map((a) => [a.id, a]));
    for (const a of adjInput) { const adv = byId.get(Number(a.advanceId)); if (!adv) return NextResponse.json({ ok: false, message: "An advance is not available for this customer." }, { status: 422 }); if (r2(num(a.amount)) > num(adv.balanceAmount) + 0.01) return NextResponse.json({ ok: false, message: `Advance ${adv.advanceNo} adjustment exceeds its balance.` }, { status: 422 }); advanceTotal = r2(advanceTotal + r2(num(a.amount))); }
    if (advanceTotal > payable + 0.01) return NextResponse.json({ ok: false, message: "Advance adjustment exceeds the invoice payable." }, { status: 422 });
  }
  const effectivePaid = r2(amountPaid + advanceTotal);
  const paymentStatus = effectivePaid >= payable && payable > 0 ? "Paid" : effectivePaid > 0 ? "Partial" : "Credit";
  const paymentMode = payments.length === 0 && advanceTotal === 0 ? "Credit" : advanceTotal > 0 && payments.length === 0 ? "Advance" : payments.length === 1 ? payments[0].mode : "Split";

  const seg = scopeData(await getActiveScope(user), { branch: true });
  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { feature: "allowB2b", label: "B2B invoice" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          tenantId: user.tenantId, ...seg, invoiceNo: "TMP", saleDate, channel: "B2B", status: "Completed", warehouse,
          customerId, customerName: customer?.name ?? null, customerPhone: customer?.phone ?? null, customerGstin: customer?.gstin ?? null,
          dueDate: body.dueDate || null, paymentTerms: body.paymentTerms || null, soNumber: body.soNumber || null, termsConditions: body.termsConditions || null,
          subtotal: r2(subtotal), itemDiscount: r2(itemDiscount), billDiscount, taxableValue: r2(taxableValue),
          cgst, sgst, igst, taxTotal: r2(taxTotal), tdsAmount, tcsAmount, roundOff, total,
          amountPaid: effectivePaid, changeDue: 0, paymentMode, paymentStatus, notes: body.notes || null,
          itemCount: Math.round(itemCount), bankId: body.bankId ?? null, bankName: body.bankName || null, bankAccount: body.bankAccount || null, createdBy: user.id, ...stamp,
          lines: { create: lines }, payments: { create: payments.map((p) => ({ ...p, ...seg })) },
        },
        include: { lines: true },
      });
      const invoiceNo = await nextInvoiceNumber(tx, user.tenantId, "b2b", { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
      await tx.sale.update({ where: { id: sale.id }, data: { invoiceNo } });

      // One ledger row + sale_line_qrs record per scanned QR code (mirrors GRN) +
      // a remainder row. sale.lines zipped with lineCodes by creation order (id asc).
      const orderedLines = [...sale.lines].sort((a, b) => a.id - b.id);
      const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, warehouse, saleId: sale.id, invoiceNo, saleDate, createdBy: user.id };
      let totalCost = 0;
      for (let i = 0; i < orderedLines.length; i++) {
        const line = orderedLines[i];
        const res = await postSaleLineMovements(tx, ctx, { id: line.id, productId: line.productId, qty: line.qty, rate: line.rate, batchNo: line.batchNo }, lineCodes[i] ?? [], { fefo: fefoSet.has(line.productId) });
        await tx.saleLine.update({ where: { id: line.id }, data: { cost: res.cost, batchNo: res.batchNo, mfgDate: res.mfgDate, expiryDate: res.expiryDate } });
        totalCost += res.cost;
      }
      // Mark every scanned unique QR / serial code as Sold (with customer + warranty).
      await markQrCodesSold(tx, user.tenantId, scannedCodes, sale.id, { invoiceNo, customerId, customerName: customer?.name ?? null, saleDate });
      await tx.sale.update({ where: { id: sale.id }, data: { cost: r2(totalCost) } });

      // Accounting voucher (Dr Cash/Bank/Receivable + COGS, Cr Sales + Output GST + Inventory).
      const cashAmount = r2(payments.filter((p) => p.mode.toLowerCase().includes("cash")).reduce((s, p) => s + p.amount, 0));
      const bankAmount = r2(amountPaid - cashAmount);
      const salesJid = await postSalesJournal(tx, {
        tenantId: user.tenantId, ...seg, saleId: sale.id, invoiceNo, date: saleDate, customerName: customer?.name ?? "Customer",
        taxableValue: r2(taxableValue), taxTotal: r2(taxTotal), roundOff, total, amountPaid, cost: r2(totalCost),
        cashAmount, bankAmount, tds: tdsAmount, tcs: tcsAmount, createdBy: user.id,
        advanceAdjusted: advanceTotal, advanceAccountCode: "2150",
      });
      // Advance Management: record a settlement per applied advance (GL already in the
      // sales voucher above via the advance debit line — no separate journal).
      for (const a of adjInput) await createInlineSettlement(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, advanceId: Number(a.advanceId), amount: r2(num(a.amount)), refDocType: "Sales Invoice", refDocId: sale.id, refInvoice: invoiceNo, journalId: salesJid, createdBy: user.id, createdByName: user.fullName ?? null });
      if (bankAmount > 0 && body.bankId) await recordBankMovement(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName }, { bankId: body.bankId, bankName: body.bankName, bankAccount: body.bankAccount, date: saleDate, direction: "in", amount: bankAmount, mode: paymentMode, reference: invoiceNo, sourceType: "Sale", sourceId: sale.id, sourceNo: invoiceNo, partyName: customer?.name ?? null, journalId: typeof salesJid === "number" ? salesJid : null, narration: `B2B Invoice ${invoiceNo}` });

      // Persist uploaded document attachments.
      const atts = (body.attachments ?? []).filter((a) => a.fileUrl && a.fileName);
      if (atts.length) {
        await tx.saleAttachment.createMany({
          data: atts.slice(0, 10).map((a) => ({ tenantId: user.tenantId, saleId: sale.id, fileName: String(a.fileName).slice(0, 200), fileUrl: String(a.fileUrl).slice(0, 400), fileType: a.fileType ?? null, size: Number(a.size) || 0 })),
        });
      }

      if (customerId) await tx.customer.update({ where: { id: customerId }, data: { totalSpent: { increment: total } } });
      return { id: sale.id, invoiceNo };
    });
    await writeAudit(prisma, user, {
      action: "sale.invoice.create", entity: "Sale", entityId: result.id,
      summary: `B2B invoice ${result.invoiceNo} — ${total.toFixed(2)} (${paymentStatus})`,
      meta: { invoiceNo: result.invoiceNo, total, amountPaid, paymentStatus, customerId, customerName: customer?.name ?? null },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "B2B invoice created.", id: result.id, invoiceNo: result.invoiceNo }, { status: 201 });
  } catch (err) {
    console.error("[sales/invoice] create error", err);
    return NextResponse.json({ ok: false, message: "Could not create the invoice." }, { status: 500 });
  }
}
