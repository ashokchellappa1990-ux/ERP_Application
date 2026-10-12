import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { postJournal } from "@/lib/accounting/post";
import { ACC } from "@/lib/accounting/accounts";
import { recordBankMovement } from "@/lib/finance/bank";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn, terminalListWhere } from "@/lib/pos/terminalGuard";
import { CollectionCreateSchema, type CollectionRow, type CollectionListStats } from "@/lib/contracts/sale";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
const PERM = "sales.collections";

// GET /api/sales/collection — list customer collections + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const tw = await terminalListWhere(user, url.searchParams.get("terminalId"));
  const where: Prisma.CustomerCollectionWhereInput = { tenantId: user.tenantId, ...tw };
  if (q) where.OR = [{ collectionNo: { contains: q } }, { customerName: { contains: q } }, { reference: { contains: q } }];

  const month = new Date().toISOString().slice(0, 7);
  const [rows, count, monthAgg] = await Promise.all([
    prisma.customerCollection.findMany({ where, orderBy: { id: "desc" }, take: 200, include: { _count: { select: { allocations: true } } } }),
    prisma.customerCollection.count({ where: { tenantId: user.tenantId } }),
    prisma.customerCollection.aggregate({ where: { tenantId: user.tenantId, collectionDate: { startsWith: month } }, _sum: { totalAmount: true } }),
  ]);

  const shaped: CollectionRow[] = rows.map((c) => ({
    id: c.id, collectionNo: c.collectionNo, customerName: c.customerName ?? "", collectionDate: c.collectionDate, mode: c.mode,
    reference: c.reference ?? "", totalAmount: num(c.totalAmount), invoiceCount: c._count.allocations, status: c.status,
  }));
  const stats: CollectionListStats = { collections: count, thisMonth: num(monthAgg._sum.totalAmount) };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/sales/collection — collect against one or more credit invoices.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "CustomerCollection" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = CollectionCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const allocs = (body.allocations ?? []).filter((a) => Number(a.saleId) > 0 && num(a.amount) > 0).map((a) => ({ saleId: Number(a.saleId), amount: r2(num(a.amount)) }));
  if (!allocs.length) return NextResponse.json({ ok: false, message: "Allocate a collection amount to at least one invoice." }, { status: 422 });

  const payLines = (body.payments ?? []).filter((p) => num(p.amount) > 0).map((p) => ({ mode: String(p.mode || "Cash"), amount: r2(num(p.amount)), reference: p.reference || null }));
  if (!payLines.length) return NextResponse.json({ ok: false, message: "Enter at least one payment mode amount." }, { status: 422 });

  const saleIds = allocs.map((a) => a.saleId);
  const sales = await prisma.sale.findMany({ where: { id: { in: saleIds }, tenantId: user.tenantId } });
  if (sales.length !== saleIds.length) return NextResponse.json({ ok: false, message: "One or more invoices were not found." }, { status: 422 });

  const byId = new Map(sales.map((s) => [s.id, s]));
  for (const a of allocs) {
    const s = byId.get(a.saleId)!;
    const balance = r2(num(s.total) - num(s.tdsAmount) - num(s.amountPaid));
    if (a.amount > balance + 0.01) return NextResponse.json({ ok: false, message: `Amount for ${s.invoiceNo} exceeds its balance.` }, { status: 422 });
  }

  const total = r2(allocs.reduce((s, a) => s + a.amount, 0));
  const tendered = r2(payLines.reduce((s, p) => s + p.amount, 0));
  if (Math.abs(tendered - total) > 0.01) return NextResponse.json({ ok: false, message: `Tendered (${tendered}) must equal the allocated total (${total}).` }, { status: 422 });

  const customer = body.customerId ? await prisma.customer.findFirst({ where: { id: Number(body.customerId), tenantId: user.tenantId } }) : null;
  const customerName = customer?.name ?? sales[0]?.customerName ?? null;
  const collectionDate = (body.collectionDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const mode = payLines.length === 1 ? payLines[0].mode : "Split";
  const reference = payLines.length === 1 ? payLines[0].reference : null;
  const atts = (body.attachments ?? []).filter((a) => a.fileUrl && a.fileName).slice(0, 10);
  const cashAmount = r2(payLines.filter((p) => p.mode.toLowerCase().includes("cash")).reduce((s, p) => s + p.amount, 0));
  const bankAmount = r2(total - cashAmount);
  const bankLine = payLines.find((p) => !p.mode.toLowerCase().includes("cash"));
  const rb = raw as { bankId?: number; bankName?: string; bankAccount?: string };
  const bankId = Number(rb?.bankId) || null; const bankName = rb?.bankName || null; const bankAccount = rb?.bankAccount || null;

  const seg = scopeData(await getActiveScope(user), { branch: true });
  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { feature: "allowCredit", label: "collection" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx, "WEB_POS");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const col = await tx.customerCollection.create({
        data: {
          tenantId: user.tenantId, ...seg, collectionNo: "TMP", customerId: customer?.id ?? null, customerName,
          collectionDate, mode, reference, totalAmount: total, notes: body.notes || null,
          bankId, bankName, bankAccount,
          attachments: atts.length ? (atts as unknown as Prisma.InputJsonValue) : undefined,
          payments: payLines as unknown as Prisma.InputJsonValue, createdBy: user.id, ...stamp,
        },
      });
      const collectionNo = `COL-${String(col.id).padStart(5, "0")}`;
      await tx.customerCollection.update({ where: { id: col.id }, data: { collectionNo } });

      for (const a of allocs) {
        const s = byId.get(a.saleId)!;
        const payable = r2(num(s.total) - num(s.tdsAmount));
        const newPaid = r2(num(s.amountPaid) + a.amount);
        const paymentStatus = newPaid >= payable - 0.01 ? "Paid" : "Partial";
        await tx.sale.update({ where: { id: s.id }, data: { amountPaid: newPaid, paymentStatus } });
        await tx.salePayment.create({ data: { saleId: s.id, ...seg, mode, amount: a.amount, reference: reference || collectionNo } });
        await tx.customerCollectionAllocation.create({ data: { tenantId: user.tenantId, ...seg, collectionId: col.id, saleId: s.id, invoiceNo: s.invoiceNo, amount: a.amount } });
      }

      // Receipt voucher — Dr Cash + Dr Bank (split by tender), Cr Accounts Receivable.
      const jid = await postJournal(tx, {
        tenantId: user.tenantId, ...seg, voucherType: "RECEIPT", prefix: "RC", date: collectionDate,
        narration: `Collection — ${collectionNo}${customerName ? ` — ${customerName}` : ""}${bankName ? ` — ${bankName}` : ""}`,
        sourceType: "SALES_RECEIPT", sourceId: col.id, refNo: collectionNo, createdBy: user.id,
        lines: [
          { code: ACC.CASH, debit: cashAmount, narration: "Cash collected" },
          { code: ACC.BANK, debit: bankAmount, narration: "Bank / UPI / Cheque / Card collected" },
          { code: ACC.RECEIVABLE, credit: total, narration: `Against ${customerName ?? "customer"}` },
        ],
      });
      if (bankAmount > 0) await recordBankMovement(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName }, { bankId, bankName, bankAccount, date: collectionDate, direction: "in", amount: bankAmount, mode: bankLine?.mode ?? "Bank Transfer", reference: bankLine?.reference ?? reference, sourceType: "CustomerCollection", sourceId: col.id, sourceNo: collectionNo, partyName: customerName, journalId: typeof jid === "number" ? jid : null, narration: `Collection ${collectionNo}` });
      return { id: col.id, collectionNo };
    });
    await writeAudit(prisma, user, {
      action: "collection.create", entity: "CustomerCollection", entityId: result.id,
      summary: `Collection ${result.collectionNo} — ${total.toFixed(2)} from ${customerName ?? "customer"}`,
      meta: { collectionNo: result.collectionNo, total, mode, invoiceCount: allocs.length, customerId: customer?.id ?? null },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Collection recorded.", id: result.id, collectionNo: result.collectionNo }, { status: 201 });
  } catch (err) {
    console.error("[collection] create error", err);
    return NextResponse.json({ ok: false, message: "Could not record the collection." }, { status: 500 });
  }
}
