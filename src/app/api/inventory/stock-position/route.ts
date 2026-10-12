import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { IN_TRANSIT_WAREHOUSE, BUCKET_WAREHOUSE } from "@/lib/inventory/buckets";
import type { StockPositionRow, StockPositionProduct, StockPositionResponse } from "@/lib/contracts/openingStock";

const num = (v: unknown) => (v == null ? 0 : Number(v));
// Non-sellable "damage / quarantine" buckets (Damage Store, Expired, Vendor Return,
// Scrap, Quarantine) — stock received into these shows in the Damage column, NOT the
// Receipt column, and is excluded from the sellable closing balance.
const DAMAGE_WH = new Set(Object.values(BUCKET_WAREHOUSE));

// GET /api/inventory/stock-position?productId=&brand=&from=&to=
// Day-wise OB / Receipt / Sales / Return / Damage / CB, derived from the ledger.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "inventory.inquiry");
  if (denied) return denied;

  const url = new URL(req.url);
  const productId = Number(url.searchParams.get("productId")) || 0;
  const brand = (url.searchParams.get("brand") ?? "").trim();
  const areaId = Number(url.searchParams.get("areaId")) || 0;
  const inventoryCategory = (url.searchParams.get("inventoryCategory") ?? "").trim();
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();

  // Exclude in-transit movements — dispatched stock not yet received is not branch stock.
  const where: Prisma.InventoryLedgerWhereInput = { ...scopeWhere(await getActiveScope(user), { branch: true }), warehouse: { not: IN_TRANSIT_WAREHOUSE } };
  if (productId) where.productId = productId;
  if (areaId) where.areaId = areaId;
  if (brand || inventoryCategory) where.product = { is: { ...(brand ? { brand } : {}), ...(inventoryCategory ? { inventoryCategory } : {}) } };

  // Pull all matching movements (so the opening balance carries correctly), then
  // bucket per day and run a cumulative balance.
  const rows = await prisma.inventoryLedger.findMany({
    where,
    orderBy: [{ txnDate: "asc" }, { id: "asc" }],
    select: { txnDate: true, txnType: true, direction: true, qty: true, warehouse: true, purchaseValue: true },
  });

  // inGood/outGood track only SELLABLE stock (damage-bucket movements are excluded)
  // so the closing balance reflects good on-hand; damage is a display-only column.
  // `wipCleared` tracks same-day MP_WIP_OUT + MP_WASTAGE separately so it can net
  // against that day's In-Transit (see below) — once WIP is fully processed the
  // same day it was issued, none of it is still "in transit", so it shouldn't
  // keep showing under In-Transit once it's shown under Transfer Out / Wastage.
  interface Bucket { receipt: number; ret: number; sales: number; purchaseRet: number; transfer: number; inTransit: number; wastage: number; damage: number; inGood: number; outGood: number; wipCleared: number }
  const dayMap = new Map<string, Bucket>();
  for (const r of rows) {
    const d = r.txnDate || "—";
    const b = dayMap.get(d) ?? { receipt: 0, ret: 0, sales: 0, purchaseRet: 0, transfer: 0, inTransit: 0, wastage: 0, damage: 0, inGood: 0, outGood: 0, wipCleared: 0 };
    const q = num(r.qty);
    if (DAMAGE_WH.has(r.warehouse ?? "")) {
      // Movement into/out of a damage / quarantine bucket — hidden from this
      // report's UI but still kept OUT of the sellable balance (so a damaged
      // receipt does NOT inflate Receipt or CB).
      b.damage += q;
    } else if (r.txnType === "MP_WIP_IN") {
      // WIP's entry leg — the raw material already left "available" stock via
      // MP_ISSUE's In-Transit deduction below; counting its arrival in WIP
      // again here would just cancel that deduction back out.
    } else if (r.txnType === "MP_WIP_OUT") {
      // WIP's exit leg once processing completes — display-only under
      // Transfer Out (for traceability) but no further CB impact, since this
      // raw material was already removed from "available" stock at Issue.
      b.transfer += q;
      b.wipCleared += q;
    } else if (r.txnType === "MP_WASTAGE") {
      // Process loss recognized at Complete — display-only under Wastage, no
      // further CB impact for the same reason as MP_WIP_OUT above.
      b.wastage += q;
      b.wipCleared += q;
    } else if (r.direction === "IN") {
      b.inGood += q;
      if (r.txnType === "SALES_RETURN") b.ret += q;
      else b.receipt += q; // opening / purchase / inward / transfer-in / receipt-accepted / FG receipt from processing
    } else {
      b.outGood += q;
      if (r.txnType === "SALES") b.sales += q;
      else if (r.txnType === "PURCHASE_RETURN") b.purchaseRet += q; // returned to supplier
      else if (r.txnType.startsWith("TRANSFER")) b.transfer += q; // internal transfer dispatch
      else if (r.txnType === "MP_ISSUE") b.inTransit += q; // raw material issued into Material Processing (now in WIP)
      else b.damage += q; // wastage / scrap / adjustment-out from good stock
    }
    dayMap.set(d, b);
  }

  const dates = Array.from(dayMap.keys()).sort();
  let running = 0;
  const all: StockPositionRow[] = dates.map((date) => {
    const b = dayMap.get(date)!;
    const ob = +running.toFixed(3);
    const cb = +(ob + b.inGood - b.outGood).toFixed(3); // sellable good stock only
    running = cb;
    // Net In-Transit against the same day's WIP clearance — once fully moved
    // to Transfer Out / Wastage the same day it was issued, it's no longer
    // "pending" and shouldn't keep showing as In-Transit too.
    const inTransitNet = +Math.max(0, b.inTransit - b.wipCleared).toFixed(3);
    return { date, ob, receipt: +b.receipt.toFixed(3), ret: +b.ret.toFixed(3), sales: +b.sales.toFixed(3), purchaseRet: +b.purchaseRet.toFixed(3), transfer: +b.transfer.toFixed(3), inTransit: inTransitNet, wastage: +b.wastage.toFixed(3), damage: +b.damage.toFixed(3), cb };
  });

  // Opening balance entering the window (closing of the last day before `from`).
  let openingBalance = 0;
  for (const r of all) { if (from && r.date < from) openingBalance = r.cb; else break; }

  // Filter to the requested window (OB already carried from before `from`).
  const win = all.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));

  // Header: product (if single) + current closing balance.
  let product: StockPositionProduct | null = null;
  if (productId) {
    const p = await prisma.product.findFirst({ where: { id: productId, tenantId: user.tenantId }, select: { id: true, name: true, sku: true, code: true, brand: true } });
    if (p) product = { id: p.id, name: p.name, sku: p.sku ?? p.code ?? "", brand: p.brand ?? "" };
  }

  const res: StockPositionResponse = {
    ok: true,
    product,
    rows: win,
    openingBalance: +openingBalance.toFixed(3),
    closing: all.length ? all[all.length - 1].cb : 0,
    totals: win.reduce((t, r) => ({ receipt: t.receipt + r.receipt, ret: t.ret + r.ret, sales: t.sales + r.sales, purchaseRet: t.purchaseRet + r.purchaseRet, transfer: t.transfer + r.transfer, inTransit: t.inTransit + r.inTransit, wastage: t.wastage + r.wastage, damage: t.damage + r.damage }), { receipt: 0, ret: 0, sales: 0, purchaseRet: 0, transfer: 0, inTransit: 0, wastage: 0, damage: 0 }),
  };
  return NextResponse.json(res);
}
