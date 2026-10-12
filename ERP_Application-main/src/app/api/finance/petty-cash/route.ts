import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { postJournal } from "@/lib/accounting/post";
import { recordBankMovement } from "@/lib/finance/bank";
import { createInlineSettlement } from "@/lib/advance/engine";
import { ACC, ensureAccounts } from "@/lib/accounting/accounts";
import { buildVoucherNo } from "@/lib/finance/pettyCashVoucherNo";
import { checkBudget } from "@/lib/finance/budgetService";
import { getActiveScope, scopeData, scopeWhere } from "@/lib/auth/scope";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn, terminalListWhere } from "@/lib/pos/terminalGuard";
import { PettyCashCreateSchema, type PettyCashRow, type PettyCashStats } from "@/lib/contracts/finance";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
const PERM = "finance.petty-cash";

interface LineIn { headId?: number; headName?: string; description?: string; hsn?: string; gstPct?: number | string; taxable?: number | string; amount?: number | string }

// GET /api/finance/petty-cash — list petty-cash vouchers + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  // Scope the list to the active business + selected branches (topbar selector).
  const seg = scopeWhere(await getActiveScope(user), { branch: true });
  const tw = await terminalListWhere(user, url.searchParams.get("terminalId"));
  const where: Prisma.PettyCashVoucherWhereInput = { ...seg, ...tw };
  if (q) where.OR = [{ voucherNo: { contains: q } }, { payeeName: { contains: q } }, { notes: { contains: q } }];

  const month = new Date().toISOString().slice(0, 7);
  const [rows, count, monthAgg] = await Promise.all([
    prisma.pettyCashVoucher.findMany({ where, orderBy: { id: "desc" }, take: 200, include: { _count: { select: { lines: true } } } }),
    prisma.pettyCashVoucher.count({ where: seg }),
    prisma.pettyCashVoucher.aggregate({ where: { ...seg, voucherDate: { startsWith: month } }, _sum: { totalAmount: true } }),
  ]);

  const shaped: PettyCashRow[] = rows.map((v) => ({
    id: v.id, voucherNo: v.voucherNo, voucherDate: v.voucherDate, payeeType: v.payeeType, payeeName: v.payeeName ?? "",
    totalAmount: num(v.totalAmount), headCount: v._count.lines, status: v.status,
  }));
  const stats: PettyCashStats = { vouchers: count, thisMonth: num(monthAgg._sum.totalAmount) };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/finance/petty-cash — create a petty-cash voucher (multi-head + split
// payment), generate the voucher number from config, and post the journal.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "PettyCashVoucher" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = PettyCashCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const gst = !!body.gstApplicable;
  // GST mode: each line carries HSN/SAC, GST% and a taxable amount → gross = taxable + tax.
  const lines = (body.lines ?? []).map((l: LineIn) => {
    if (gst) {
      const taxable = r2(num(l.taxable)); const gstPct = num(l.gstPct);
      const taxAmount = r2(taxable * (gstPct / 100));
      return { headId: l.headId ? Number(l.headId) : null, headName: l.headName || null, description: l.description || null, hsn: l.hsn || null, gstPct: gstPct || null, taxable, taxAmount, amount: r2(taxable + taxAmount) };
    }
    return { headId: l.headId ? Number(l.headId) : null, headName: l.headName || null, description: l.description || null, hsn: null, gstPct: null, taxable: null, taxAmount: null, amount: r2(num(l.amount)) };
  }).filter((l) => l.amount > 0);
  if (!lines.length) return NextResponse.json({ ok: false, message: "Add at least one expense head with an amount." }, { status: 422 });

  const payLines = (body.payments ?? []).filter((p) => num(p.amount) > 0).map((p) => ({ mode: String(p.mode || "Cash"), amount: r2(num(p.amount)), reference: p.reference || null }));

  const taxableTotal = r2(lines.reduce((s, l) => s + (l.taxable ?? 0), 0));
  const taxTotal = r2(lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0));
  const total = r2(lines.reduce((s, l) => s + l.amount, 0)); // gross (taxable + GST)
  const cgst = r2(taxTotal / 2); const sgst = r2(taxTotal - cgst);

  // Resolve each expense head to its mapped GL account (Petty Cash Config → head
  // "Accounts Head Mapping") so the expense debit posts to the correct ledger.
  // Unmapped heads (and header-less lines) fall back to Indirect Expenses.
  const headIds = [...new Set(lines.map((l) => l.headId).filter((x): x is number => !!x))];
  const headAccts = headIds.length
    ? await prisma.expenseHead.findMany({ where: { id: { in: headIds }, tenantId: user.tenantId }, select: { id: true, accountId: true } })
    : [];
  const acctIds = [...new Set(headAccts.map((h) => h.accountId).filter((x): x is number => !!x))];
  const acctCodeById = new Map(
    (acctIds.length ? await prisma.ledgerAccount.findMany({ where: { id: { in: acctIds }, tenantId: user.tenantId }, select: { id: true, code: true } }) : []).map((a) => [a.id, a.code]),
  );
  const headCode = new Map(headAccts.map((h) => [h.id, (h.accountId && acctCodeById.get(h.accountId)) || ACC.INDIRECT_EXPENSE]));
  const expenseByCode: Record<string, number> = {};
  for (const l of lines) {
    const code = (l.headId && headCode.get(l.headId)) || ACC.INDIRECT_EXPENSE;
    const val = gst ? (l.taxable ?? 0) : l.amount; // expense value net of GST
    expenseByCode[code] = r2((expenseByCode[code] ?? 0) + val);
  }

  // Business Expense — GST + TDS (deducted by us) + TCS (charged by supplier) and the
  // Accounts-Payable vs Pay-Now posting decision. Petty Expense ignores all of this.
  const isBusiness = String(body.expenseType) === "business";
  const postingType = isBusiness ? (String(body.postingType) === "paynow" ? "paynow" : "ap") : null;
  if (isBusiness && !body.payeeId) return NextResponse.json({ ok: false, message: "Select a supplier/vendor for a business expense." }, { status: 422 });
  const tdsBase = gst ? taxableTotal : total;                  // TDS on the value excl GST
  const tdsRate = isBusiness ? Math.max(0, num(body.tdsRate)) : 0;
  const tcsRate = isBusiness ? Math.max(0, num(body.tcsRate)) : 0;
  const tdsAmount = r2(tdsBase * tdsRate / 100);
  const tcsAmount = r2(total * tcsRate / 100);
  const netPayable = isBusiness ? r2(total + tcsAmount - tdsAmount) : total;

  // Advance Management: apply the payee's open (paid) advances against this expense —
  // Cr the advance asset (consumes it), reducing the cash/bank/payable owed now.
  const adjInput = (body.advanceAdjustments ?? []).filter((a) => Number(a.advanceId) > 0 && Number(a.amount) > 0);
  let advanceTotal = 0;
  const advanceLines: { code: string; credit: number; narration: string }[] = [];
  const advAdjustments: { advanceId: number; amount: number }[] = [];
  if (adjInput.length) {
    if (!body.payeeId) return NextResponse.json({ ok: false, message: "Select the payee to adjust their advances." }, { status: 422 });
    const partyTypes = String(body.payeeType) === "Employee" ? ["Employee"] : ["Supplier", "Vendor", "Contractor"];
    const advs = await prisma.advance.findMany({ where: { id: { in: adjInput.map((a) => Number(a.advanceId)) }, tenantId: user.tenantId, direction: "paid", partyType: { in: partyTypes }, partyId: Number(body.payeeId), status: { in: ["Paid", "Partially Settled"] } } });
    const byId = new Map(advs.map((a) => [a.id, a]));
    for (const a of adjInput) { const adv = byId.get(Number(a.advanceId)); if (!adv) return NextResponse.json({ ok: false, message: "An advance is not available for this payee." }, { status: 422 }); const amt = r2(num(a.amount)); if (amt > num(adv.balanceAmount) + 0.01) return NextResponse.json({ ok: false, message: `Advance ${adv.advanceNo} exceeds its balance.` }, { status: 422 }); advanceLines.push({ code: adv.accountCode || "1160", credit: amt, narration: "Advance adjusted" }); advAdjustments.push({ advanceId: adv.id, amount: amt }); advanceTotal = r2(advanceTotal + amt); }
    if (advanceTotal > r2(isBusiness ? netPayable : total) + 0.01) return NextResponse.json({ ok: false, message: "Advance exceeds the amount payable." }, { status: 422 });
  }

  const tendered = r2(payLines.reduce((s, p) => s + p.amount, 0));
  if (isBusiness && postingType === "ap") {
    // Post to Accounts Payable — no payment now; an outstanding payable is created.
  } else {
    const due = r2((isBusiness ? netPayable : total) - advanceTotal);
    if (due > 0.005 && !payLines.length) return NextResponse.json({ ok: false, message: "Add at least one payment." }, { status: 422 });
    if (Math.abs(due - tendered) > 0.01) return NextResponse.json({ ok: false, message: `Payments (${tendered}) must equal the amount payable after advance (${due}).` }, { status: 422 });
  }

  const payeeType = ["Employee", "Supplier", "Vendor"].includes(String(body.payeeType)) ? String(body.payeeType) : "Supplier";
  const voucherDate = (body.voucherDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cashAmount = r2(payLines.filter((p) => p.mode.toLowerCase().includes("cash")).reduce((s, p) => s + p.amount, 0));
  const bankAmount = r2((isBusiness && postingType === "ap" ? 0 : tendered) - cashAmount);
  const bankLine = payLines.find((p) => !p.mode.toLowerCase().includes("cash"));
  const rbk = raw as { bankId?: number; bankName?: string; bankAccount?: string };
  const bankId = Number(rbk?.bankId) || null; const bankNm = rbk?.bankName || null; const bankAcc = rbk?.bankAccount || null;

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true }); // { businessId?, branchId? }

  // Resolve financial dimensions — a cost/profit centre must exist, be Active and
  // in the active business; otherwise it is ignored (stored as null on the journal).
  const bScope = scope.businessId != null ? { businessId: scope.businessId } : {};
  const costCenterId = body.costCenterId
    ? (await prisma.costCentre.findFirst({ where: { id: Number(body.costCenterId), tenantId: user.tenantId, status: "Active", ...bScope }, select: { id: true } }))?.id ?? null
    : null;
  const profitCenterId = body.profitCenterId
    ? (await prisma.profitCentre.findFirst({ where: { id: Number(body.profitCenterId), tenantId: user.tenantId, status: "Active", ...bScope }, select: { id: true } }))?.id ?? null
    : null;

  // ---- Budget control (pre-post): validate each expense head against its ACTIVE
  // budget plan. Stop → reject; Approval → reject (needs budget approval); Warning
  // → allow but surface a message. This reads budget/actual/committed; it never posts.
  const headAmounts = new Map<number, number>();
  for (const l of lines) if (l.headId) headAmounts.set(l.headId, r2((headAmounts.get(l.headId) ?? 0) + l.amount));
  const budgetWarnings: string[] = [];
  for (const [headId, amt] of headAmounts) {
    const decision = await checkBudget(prisma, { tenantId: user.tenantId, businessId: scope.businessId, branchId: scope.branchId, headId, dateStr: voucherDate, amount: amt });
    if (!decision.ok) return NextResponse.json({ ok: false, message: decision.message, budgetBlock: decision.reason }, { status: 422 });
    if ("warn" in decision && decision.warn) budgetWarnings.push(decision.message);
  }

  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { label: "petty cash voucher" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Voucher number from config (prefix · year · month · running no., reset per config).
      const cfg = (await tx.pettyCashConfig.findUnique({ where: { tenantId: user.tenantId } })) ?? (await tx.pettyCashConfig.create({ data: { tenantId: user.tenantId } }));
      const { voucherNo, seq, period } = buildVoucherNo(cfg, new Date());
      await tx.pettyCashConfig.update({ where: { id: cfg.id }, data: { voucherSeq: seq, voucherSeqPeriod: period } });

      const voucher = await tx.pettyCashVoucher.create({
        data: {
          tenantId: user.tenantId, ...seg, voucherNo, voucherDate, payeeType, payeeId: body.payeeId ? Number(body.payeeId) : null, payeeName: body.payeeName || null,
          gstApplicable: gst, taxableTotal, cgst, sgst, taxTotal, totalAmount: total,
          expenseType: isBusiness ? "business" : "petty", postingType, supplierGstin: body.supplierGstin || null,
          invoiceNo: body.invoiceNo || null, invoiceDate: body.invoiceDate || null, dueDate: body.dueDate || null, reverseCharge: !!body.reverseCharge,
          tdsSection: body.tdsSection || null, tdsRate, tdsAmount, tcsRate, tcsAmount, netPayable,
          attachmentsJson: body.attachments && body.attachments.length ? JSON.stringify(body.attachments) : null,
          notes: body.notes || null, bankId, bankName: bankNm, bankAccount: bankAcc, createdBy: user.id, ...stamp,
          lines: { create: lines.map((l) => ({ tenantId: user.tenantId, ...seg, headId: l.headId, headName: l.headName, description: l.description, hsn: l.hsn, gstPct: l.gstPct, taxable: l.taxable, taxAmount: l.taxAmount, amount: l.amount })) },
          payments: { create: isBusiness && postingType === "ap" ? [] : payLines },
        },
      });

      if (isBusiness) await ensureAccounts(tx, user.tenantId); // seed TDS Payable / TCS Receivable if missing

      // Dr Expense + Input GST + TCS Receivable, Cr TDS Payable + (Payable | Cash/Bank).
      const jlines: { code: string; debit?: number; credit?: number; narration?: string }[] = [
        ...Object.entries(expenseByCode).map(([code, amt]) => ({ code, debit: amt, narration: "Expenses" })),
        { code: ACC.INPUT_GST, debit: taxTotal, narration: "Input GST (ITC)" },
        { code: ACC.TCS_RECEIVABLE, debit: tcsAmount, narration: "TCS charged by supplier (receivable)" },
        { code: ACC.TDS_PAYABLE, credit: tdsAmount, narration: "TDS deducted (payable to govt)" },
      ];
      if (isBusiness && postingType === "ap") {
        const apCredit = r2(netPayable - advanceTotal);
        if (apCredit > 0.005) {
          jlines.push({ code: ACC.PAYABLE, credit: apCredit, narration: `Payable to ${body.payeeName || "supplier"}` });
          await tx.payable.create({ data: { tenantId: user.tenantId, ...seg, sourceType: "EXPENSE", sourceId: voucher.id, refNo: body.invoiceNo || voucherNo, supplier: body.payeeName || null, docDate: voucherDate, dueDate: body.dueDate || null, totalAmount: netPayable, paidAmount: advanceTotal, balanceAmount: apCredit, status: advanceTotal > 0 ? "Partial" : "Open" } });
        }
      } else {
        jlines.push({ code: ACC.CASH, credit: cashAmount, narration: "Paid by cash" });
        jlines.push({ code: ACC.BANK, credit: bankAmount, narration: "Paid by bank / other" });
      }
      // Payee advance(s) applied → Cr the advance asset (settlement embedded here).
      jlines.push(...advanceLines);
      const entryId = await postJournal(tx, {
        tenantId: user.tenantId, ...seg, voucherType: "PAYMENT", prefix: "PC", date: voucherDate,
        narration: `${isBusiness ? "Business Expense" : "Petty Cash"} — ${voucherNo}${body.payeeName ? ` — ${body.payeeName}` : ""}`,
        sourceType: "PETTY_CASH", sourceId: voucher.id, refNo: voucherNo, createdBy: user.id,
        costCenterId: costCenterId, profitCenterId: profitCenterId, department: body.department || null, project: body.project || null,
        lines: jlines,
      });
      if (advAdjustments.length && entryId) for (const a of advAdjustments) await createInlineSettlement(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, advanceId: a.advanceId, amount: a.amount, refDocType: isBusiness ? "Expense Voucher" : "Petty Cash Voucher", refDocId: voucher.id, refInvoice: voucherNo, journalId: entryId, createdBy: user.id, createdByName: null });
      if (bankAmount > 0) await recordBankMovement(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName }, { bankId, bankName: bankNm, bankAccount: bankAcc, date: voucherDate, direction: "out", amount: bankAmount, mode: bankLine?.mode ?? "Bank Transfer", reference: bankLine?.reference, sourceType: "PettyCash", sourceId: voucher.id, sourceNo: voucherNo, partyName: body.payeeName || null, journalId: typeof entryId === "number" ? entryId : null, narration: `${isBusiness ? "Business Expense" : "Petty Cash"} ${voucherNo}` });
      return { id: voucher.id, voucherNo };
    });
    await writeAudit(prisma, user, {
      action: "petty_cash.create", entity: "PettyCashVoucher", entityId: result.id,
      summary: `Petty Cash ${result.voucherNo} — ${total.toFixed(2)}${body.payeeName ? ` — ${body.payeeName}` : ""}`,
      meta: { voucherNo: result.voucherNo, total, payeeType, payeeName: body.payeeName ?? null, lineCount: lines.length, gstApplicable: gst, taxTotal },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Petty cash voucher recorded.", id: result.id, voucherNo: result.voucherNo, budgetWarnings }, { status: 201 });
  } catch (err) {
    console.error("[petty-cash] create error", err);
    return NextResponse.json({ ok: false, message: "Could not record the voucher." }, { status: 500 });
  }
}
