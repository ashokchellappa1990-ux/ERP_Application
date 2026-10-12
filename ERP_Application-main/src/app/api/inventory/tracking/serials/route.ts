import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { IN_TRANSIT_WAREHOUSE } from "@/lib/inventory/buckets";
import type { SerialTrackRow } from "@/lib/contracts/inventoryTracking";

// GET /api/inventory/tracking/serials?q=&warehouse=&status= — serial-managed pieces.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "inventory.tracking");
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const warehouse = (url.searchParams.get("warehouse") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "All").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: true });

  // Serial tab = manufacturer serials ONLY (serialNo stamped at GRN when Product.invSerial is on).
  // Auto-generated unique QR codes (serialNo null) are NOT serials and must not appear here.
  const where: Prisma.QrCodeMappingWhereInput = { ...sw, serialNo: { not: null } };
  // Serials in transit (dispatched, not yet received) are excluded unless explicitly filtered.
  if (warehouse) where.warehouse = warehouse; else where.warehouse = { not: IN_TRANSIT_WAREHOUSE };
  if (status !== "All") where.status = status === "Available" ? "Active" : status;
  if (q) where.AND = [{ OR: [{ serialNo: { contains: q } }, { code: { contains: q } }, { customerName: { contains: q } }, { soldInvoiceNo: { contains: q } }, { batchNo: { contains: q } }] }];

  const rows = await prisma.qrCodeMapping.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  const productIds = Array.from(new Set(rows.map((r) => r.productId)));
  const grnIds = Array.from(new Set(rows.map((r) => r.grnId).filter((x): x is number => x != null)));
  const [prods, grns] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } }),
    grnIds.length ? prisma.goodsReceiptNote.findMany({ where: { id: { in: grnIds } }, select: { id: true, grnNo: true } }) : Promise.resolve([]),
  ]);
  const pMap = new Map(prods.map((p) => [p.id, p]));
  const gMap = new Map(grns.map((g) => [g.id, g.grnNo]));

  const shaped: SerialTrackRow[] = rows.map((r) => {
    const p = pMap.get(r.productId);
    return {
      id: r.id, serialNo: r.serialNo ?? "", code: r.code, productId: r.productId, product: p?.name ?? `#${r.productId}`, sku: p?.sku ?? "",
      batchNo: r.batchNo ?? "", warehouse: r.warehouse ?? "", status: r.status === "Active" ? "Available" : r.status,
      purchaseRef: r.grnId ? (gMap.get(r.grnId) ?? "") : "", salesInvoice: r.soldInvoiceNo ?? "", customer: r.customerName ?? "",
      warrantyStart: r.warrantyStart ?? "", warrantyEnd: r.warrantyEnd ?? "",
    };
  });
  return NextResponse.json({ ok: true, rows: shaped });
}
