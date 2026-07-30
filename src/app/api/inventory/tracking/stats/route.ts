import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { DEFAULT_INVENTORY_CONFIG } from "@/lib/inventory/inventoryConfig";
import { BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";
import type { TrackingStats } from "@/lib/contracts/inventoryTracking";

// GET /api/inventory/tracking/stats — tiles for the tracking dashboard.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "inventory.tracking");
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const nearExpiryDays = Number(DEFAULT_INVENTORY_CONFIG.fields.nearExpiryDays) || 30;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const nearStr = new Date(today.getTime() + nearExpiryDays * 86400000).toISOString().slice(0, 10);

  const notBucket = { notIn: BUCKET_WAREHOUSES };
  const [batchGroups, expLots, serialGroups] = await Promise.all([
    prisma.inventoryLot.groupBy({ by: ["batchNo"], where: { ...sw, batchNo: { not: null }, qtyOnHand: { gt: 0 }, warehouse: notBucket } }),
    prisma.inventoryLot.findMany({ where: { ...sw, expiryDate: { not: null }, qtyOnHand: { gt: 0 }, warehouse: notBucket }, select: { expiryDate: true } }),
    prisma.qrCodeMapping.groupBy({ by: ["status"], where: { ...sw, serialNo: { not: null }, warehouse: notBucket }, _count: { _all: true } }),
  ]);

  let nearExpiry = 0, expired = 0;
  for (const l of expLots) {
    const e = l.expiryDate ?? "";
    if (e && e < todayStr) expired++;
    else if (e && e <= nearStr) nearExpiry++;
  }
  const sCount = (s: string) => serialGroups.find((g) => g.status === s)?._count._all ?? 0;
  const serialOther = serialGroups.reduce((n, g) => n + g._count._all, 0) - sCount("Active") - sCount("Sold") - sCount("Returned") - sCount("Quarantine");

  const stats: TrackingStats = {
    totalBatches: batchGroups.length, nearExpiry, expired,
    serialAvailable: sCount("Active"), serialSold: sCount("Sold"), serialReturned: sCount("Returned") + sCount("Quarantine"), serialOther,
  };
  return NextResponse.json({ ok: true, stats });
}
