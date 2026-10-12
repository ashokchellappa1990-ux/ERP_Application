import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { SerialHistoryEvent, SerialHistoryResponse } from "@/lib/contracts/inventoryTracking";

// GET /api/inventory/tracking/serials/[id] — one serial + its full lifecycle history
// (receipt → sale → return/exchange) stitched from QR/sale/return links + audit.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "inventory.tracking");
  if (denied) return denied;

  const m = await prisma.qrCodeMapping.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!m) return NextResponse.json({ ok: false, message: "Serial not found." }, { status: 404 });

  const [product, grn, saleLinks, returnLinks] = await Promise.all([
    prisma.product.findUnique({ where: { id: m.productId }, select: { name: true, sku: true } }),
    m.grnId ? prisma.goodsReceiptNote.findUnique({ where: { id: m.grnId }, select: { grnNo: true, grnDate: true, supplier: true } }) : Promise.resolve(null),
    prisma.saleLineQr.findMany({ where: { tenantId: user.tenantId, qrCodeMappingId: m.id }, include: { sale: { select: { invoiceNo: true, saleDate: true, customerName: true } } }, orderBy: { id: "asc" } }),
    prisma.salesReturnQr.findMany({ where: { tenantId: user.tenantId, qrCodeMappingId: m.id }, include: { returnLine: { include: { salesReturn: { select: { returnNo: true, returnDate: true } } } } }, orderBy: { id: "asc" } }),
  ]);

  const events: SerialHistoryEvent[] = [];
  if (grn) events.push({ at: grn.grnDate ?? m.createdAt.toISOString().slice(0, 10), action: "Received (GRN)", detail: `${grn.grnNo}${grn.supplier ? ` · ${grn.supplier}` : ""}` });
  else events.push({ at: m.createdAt.toISOString().slice(0, 10), action: "Created", detail: "Stock in" });
  for (const s of saleLinks) events.push({ at: s.sale?.saleDate ?? "", action: "Sold", detail: `${s.sale?.invoiceNo ?? ""}${s.sale?.customerName ? ` · ${s.sale.customerName}` : ""}` });
  for (const r of returnLinks) events.push({ at: r.returnLine?.salesReturn?.returnDate ?? "", action: "Returned", detail: r.returnLine?.salesReturn?.returnNo ?? "" });
  const audits = await prisma.auditLog.findMany({ where: { tenantId: user.tenantId, entity: "QrCodeMapping", entityId: String(m.id) }, orderBy: { id: "asc" }, take: 50 });
  for (const a of audits) events.push({ at: a.createdAt.toISOString().slice(0, 10), action: a.action, detail: a.summary ?? "" });
  events.sort((a, b) => (a.at || "").localeCompare(b.at || ""));

  const data: SerialHistoryResponse = {
    ok: true,
    serial: {
      id: m.id, serialNo: m.serialNo ?? "", code: m.code, productId: m.productId, product: product?.name ?? `#${m.productId}`, sku: product?.sku ?? "",
      batchNo: m.batchNo ?? "", warehouse: m.warehouse ?? "", status: m.status === "Active" ? "Available" : m.status,
      purchaseRef: grn?.grnNo ?? "", salesInvoice: m.soldInvoiceNo ?? "", customer: m.customerName ?? "",
      warrantyStart: m.warrantyStart ?? "", warrantyEnd: m.warrantyEnd ?? "",
      mfgDate: m.mfgDate ?? "", expiryDate: m.expiryDate ?? "", activatedAt: m.activatedAt ? m.activatedAt.toISOString().slice(0, 10) : "",
    },
    events,
  };
  return NextResponse.json(data);
}
