import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "operations.reports";
const num = (v: Prisma.Decimal | null | undefined) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface SalesReportRow {
  id: string; date: string; invoiceNo: string; time: string; type: "Cash" | "Credit";
  customerName: string; vehicleNo: string; deliveryTo: string; productName: string;
  price: number; qty: number; uom: string; subTotal: number; vehicleRent: number; tax: number;
  transitPass: number; driverBata: number; total: number; createdByName: string;
}

// GET /api/operations/reports/sales — per-invoice sales lines for a date
// range (replicates the "Sales Report" paper report: filters, one row per
// product line, grouped by date on screen, Report Summary + Product Sales
// Summary blocks). Vehicle/Delivery/Rent/Transit Pass/Driver Batta come from
// the Load & Dispatch record that created the Sale, when one exists — a
// POS-originated Sale has none of those (shown as "—" / 0).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || new Date().toISOString().slice(0, 10);
  const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const type = url.searchParams.get("type"); // "cash" | "credit" | null (all)
  const customerName = (url.searchParams.get("customer") ?? "").trim();
  const vehicleNo = (url.searchParams.get("vehicleNo") ?? "").trim();
  const productId = url.searchParams.get("productId");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const sales = await prisma.sale.findMany({
    where: { ...scopeWhere(scope, { branch: true }), status: { not: "Cancelled" }, saleDate: { gte: from, lte: to } },
    include: { lines: true },
    orderBy: [{ saleDate: "asc" }, { id: "asc" }],
    take: 5000,
  });

  const saleIds = sales.map((s) => s.id);
  const dispatches = saleIds.length ? await prisma.loadDispatch.findMany({ where: { saleId: { in: saleIds } }, select: { saleId: true, vehicleId: true, deliveryAddress: true, vehicleRent: true, transitPassAmount: true, driverBattaAmount: true } }) : [];
  const dispatchMap = new Map(dispatches.map((d) => [d.saleId!, d]));
  const vehicleIds = Array.from(new Set(dispatches.map((d) => d.vehicleId).filter((x): x is number => x != null)));
  const createdByIds = Array.from(new Set(sales.map((s) => s.createdBy).filter((x): x is number => x != null)));
  const [vehicles, users] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  let rows: SalesReportRow[] = [];
  for (const s of sales) {
    const d = dispatchMap.get(s.id);
    const saleType: "Cash" | "Credit" = s.paymentStatus === "Credit" ? "Credit" : "Cash";
    for (const l of s.lines) {
      rows.push({
        id: `${s.id}-${l.id}`, date: s.saleDate, invoiceNo: s.invoiceNo, time: s.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        type: saleType, customerName: s.customerName ?? "Walk-in", vehicleNo: d?.vehicleId != null ? vMap.get(d.vehicleId) ?? "—" : "—",
        deliveryTo: d?.deliveryAddress ?? "—", productName: l.productName, price: num(l.rate), qty: num(l.qty), uom: l.uom ?? "",
        subTotal: num(l.taxableValue), vehicleRent: num(d?.vehicleRent), tax: num(l.taxAmount), transitPass: num(d?.transitPassAmount), driverBata: num(d?.driverBattaAmount),
        total: num(s.total), createdByName: (s.createdBy != null ? uMap.get(s.createdBy) : null) ?? "—",
      });
    }
  }

  // Filter option lists, computed before the below filters are applied.
  const filterOptions = {
    vehicles: Array.from(new Set(rows.map((r) => r.vehicleNo).filter((v) => v !== "—"))).sort(),
    customers: Array.from(new Set(rows.map((r) => r.customerName))).sort(),
    products: Array.from(new Map(sales.flatMap((s) => s.lines.map((l) => [l.productId, l.productName] as const))).entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  };

  if (type === "cash") rows = rows.filter((r) => r.type === "Cash");
  if (type === "credit") rows = rows.filter((r) => r.type === "Credit");
  if (customerName) rows = rows.filter((r) => r.customerName.toLowerCase().includes(customerName.toLowerCase()));
  if (vehicleNo) rows = rows.filter((r) => r.vehicleNo.toLowerCase().includes(vehicleNo.toLowerCase()));
  if (productId) { const pid = Number(productId); const line = new Set(sales.flatMap((s) => s.lines.filter((l) => l.productId === pid).map((l) => `${s.id}-${l.id}`))); rows = rows.filter((r) => line.has(r.id)); }
  if (q) { const ql = q.toLowerCase(); rows = rows.filter((r) => r.invoiceNo.toLowerCase().includes(ql) || r.customerName.toLowerCase().includes(ql) || r.vehicleNo.toLowerCase().includes(ql)); }

  // Report Summary — de-duplicated per Sale (not per line) so invoice-level
  // totals (tax/rent/pass/batta/roundoff/grand total) aren't multiplied by
  // however many product lines an invoice has.
  const seenSaleIds = new Set(rows.map((r) => r.id.split("-")[0]));
  const summarySales = sales.filter((s) => seenSaleIds.has(String(s.id)));
  const totalLoads = summarySales.length;
  const subTotal = r2(summarySales.reduce((s, x) => s + num(x.taxableValue), 0));
  const tax = r2(summarySales.reduce((s, x) => s + num(x.taxTotal), 0));
  const roundOff = r2(summarySales.reduce((s, x) => s + num(x.roundOff), 0));
  const total = r2(summarySales.reduce((s, x) => s + num(x.total), 0));
  const vehicleRentTotal = r2(summarySales.reduce((s, x) => s + num(dispatchMap.get(x.id)?.vehicleRent), 0));
  const passTotal = r2(summarySales.reduce((s, x) => s + num(dispatchMap.get(x.id)?.transitPassAmount), 0));
  const driverBataTotal = r2(summarySales.reduce((s, x) => s + num(dispatchMap.get(x.id)?.driverBattaAmount), 0));

  const productMap = new Map<string, { uom: string; qty: number; net: number }>();
  for (const r of rows) {
    const cur = productMap.get(r.productName) ?? { uom: r.uom, qty: 0, net: 0 };
    cur.qty = r2(cur.qty + r.qty); cur.net = r2(cur.net + r.subTotal + r.tax); productMap.set(r.productName, cur);
  }
  const productSalesSummary = Array.from(productMap.entries()).map(([name, v]) => ({ name, uom: v.uom, qty: v.qty, net: v.net }));

  return NextResponse.json({
    ok: true, rows, filterOptions,
    summary: {
      report: { totalLoads, subTotal, vehicleRent: vehicleRentTotal, tax, transitPass: passTotal, driverBata: driverBataTotal, roundOff, total },
      productSalesSummary,
    },
  });
}
