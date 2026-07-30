import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { DEFAULT_INVENTORY_CONFIG } from "@/lib/inventory/inventoryConfig";
import type { ExpiryTrackRow } from "@/lib/contracts/inventoryTracking";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/inventory/tracking/expiry?q=&warehouse=&filter=near|expired — expiry-wise
// stock from lots that carry an expiry date and still have quantity on hand.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "inventory.tracking");
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const warehouse = (url.searchParams.get("warehouse") ?? "").trim();
  const filter = url.searchParams.get("filter") ?? "all";
  const nearExpiryDays = Number(DEFAULT_INVENTORY_CONFIG.fields.nearExpiryDays) || 30;
  const sw = scopeWhere(await getActiveScope(user), { branch: true });

  const lots = await prisma.inventoryLot.findMany({
    where: { ...sw, expiryDate: { not: null }, qtyOnHand: { gt: 0 }, ...(warehouse ? { warehouse } : {}) },
    orderBy: { expiryDate: "asc" }, take: 2000,
  });
  if (!lots.length) return NextResponse.json({ ok: true, rows: [], nearExpiryDays });

  const prods = await prisma.product.findMany({ where: { id: { in: Array.from(new Set(lots.map((l) => l.productId))) } }, select: { id: true, name: true, sku: true } });
  const pMap = new Map(prods.map((p) => [p.id, p]));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let rows: ExpiryTrackRow[] = lots.map((l) => {
    const p = pMap.get(l.productId);
    const exp = new Date((l.expiryDate ?? "") + "T00:00:00");
    const remainingDays = isNaN(exp.getTime()) ? null : Math.round((exp.getTime() - today.getTime()) / 86400000);
    const status = remainingDays == null ? "Normal" : remainingDays < 0 ? "Expired" : remainingDays <= nearExpiryDays ? "Near Expiry" : "Normal";
    return {
      key: `lot-${l.id}`, productId: l.productId, product: p?.name ?? `#${l.productId}`, sku: p?.sku ?? "",
      batchNo: l.batchNo ?? "", warehouse: l.warehouse, mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
      remainingDays, available: num(l.qtyOnHand), status,
    };
  });
  if (filter === "near") rows = rows.filter((r) => r.status === "Near Expiry");
  else if (filter === "expired") rows = rows.filter((r) => r.status === "Expired");
  if (q) rows = rows.filter((r) => r.product.toLowerCase().includes(q) || r.batchNo.toLowerCase().includes(q));
  return NextResponse.json({ ok: true, rows, nearExpiryDays });
}
