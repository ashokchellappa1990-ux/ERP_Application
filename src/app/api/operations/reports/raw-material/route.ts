import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "operations.reports";
const num = (v: Prisma.Decimal | null | undefined) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dstr = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const tstr = (d: Date | null | undefined) => (d ? d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : null);

// A GRN's Area.type of "Processing" reads as material routed to the crusher/
// plant for processing; anything else (Storage or unset) reads as a direct
// stock receipt — no separate destination field exists yet, so this is
// derived rather than stored (see Details column of the printed report).
function detailsLabel(areaType: string | null | undefined): string {
  return areaType === "Processing" ? "Quarry To Crusher (Plant)" : "Quarry To Stock";
}

export interface RawMaterialReportRow {
  id: string; date: string; branch: string; passNo: string; inTime: string | null; outTime: string | null;
  vehicleNo: string; supplierName: string; productName: string; ew: number; lw: number; nw: number; uom: string;
  price: number; details: string; transport: string; transportRate: number; driverName: string; createdByName: string; modifiedByName: string;
}

// GET /api/operations/reports/raw-material — inbound raw-material receipts
// (posted GRNs), one row per product line, replicating the "Raw Material
// Report" layout: filterable by date range / vehicle / supplier / product /
// destination, plus the same Product/Vehicle/Supplier/Driver/Trip summary
// blocks and headline totals as the source report.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || dstr(new Date())!;
  const to = url.searchParams.get("to") || dstr(new Date())!;
  const vehicleNo = (url.searchParams.get("vehicleNo") ?? "").trim();
  const supplier = (url.searchParams.get("supplier") ?? "").trim();
  const productId = url.searchParams.get("productId");
  const details = url.searchParams.get("details"); // "crusher" | "stock" | null (all)
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const baseWhere: Prisma.GoodsReceiptNoteWhereInput = { ...scopeWhere(scope, { branch: true }), status: "Posted", grnDate: { gte: from, lte: to } };
  const where: Prisma.GoodsReceiptNoteWhereInput = { ...baseWhere };
  if (vehicleNo) where.vehicleNo = { contains: vehicleNo };
  if (supplier) where.supplier = { contains: supplier };
  if (q) where.OR = [{ grnNo: { contains: q } }, { vehicleNo: { contains: q } }, { supplier: { contains: q } }];

  // Filter-dropdown option lists — scoped only by date range, independent of
  // the other filters currently applied, so choosing one filter never hides
  // valid options from the others.
  const [vehicleOpts, supplierOpts, productOpts] = await Promise.all([
    prisma.goodsReceiptNote.findMany({ where: { ...baseWhere, vehicleNo: { not: null } }, distinct: ["vehicleNo"], select: { vehicleNo: true }, orderBy: { vehicleNo: "asc" } }),
    prisma.goodsReceiptNote.findMany({ where: { ...baseWhere, supplier: { not: null } }, distinct: ["supplier"], select: { supplier: true }, orderBy: { supplier: "asc" } }),
    prisma.goodsReceiptLine.findMany({ where: { grn: baseWhere }, distinct: ["productId"], select: { productId: true, productName: true }, orderBy: { productName: "asc" }, take: 500 }),
  ]);

  const grns = await prisma.goodsReceiptNote.findMany({
    where, orderBy: [{ grnDate: "desc" }, { id: "desc" }], take: 3000,
    include: { lines: productId ? { where: { productId: Number(productId) } } : true },
  });
  const withLines = grns.filter((g) => g.lines.length > 0);

  const gateEntryIds = Array.from(new Set(withLines.map((g) => g.gateEntryId).filter((x): x is number => x != null)));
  const areaIds = Array.from(new Set(withLines.map((g) => g.areaId).filter((x): x is number => x != null)));
  const branchIds = Array.from(new Set(withLines.map((g) => g.branchId).filter((x): x is number => x != null)));
  const createdByIds = Array.from(new Set(withLines.map((g) => g.createdBy).filter((x): x is number => x != null)));

  const [gateEntries, gateExits, areas, branches, users] = await Promise.all([
    gateEntryIds.length ? prisma.vehicleGateEntry.findMany({ where: { id: { in: gateEntryIds } }, select: { id: true, arrivalTime: true, driverName: true, areaId: true } }) : [],
    gateEntryIds.length ? prisma.gateExit.findMany({ where: { gateEntryId: { in: gateEntryIds } }, select: { gateEntryId: true, exitTime: true } }) : [],
    areaIds.length ? prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, type: true } }) : [],
    branchIds.length ? prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const gateMap = new Map(gateEntries.map((g) => [g.id, g]));
  const exitMap = new Map(gateExits.map((e) => [e.gateEntryId, e.exitTime]));
  const areaMap = new Map(areas.map((a) => [a.id, a.type]));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const userMap = new Map(users.map((u) => [u.id, u.fullName]));

  const rows: RawMaterialReportRow[] = [];
  for (const g of withLines) {
    const gate = g.gateEntryId != null ? gateMap.get(g.gateEntryId) : null;
    const areaType = g.areaId != null ? areaMap.get(g.areaId) : (gate?.areaId != null ? areaMap.get(gate.areaId) : null);
    const label = detailsLabel(areaType);
    if (details === "crusher" && label !== "Quarry To Crusher (Plant)") continue;
    if (details === "stock" && label !== "Quarry To Stock") continue;
    for (const l of g.lines) {
      // tareWeight/grossWeight/netWeight are always captured in Kg (the
      // weighbridge's native unit) regardless of the product line's own
      // commercial uom — convert to match whenever that uom is Ton, same
      // convention used for the Tax Invoice/Delivery Note weight lines.
      const uom = l.uom ?? "Ton";
      const isTon = uom.toLowerCase() === "ton";
      const div = isTon ? 1000 : 1;
      rows.push({
        id: `${g.id}-${l.id}`, date: g.grnDate, branch: (g.branchId != null ? branchMap.get(g.branchId) : null) ?? "—",
        passNo: g.grnNo, inTime: gate?.arrivalTime ? tstr(gate.arrivalTime) : null, outTime: g.gateEntryId != null ? tstr(exitMap.get(g.gateEntryId) ?? null) : null,
        vehicleNo: g.vehicleNo ?? "—", supplierName: g.supplier ?? "—", productName: l.productName,
        ew: r2(num(g.tareWeight ?? g.emptyWeight) / div), lw: r2(num(g.grossWeight) / div), nw: g.netWeight != null ? r2(num(g.netWeight) / div) : num(l.qty),
        uom, price: num(l.rate), details: label, transport: g.transporterName ?? "—", transportRate: 0,
        driverName: gate?.driverName ?? "—", createdByName: (g.createdBy != null ? userMap.get(g.createdBy) : null) ?? "—", modifiedByName: "—",
      });
    }
  }

  // ---- summary blocks (mirroring the printed report's four breakdown tables
  // plus its headline Report Summary) ----
  const byProduct = new Map<string, { trips: number; nw: number; uom: string }>();
  const byVehicle = new Map<string, { trips: number; nw: number; uom: string }>();
  const bySupplier = new Map<string, { trips: number; nw: number; uom: string }>();
  const byDriver = new Map<string, { trips: number; nw: number; uom: string }>();
  const byTrip = new Map<string, { date: string; product: string; details: string; trips: number; nw: number; uom: string }>();
  for (const r of rows) {
    for (const [map, key] of [[byProduct, r.productName], [byVehicle, r.vehicleNo], [bySupplier, r.supplierName], [byDriver, r.driverName]] as const) {
      const cur = map.get(key) ?? { trips: 0, nw: 0, uom: r.uom };
      cur.trips += 1; cur.nw = r2(cur.nw + r.nw); map.set(key, cur);
    }
    const tKey = `${r.date}|${r.productName}|${r.details}`;
    const t = byTrip.get(tKey) ?? { date: r.date, product: r.productName, details: r.details, trips: 0, nw: 0, uom: r.uom };
    t.trips += 1; t.nw = r2(t.nw + r.nw); byTrip.set(tKey, t);
  }

  const totalLoads = rows.length;
  const totalQty = r2(rows.reduce((s, r) => s + r.nw, 0));
  const totalPurchase = r2(rows.reduce((s, r) => s + r.nw * r.price, 0));
  const processTimesMin: number[] = [];
  for (const g of withLines) {
    const gate = g.gateEntryId != null ? gateMap.get(g.gateEntryId) : null;
    const exit = g.gateEntryId != null ? exitMap.get(g.gateEntryId) : null;
    if (gate?.arrivalTime && exit) processTimesMin.push((exit.getTime() - gate.arrivalTime.getTime()) / 60000);
  }
  const avgProcessTime = processTimesMin.length ? r2(processTimesMin.reduce((s, n) => s + n, 0) / processTimesMin.length) : 0;
  const avgLoadWeight = totalLoads ? r2(totalQty / totalLoads) : 0;

  const toArr = (m: Map<string, { trips: number; nw: number; uom: string }>) => Array.from(m.entries()).map(([name, v]) => ({ name, trips: v.trips, uom: v.uom, nw: v.nw }));

  return NextResponse.json({
    ok: true, rows,
    filterOptions: {
      vehicles: vehicleOpts.map((v) => v.vehicleNo!).filter(Boolean),
      suppliers: supplierOpts.map((s) => s.supplier!).filter(Boolean),
      products: productOpts.map((p) => ({ id: p.productId, name: p.productName })),
    },
    summary: {
      productDetails: toArr(byProduct), vehicleDetails: toArr(byVehicle), supplierDetails: toArr(bySupplier), driverDetails: toArr(byDriver),
      tripSummary: Array.from(byTrip.values()),
      report: { totalLoads, totalQty, totalPurchase, avgProcessTime, avgLoadWeight },
    },
  });
}
