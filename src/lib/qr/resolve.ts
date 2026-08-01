import { prisma } from "@/lib/db/prisma";

export interface ResolvedQr {
  productId: number;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  warehouse: string | null;
  status: string;
}

/**
 * Resolve a scanned barcode/QR code back to the product/batch it was generated
 * for. Looks up `QrCodeMapping` by its unique `code`, falling back to
 * `serialNo` (used by the batch/serial tracking module for manufacturer
 * serials/IMEIs). Returns null if the code is unknown or already consumed
 * (status other than "Active").
 */
export async function resolveQrCode(tenantId: number, code: string): Promise<ResolvedQr | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const row = await prisma.qrCodeMapping.findFirst({
    where: { tenantId, OR: [{ code: trimmed }, { serialNo: trimmed }] },
    select: { productId: true, batchNo: true, mfgDate: true, expiryDate: true, warehouse: true, status: true },
  });
  if (!row || row.status !== "Active") return null;
  return row;
}
