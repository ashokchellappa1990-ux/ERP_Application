import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * GET /api/pos/batches?productId=123
 * Available batches of a product in the active branch's stock — for the billing
 * screen's batch picker when a batch-tracked product is added by search (one
 * product may have several batches on hand). Drawn from inventory lots with stock
 * left, aggregated per (batch · mfg · expiry) and ranked by the product's
 * valuation method: FEFO (earliest expiry first) or FIFO (oldest received first).
 * Each batch carries its 1-based `priority`; the billing screen validates the
 * picked / scanned batch against priority 1 per the product's batch-sales policy.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const productId = Number(new URL(req.url).searchParams.get("productId"));
  if (!productId) return NextResponse.json({ ok: true, batches: [], valuation: null, batchSalesPolicy: null, order: null, enforce: false });

  const product = await prisma.product.findFirst({ where: { tenantId: user.tenantId, id: productId }, select: { valuation: true, batchSalesPolicy: true } });
  const valuation = product?.valuation || "fifo"; // default FIFO when unset
  const policy = product?.batchSalesPolicy || "warn";
  const enforce = valuation !== "notRequired"; // notRequired → no priority validation

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const orderBy = valuation === "fefo"
    ? [{ expiryDate: "asc" as const }, { receivedDate: "asc" as const }, { id: "asc" as const }]
    : [{ receivedDate: "asc" as const }, { id: "asc" as const }];
  const lots = await prisma.inventoryLot.findMany({
    where: { ...sw, productId, qtyOnHand: { gt: 0 }, warehouse: { notIn: BUCKET_WAREHOUSES } },
    orderBy,
    select: { batchNo: true, mfgDate: true, expiryDate: true, qtyOnHand: true, sellingRate: true, purchaseRate: true },
  });

  // Aggregate lots that share the same batch / mfg / expiry into one pickable row,
  // preserving the valuation order so the first row is priority 1.
  const map = new Map<string, { batchNo: string | null; mfgDate: string | null; expiryDate: string | null; qtyOnHand: number; sellingRate: number; purchaseRate: number }>();
  for (const l of lots) {
    const key = `${l.batchNo ?? ""}|${l.mfgDate ?? ""}|${l.expiryDate ?? ""}`;
    const cur = map.get(key);
    if (cur) {
      cur.qtyOnHand += num(l.qtyOnHand);
    } else {
      map.set(key, {
        batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate,
        qtyOnHand: num(l.qtyOnHand), sellingRate: num(l.sellingRate), purchaseRate: num(l.purchaseRate),
      });
    }
  }
  const batches = [...map.values()].map((b, i) => ({ priority: i + 1, ...b, qtyOnHand: +b.qtyOnHand.toFixed(3) }));

  return NextResponse.json({
    ok: true,
    valuation,
    batchSalesPolicy: policy,
    order: valuation === "fefo" ? "FEFO" : valuation === "fifo" ? "FIFO" : null,
    enforce,
    batches,
  });
}
