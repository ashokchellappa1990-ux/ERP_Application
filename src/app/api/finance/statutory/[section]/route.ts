import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { computeLiability, liabilityDetail } from "@/lib/finance/statutory/engine";
import { ACTIVE_STATUTORY_TYPES, statutoryDef, financialYear, dueDate, periodLabel, periodWindow } from "@/lib/finance/statutory/types";
import type { StatutoryPaymentRow, StatutoryPaymentDto, StatutoryReturnRow } from "@/lib/contracts/statutory";
import type { Prisma } from "@prisma/client";

const PERM = "finance.statutory-compliance";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const thisMonth = () => new Date().toISOString().slice(0, 7);

function toRow(v: Awaited<ReturnType<typeof prisma.statutoryPayment.findFirst>> & object): StatutoryPaymentRow {
  return {
    id: v.id, paymentNo: v.paymentNo, paymentDate: v.paymentDate, statutoryType: v.statutoryType, financialYear: v.financialYear, taxPeriod: v.taxPeriod,
    liabilityAmount: num(v.liabilityAmount), paidAmount: num(v.paidAmount), interest: num(v.interest), penalty: num(v.penalty), totalPayable: num(v.totalPayable),
    status: v.status as StatutoryPaymentRow["status"], referenceNo: v.referenceNo, challanNo: v.challanNo, challanStatus: v.challanStatus,
    paymentMode: v.paymentMode, approvedByName: v.approvedByName,
  };
}

function recentMonths(period: string, n: number): string[] {
  const [y, m] = period.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); }
  return out;
}

export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || thisMonth();
  const type = url.searchParams.get("type") || "";
  const biz = scope.businessId != null ? { businessId: scope.businessId } : {};
  const section = params.section;

  try {
    // ---- header
    if (section === "header") {
      return NextResponse.json({ ok: true, data: { financialYear: financialYear(period + "-01"), types: ACTIVE_STATUTORY_TYPES.map((t) => ({ code: t.code, label: t.label, color: t.color, returns: t.returns })) } });
    }

    // ---- liability (one head + period, with break-up)
    if (section === "liability") {
      if (!type) return NextResponse.json({ ok: false, message: "type is required." }, { status: 400 });
      const lia = await computeLiability(scope, type, period);
      return NextResponse.json({ ok: true, data: lia });
    }

    // ---- liability drill-down (document-level detail behind the figure)
    if (section === "detail") {
      if (!type) return NextResponse.json({ ok: false, message: "type is required." }, { status: 400 });
      const detail = await liabilityDetail(scope, type, period, url.searchParams.get("q") || undefined);
      return NextResponse.json({ ok: true, data: detail });
    }

    // ---- payments list (optional ?type= ?status=)
    if (section === "payments") {
      const status = url.searchParams.get("status");
      const where: Prisma.StatutoryPaymentWhereInput = { tenantId: user.tenantId, ...biz };
      if (type) where.statutoryType = type;
      if (status) where.status = status;
      if (url.searchParams.get("period")) where.taxPeriod = period;
      const rows = await prisma.statutoryPayment.findMany({ where, orderBy: { id: "desc" }, take: 300 });
      return NextResponse.json({ ok: true, data: rows.map(toRow) });
    }

    // ---- single payment (full dto)
    if (section === "payment") {
      const id = Number(url.searchParams.get("id"));
      const v = await prisma.statutoryPayment.findFirst({ where: { id, tenantId: user.tenantId } });
      if (!v) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
      const dto: StatutoryPaymentDto = {
        ...toRow(v), businessId: v.businessId, branchId: v.branchId, alreadyPaid: num(v.alreadyPaid), balanceAmount: num(v.balanceAmount),
        breakupJson: v.breakupJson, bankAccount: v.bankAccount, transactionNo: v.transactionNo, remarks: v.remarks,
        cpin: v.cpin, cin: v.cin, bsrCode: v.bsrCode, challanBank: v.challanBank, govRef: v.govRef, ackNo: v.ackNo,
        attachments: v.attachmentsJson ? JSON.parse(v.attachmentsJson) : [], journalId: v.journalId,
        submittedAt: v.submittedAt?.toISOString() ?? null, approvedAt: v.approvedAt?.toISOString() ?? null, cancelledAt: v.cancelledAt?.toISOString() ?? null,
        cancelReason: v.cancelReason, createdBy: v.createdBy, createdAt: v.createdAt.toISOString(),
      };
      return NextResponse.json({ ok: true, data: dto });
    }

    // ---- challans (payments carrying challan info)
    if (section === "challans") {
      const rows = await prisma.statutoryPayment.findMany({ where: { tenantId: user.tenantId, ...biz, status: { not: "Cancelled" } }, orderBy: { id: "desc" }, take: 300 });
      return NextResponse.json({ ok: true, data: rows.map((v) => ({ id: v.id, challanNo: v.challanNo, paymentNo: v.paymentNo, statutoryType: v.statutoryType, taxPeriod: v.taxPeriod, amount: num(v.totalPayable), bank: v.challanBank, cpin: v.cpin, cin: v.cin, bsrCode: v.bsrCode, status: v.status, challanStatus: v.challanStatus, hasAttachment: !!v.attachmentsJson })) });
    }

    // ---- dashboard
    if (section === "dashboard") {
      const liabilities = await Promise.all(ACTIVE_STATUTORY_TYPES.map((t) => computeLiability(scope, t.code, period)));
      const heads = ACTIVE_STATUTORY_TYPES.map((t, i) => ({ type: t.code, label: t.label, color: t.color, liability: liabilities[i].liability, paid: liabilities[i].alreadyPaid, balance: liabilities[i].balance, due: dueDate(t.code, period), overdue: liabilities[i].balance > 0.5 && dueDate(t.code, period) < new Date().toISOString().slice(0, 10) }));
      const totalLiability = r2(heads.reduce((s, h) => s + h.liability, 0));
      const totalPaid = r2(heads.reduce((s, h) => s + h.paid, 0));
      const totalPending = r2(heads.reduce((s, h) => s + h.balance, 0));
      const overdue = r2(heads.filter((h) => h.overdue).reduce((s, h) => s + h.balance, 0));

      const months = recentMonths(period, 6);
      const paidByMonth = await prisma.statutoryPayment.groupBy({ by: ["taxPeriod"], where: { tenantId: user.tenantId, ...biz, status: "Paid", taxPeriod: { in: months } }, _sum: { totalPayable: true } });
      const paidMap = new Map(paidByMonth.map((p) => [p.taxPeriod, num(p._sum.totalPayable)]));
      const trend = months.map((m) => ({ name: periodLabel(m).slice(0, 3), value: r2(paidMap.get(m) ?? 0) }));

      const returns = await prisma.statutoryReturn.findMany({ where: { tenantId: user.tenantId, ...biz, taxPeriod: period }, select: { statutoryType: true, returnType: true, status: true } });
      const filed = returns.filter((r) => r.status === "Filed").length;

      return NextResponse.json({ ok: true, data: { period, heads, totals: { totalLiability, totalPaid, totalPending, overdue }, upcoming: heads.map((h) => ({ type: h.type, label: h.label, due: h.due, amount: h.balance })).filter((u) => u.amount > 0.5), trend, returns, returnsFiled: filed } });
    }

    // ---- returns (tracker + expected forms per active head for the period)
    if (section === "returns") {
      const saved = await prisma.statutoryReturn.findMany({ where: { tenantId: user.tenantId, ...biz, ...(url.searchParams.get("period") ? { taxPeriod: period } : {}) }, orderBy: { id: "desc" }, take: 300 });
      const rows: StatutoryReturnRow[] = saved.map((r) => ({ id: r.id, statutoryType: r.statutoryType, returnType: r.returnType, financialYear: r.financialYear, taxPeriod: r.taxPeriod, liabilityAmount: num(r.liabilityAmount), status: r.status as StatutoryReturnRow["status"], filedDate: r.filedDate, ackNo: r.ackNo, remarks: r.remarks }));
      const expected = ACTIVE_STATUTORY_TYPES.flatMap((t) => t.returns.map((rt) => ({ statutoryType: t.code, returnType: rt })));
      return NextResponse.json({ ok: true, data: { rows, expected, period } });
    }

    // ---- reconciliation (Ledger vs Government Payment vs Challan per head)
    if (section === "reconciliation") {
      const results = await Promise.all(ACTIVE_STATUTORY_TYPES.map(async (t) => {
        const lia = await computeLiability(scope, t.code, period);
        const pays = await prisma.statutoryPayment.findMany({ where: { tenantId: user.tenantId, ...biz, statutoryType: t.code, taxPeriod: period, status: "Paid" }, select: { paidAmount: true, challanNo: true } });
        const paid = r2(pays.reduce((s, p) => s + num(p.paidAmount), 0));
        const withChallan = pays.filter((p) => p.challanNo && p.challanNo.trim()).length;
        const diff = r2(lia.liability - paid);
        return { type: t.code, label: t.label, ledgerLiability: lia.liability, paid, challans: withChallan, difference: diff, status: Math.abs(diff) < 0.5 ? "Matched" : paid === 0 ? "Unpaid" : "Difference" };
      }));
      return NextResponse.json({ ok: true, data: results });
    }

    // ---- reports (registers)
    if (section === "reports") {
      const all = await prisma.statutoryPayment.findMany({ where: { tenantId: user.tenantId, ...biz, ...(type ? { statutoryType: type } : {}) }, orderBy: { id: "desc" }, take: 500 });
      return NextResponse.json({ ok: true, data: all.map(toRow) });
    }

    // ---- analytics (12-month liability vs payment + compliance %)
    if (section === "analytics") {
      const months = recentMonths(period, 6);
      const byType = await Promise.all(ACTIVE_STATUTORY_TYPES.map(async (t) => {
        const series = await Promise.all(months.map(async (m) => (await computeLiability(scope, t.code, m)).liability));
        return { type: t.code, label: t.label, color: t.color, series: months.map((m, i) => ({ name: periodLabel(m).slice(0, 3), value: series[i] })) };
      }));
      const paidAgg = await prisma.statutoryPayment.groupBy({ by: ["taxPeriod"], where: { tenantId: user.tenantId, ...biz, status: "Paid", taxPeriod: { in: months } }, _sum: { totalPayable: true } });
      const paidMap = new Map(paidAgg.map((p) => [p.taxPeriod, num(p._sum.totalPayable)]));
      const payments = months.map((m) => ({ name: periodLabel(m).slice(0, 3), value: r2(paidMap.get(m) ?? 0) }));
      const curLia = r2((await Promise.all(ACTIVE_STATUTORY_TYPES.map((t) => computeLiability(scope, t.code, period)))).reduce((s, l) => s + l.liability, 0));
      const curPaid = num((await prisma.statutoryPayment.aggregate({ where: { tenantId: user.tenantId, ...biz, status: "Paid", taxPeriod: period }, _sum: { totalPayable: true } }))._sum.totalPayable);
      const compliance = curLia > 0 ? Math.min(100, Math.round((curPaid / curLia) * 100)) : 100;
      return NextResponse.json({ ok: true, data: { byType, payments, compliance } });
    }

    return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
  } catch (err) {
    console.error("[statutory] GET", section, err);
    return NextResponse.json({ ok: false, message: "Could not load data." }, { status: 500 });
  }
}
