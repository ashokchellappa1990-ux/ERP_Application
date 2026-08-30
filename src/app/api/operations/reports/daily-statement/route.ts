import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "operations.reports";
const num = (v: Prisma.Decimal | null | undefined) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface BillRow {
  id: string; invoiceNo: string; date: string; customerName: string; vehicleNo: string; deliveryTo: string;
  productName: string; qty: number; rate: number; rateGst: number; bata: number; pass: number; total: number;
  difference: number; to: string; status: string; createdByName: string;
}
export interface DailyStatementData {
  kpi: { totalLoads: number; cancelledSales: number; totalSales: number; cashSales: number; creditSales: number; vehicleRent: number; transitPass: number; driverBata: number; discount: number };
  accountBreakdown: { name: string; count: number; amount: number }[];
  productSummary: { name: string; qtyUnit: number; qtyTon: number; pass: number; credit: number; cash: number; cashWithoutPass: number }[];
  expenses: { category: string; amount: number }[];
  cashBills: BillRow[]; creditBills: BillRow[];
}

// GET /api/operations/reports/daily-statement — the "Daily Statement Report":
// Sales KPI cards, a payment/account breakdown, Product Sales Summary,
// Expenses Summary, and per-invoice Cash/Credit bill detail tables, for a
// date range (defaults to today, matching the paper report's single-day use).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || new Date().toISOString().slice(0, 10);
  const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);

  const scope = await getActiveScope(user);
  const sales = await prisma.sale.findMany({
    where: { ...scopeWhere(scope, { branch: true }), saleDate: { gte: from, lte: to } },
    include: { lines: true },
    orderBy: [{ createdAt: "asc" }],
    take: 5000,
  });

  const active = sales.filter((s) => s.status !== "Cancelled");
  const saleIds = active.map((s) => s.id);
  const dispatches = saleIds.length ? await prisma.loadDispatch.findMany({ where: { saleId: { in: saleIds } }, select: { saleId: true, vehicleId: true, deliveryAddress: true, vehicleRent: true, transitPassAmount: true, driverBattaAmount: true } }) : [];
  const dispatchMap = new Map(dispatches.map((d) => [d.saleId!, d]));
  const vehicleIds = Array.from(new Set(dispatches.map((d) => d.vehicleId).filter((x): x is number => x != null)));
  const createdByIds = Array.from(new Set(active.map((s) => s.createdBy).filter((x): x is number => x != null)));
  const [vehicles, users] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  const typeOf = (s: (typeof sales)[number]) => (s.paymentStatus === "Credit" ? "Credit" : "Cash");

  // ---- KPI ----
  const totalLoads = active.length;
  const cancelledSales = sales.length - active.length;
  const totalSales = r2(active.reduce((s, x) => s + num(x.total), 0));
  const cashSales = r2(active.filter((s) => typeOf(s) === "Cash").reduce((s, x) => s + num(x.total), 0));
  const creditSales = r2(active.filter((s) => typeOf(s) === "Credit").reduce((s, x) => s + num(x.total), 0));
  const vehicleRent = r2(active.reduce((s, x) => s + num(dispatchMap.get(x.id)?.vehicleRent), 0));
  const transitPass = r2(active.reduce((s, x) => s + num(dispatchMap.get(x.id)?.transitPassAmount), 0));
  const driverBata = r2(active.reduce((s, x) => s + num(dispatchMap.get(x.id)?.driverBattaAmount), 0));
  const discount = r2(active.reduce((s, x) => s + num(x.itemDiscount) + num(x.billDiscount), 0));

  // ---- Payment / account breakdown ----
  const acctMap = new Map<string, { count: number; amount: number }>();
  for (const s of active) {
    const name = s.bankName?.trim() || (typeOf(s) === "Credit" ? "Credit Account" : "Cash Account");
    const cur = acctMap.get(name) ?? { count: 0, amount: 0 };
    cur.count += 1; cur.amount = r2(cur.amount + num(s.total)); acctMap.set(name, cur);
  }
  const accountBreakdown = Array.from(acctMap.entries()).map(([name, v]) => ({ name, ...v }));

  // ---- Product Sales Summary ----
  const prodMap = new Map<string, { qtyUnit: number; qtyTon: number; pass: number; credit: number; cash: number }>();
  for (const s of active) {
    const t = typeOf(s);
    for (const l of s.lines) {
      const cur = prodMap.get(l.productName) ?? { qtyUnit: 0, qtyTon: 0, pass: 0, credit: 0, cash: 0 };
      const isTon = (l.uom ?? "").toLowerCase() === "ton";
      if (isTon) cur.qtyTon = r2(cur.qtyTon + num(l.qty)); else cur.qtyUnit = r2(cur.qtyUnit + num(l.qty));
      const lineValue = num(l.value) || r2(num(l.taxableValue) + num(l.taxAmount));
      if (t === "Credit") cur.credit = r2(cur.credit + lineValue); else cur.cash = r2(cur.cash + lineValue);
      prodMap.set(l.productName, cur);
    }
  }
  const productSummary = Array.from(prodMap.entries()).map(([name, v]) => ({ name, ...v, cashWithoutPass: v.cash }));

  // ---- Expenses Summary — Driver Batta is the only sales-linked expense
  // this report currently sources (Petty Cash/other categories aren't
  // pulled in here; add them if this needs to reconcile against Finance). ----
  const expenses = driverBata > 0 ? [{ category: "Driver Bata", amount: driverBata }] : [];

  // ---- Sales Individual Bill Details ----
  function toBillRow(s: (typeof sales)[number]): BillRow {
    const d = dispatchMap.get(s.id);
    const l = s.lines[0];
    const qty = num(l?.qty);
    const rate = num(l?.rate);
    const rateGst = qty > 0 ? r2(rate + num(l?.taxAmount) / qty) : rate;
    return {
      id: String(s.id), invoiceNo: s.invoiceNo, date: s.saleDate, customerName: s.customerName ?? "Walk-in",
      vehicleNo: d?.vehicleId != null ? vMap.get(d.vehicleId) ?? "—" : "—", deliveryTo: d?.deliveryAddress ?? "—",
      productName: l?.productName ?? "—", qty, rate, rateGst, bata: num(d?.driverBattaAmount), pass: num(d?.transitPassAmount),
      total: num(s.total), difference: r2(num(s.amountPaid) - num(s.total)), to: s.bankName?.trim() || "Cash Account",
      status: s.status, createdByName: (s.createdBy != null ? uMap.get(s.createdBy) : null) ?? "—",
    };
  }
  const cashBills = active.filter((s) => typeOf(s) === "Cash").map(toBillRow);
  const creditBills = active.filter((s) => typeOf(s) === "Credit").map(toBillRow);

  const data: DailyStatementData = {
    kpi: { totalLoads, cancelledSales, totalSales, cashSales, creditSales, vehicleRent, transitPass, driverBata, discount },
    accountBreakdown, productSummary, expenses, cashBills, creditBills,
  };
  return NextResponse.json({ ok: true, ...data });
}
