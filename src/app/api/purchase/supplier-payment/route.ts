import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { postSupplierPaymentJournal } from "@/lib/accounting/post";
import { recordBankMovement } from "@/lib/finance/bank";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn, terminalListWhere } from "@/lib/pos/terminalGuard";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

interface AllocIn { payableId?: number; amount?: number | string }

// GET /api/purchase/supplier-payment — list supplier payments + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const tw = await terminalListWhere(user, url.searchParams.get("terminalId"));
  const where: Prisma.SupplierPaymentWhereInput = { tenantId: user.tenantId, ...tw };
  if (q) where.OR = [{ paymentNo: { contains: q } }, { supplier: { contains: q } }, { reference: { contains: q } }];

  const month = new Date().toISOString().slice(0, 7);
  const [rows, count, monthAgg] = await Promise.all([
    prisma.supplierPayment.findMany({ where, orderBy: { id: "desc" }, take: 200, include: { _count: { select: { allocations: true } } } }),
    prisma.supplierPayment.count({ where: { tenantId: user.tenantId } }),
    prisma.supplierPayment.aggregate({ where: { tenantId: user.tenantId, paymentDate: { startsWith: month } }, _sum: { totalAmount: true } }),
  ]);

  return NextResponse.json({
    ok: true,
    rows: rows.map((p) => ({
      id: p.id, paymentNo: p.paymentNo, supplier: p.supplier ?? "", paymentDate: p.paymentDate, mode: p.mode,
      reference: p.reference ?? "", totalAmount: num(p.totalAmount), invoiceCount: p._count.allocations, status: p.status,
    })),
    stats: { payments: count, thisMonth: num(monthAgg._sum.totalAmount) },
  });
}

// POST /api/purchase/supplier-payment — pay one or more payables in one payment.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  let body: { supplier?: string; paymentDate?: string; mode?: string; reference?: string; notes?: string; allocations?: AllocIn[]; bankId?: number | null; bankName?: string; bankAccount?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const allocs = (body.allocations ?? []).filter((a) => Number(a.payableId) > 0 && num(a.amount) > 0).map((a) => ({ payableId: Number(a.payableId), amount: r2(num(a.amount)) }));
  if (!allocs.length) return NextResponse.json({ ok: false, message: "Allocate a payment amount to at least one invoice." }, { status: 422 });

  const payableIds = allocs.map((a) => a.payableId);
  const payables = await prisma.payable.findMany({ where: { id: { in: payableIds }, tenantId: user.tenantId } });
  if (payables.length !== payableIds.length) return NextResponse.json({ ok: false, message: "One or more invoices were not found." }, { status: 422 });

  const byId = new Map(payables.map((p) => [p.id, p]));
  for (const a of allocs) {
    const p = byId.get(a.payableId)!;
    if (a.amount > num(p.balanceAmount) + 0.01) return NextResponse.json({ ok: false, message: `Amount for ${p.refNo ?? "invoice"} exceeds its balance.` }, { status: 422 });
  }

  const total = r2(allocs.reduce((s, a) => s + a.amount, 0));
  const supplier = body.supplier || payables[0]?.supplier || null;
  const paymentDate = (body.paymentDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const mode = String(body.mode || "Bank Transfer");

  const seg = scopeData(await getActiveScope(user), { branch: true });
  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { label: "supplier payment" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const pay = await tx.supplierPayment.create({
        data: { tenantId: user.tenantId, ...seg, paymentNo: "TMP", supplier, paymentDate, mode, reference: body.reference || null, totalAmount: total, notes: body.notes || null, bankId: body.bankId ?? null, bankName: body.bankName || null, bankAccount: body.bankAccount || null, createdBy: user.id, ...stamp },
      });
      const paymentNo = `PAY-${String(pay.id).padStart(5, "0")}`;
      await tx.supplierPayment.update({ where: { id: pay.id }, data: { paymentNo } });

      for (const a of allocs) {
        const p = byId.get(a.payableId)!;
        const newPaid = r2(num(p.paidAmount) + a.amount);
        const newBal = r2(num(p.totalAmount) - newPaid);
        const status = newBal <= 0.01 ? "Paid" : "Partial";
        await tx.payable.update({ where: { id: p.id }, data: { paidAmount: newPaid, balanceAmount: Math.max(0, newBal), status } });
        await tx.supplierPaymentAllocation.create({ data: { tenantId: user.tenantId, ...seg, paymentId: pay.id, payableId: p.id, refNo: p.refNo, sourceType: p.sourceType, sourceId: p.sourceId, amount: a.amount } });
      }

      const jid = await postSupplierPaymentJournal(tx, { tenantId: user.tenantId, ...seg, date: paymentDate, paymentNo, paymentId: pay.id, supplier, amount: total, mode, createdBy: user.id });
      await recordBankMovement(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName }, { bankId: body.bankId, bankName: body.bankName, bankAccount: body.bankAccount, date: paymentDate, direction: "out", amount: total, mode, reference: body.reference, sourceType: "SupplierPayment", sourceId: pay.id, sourceNo: paymentNo, partyName: supplier, journalId: typeof jid === "number" ? jid : null, narration: `Supplier payment ${paymentNo}` });
      return { id: pay.id, paymentNo };
    });
    return NextResponse.json({ ok: true, message: "Supplier payment recorded.", id: result.id, paymentNo: result.paymentNo }, { status: 201 });
  } catch (err) {
    console.error("[supplier-payment] create error", err);
    return NextResponse.json({ ok: false, message: "Could not record the payment." }, { status: 500 });
  }
}
