import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { IN_TRANSIT_WAREHOUSE, BUCKET_WAREHOUSE } from "@/lib/inventory/buckets";
import type { StockPositionBucket, StockPositionDetailRow, StockPositionDetailResponse } from "@/lib/contracts/openingStock";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const DAMAGE_WH = new Set(Object.values(BUCKET_WAREHOUSE));
const BUCKETS: StockPositionBucket[] = ["receipt", "ret", "sales", "purchaseRet", "transfer", "inTransit", "wastage", "damage"];

// GET /api/inventory/stock-position/detail?productId=&date=&bucket=
// Row-level drill-in for one cell of the Stock Position table — same
// bucketing rules as stock-position/route.ts, but returns the individual
// ledger rows (date + ref/GRN-wise) instead of the aggregated day total.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "inventory.inquiry");
  if (denied) return denied;

  const url = new URL(req.url);
  const productId = Number(url.searchParams.get("productId")) || 0;
  const date = (url.searchParams.get("date") ?? "").trim();
  const bucket = (url.searchParams.get("bucket") ?? "") as StockPositionBucket;
  const areaId = Number(url.searchParams.get("areaId")) || 0;
  if (!productId || !date || !BUCKETS.includes(bucket)) {
    return NextResponse.json({ ok: false, message: "productId, date and a valid bucket are required." }, { status: 422 });
  }

  const where: Prisma.InventoryLedgerWhereInput = {
    ...scopeWhere(await getActiveScope(user), { branch: true }),
    warehouse: { not: IN_TRANSIT_WAREHOUSE },
    productId, txnDate: date,
  };
  if (areaId) where.areaId = areaId;

  const rows = await prisma.inventoryLedger.findMany({
    where,
    orderBy: { id: "asc" },
    select: { id: true, txnType: true, direction: true, qty: true, purchaseRate: true, purchaseValue: true, warehouse: true, areaId: true, refType: true, refNo: true, grnId: true, batchNo: true, createdAt: true },
  });

  // Same per-row classification as the day-wise bucketing in stock-position/route.ts.
  const matches = rows.filter((r) => {
    if (DAMAGE_WH.has(r.warehouse ?? "")) return bucket === "damage";
    // WIP's entry leg is the other side of MP_ISSUE's In-Transit row —
    // excluded from every bucket so it's never double-counted.
    if (r.txnType === "MP_WIP_IN") return false;
    if (r.txnType === "MP_WIP_OUT") return bucket === "transfer";
    if (r.txnType === "MP_WASTAGE") return bucket === "wastage";
    if (r.direction === "IN") {
      if (bucket === "ret") return r.txnType === "SALES_RETURN";
      return bucket === "receipt" && r.txnType !== "SALES_RETURN";
    }
    if (bucket === "sales") return r.txnType === "SALES";
    if (bucket === "purchaseRet") return r.txnType === "PURCHASE_RETURN";
    if (bucket === "transfer") return r.txnType.startsWith("TRANSFER");
    if (bucket === "inTransit") return r.txnType === "MP_ISSUE";
    return bucket === "damage"; // wastage / scrap / adjustment-out from good stock
  });

  const areaIds = Array.from(new Set(matches.map((r) => r.areaId).filter((v): v is number => v != null)));
  const areas = areaIds.length ? await prisma.area.findMany({ where: { id: { in: areaIds }, tenantId: user.tenantId }, select: { id: true, name: true } }) : [];
  const areaName = new Map(areas.map((a) => [a.id, a.name]));

  const shaped: StockPositionDetailRow[] = matches.map((r) => ({
    id: r.id, txnType: r.txnType, refType: r.refType ?? "", refNo: r.refNo ?? "", grnId: r.grnId ?? null,
    qty: num(r.qty), rate: r.purchaseRate != null ? num(r.purchaseRate) : null, value: r.purchaseValue != null ? num(r.purchaseValue) : null,
    warehouse: r.warehouse ?? "", areaName: r.areaId != null ? (areaName.get(r.areaId) ?? "") : "",
    batchNo: r.batchNo ?? "", createdAt: r.createdAt.toISOString(),
  }));

  const res: StockPositionDetailResponse = {
    ok: true, date, bucket, rows: shaped,
    totalQty: +shaped.reduce((s, r) => s + r.qty, 0).toFixed(3),
    totalValue: +shaped.reduce((s, r) => s + (r.value ?? 0), 0).toFixed(2),
  };
  return NextResponse.json(res);
}
