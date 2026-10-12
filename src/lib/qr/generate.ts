import type { Prisma } from "@prisma/client";
import { buildQrCode, type QrFormat } from "./codeFormat";
import { postMovement, reverseRef, addLot } from "../inventory/ledger";

/**
 * Generate QR code(s) for one receipt line (Opening Stock or GRN) and post the
 * stock into inventory (ledger + balance + lot). Returns the codes and the next
 * sequence number so the caller can advance the QR counter once per document.
 */
export interface GenLineOpts {
  tenantId: number;
  businessId?: number | null;
  branchId?: number | null;
  format: QrFormat;
  sourceType: "OPENING" | "GRN";
  sourceId: number;
  productId: number;
  sku: string | null;
  docNo: string;
  qty: number;
  // "none" — product's qrRequired is false: post inventory straight through, no QR codes.
  mode: "shared" | "unique" | "none";
  // inventory / lot context
  txnType: string; // OPENING | PURCHASE
  refType: string; // OPENING | GRN
  refNo: string;
  txnDate: string;
  rate?: number | null;
  sellingRate?: number | null;
  warehouse?: string | null;
  areaId?: number | null; // additive Area Config link (GRN only)
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  purchaseDate?: string | null;
  grnId?: number | null;
  createdBy?: number | null;
  serials?: string[] | null; // manufacturer serials (unique mode, serial-managed products)
}

export async function generateLineQr(tx: Prisma.TransactionClient, o: GenLineOpts, startSeq: number) {
  const qty = Math.round(o.qty);
  const count = o.mode === "unique" ? qty : o.mode === "shared" ? 1 : 0;

  await tx.qrCodeMapping.deleteMany({ where: { sourceType: o.sourceType, sourceId: o.sourceId } });
  const made: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = buildQrCode(o.format, o.docNo, o.sku, startSeq + i, o.mode === "unique");
    await tx.qrCodeMapping.create({ data: {
      code, tenantId: o.tenantId, businessId: o.businessId ?? undefined, branchId: o.branchId ?? undefined,
      sourceType: o.sourceType, sourceId: o.sourceId, productId: o.productId, seq: i + 1, mode: o.mode,
      batchNo: o.batchNo ?? null, mfgDate: o.mfgDate ?? null, expiryDate: o.expiryDate ?? null,
      warehouse: o.warehouse ?? null, grnId: o.grnId ?? null, status: "Active",
      serialNo: o.mode === "unique" ? (o.serials?.[i]?.trim() || null) : null,
    } });
    made.push(code);
  }

  // Inventory: replace any prior posting for this line, then post fresh movements + lot.
  await reverseRef(tx, o.tenantId, o.refType, o.sourceId);
  const base = {
    tenantId: o.tenantId, businessId: o.businessId ?? null, branchId: o.branchId ?? null, productId: o.productId, txnType: o.txnType, direction: "IN" as const,
    rate: o.rate ?? null, sellingRate: o.sellingRate ?? null, warehouse: o.warehouse, areaId: o.areaId ?? null, batchNo: o.batchNo, mfgDate: o.mfgDate, expiryDate: o.expiryDate,
    refType: o.refType, refId: o.sourceId, refNo: o.refNo, grnId: o.grnId ?? null, txnDate: o.txnDate, createdBy: o.createdBy,
  };
  if (o.mode === "unique") {
    for (const code of made) await postMovement(tx, { ...base, qrCode: code, qty: 1 });
  } else {
    // "shared" posts one movement carrying the single code; "none" posts the full qty with no code.
    await postMovement(tx, { ...base, qrCode: made[0] ?? null, qty });
  }
  await addLot(tx, {
    tenantId: o.tenantId, businessId: o.businessId ?? null, branchId: o.branchId ?? null, productId: o.productId, warehouse: o.warehouse, areaId: o.areaId ?? null, batchNo: o.batchNo, grnId: o.grnId ?? null,
    refType: o.refType, refId: o.sourceId, refNo: o.refNo, receivedDate: o.txnDate, purchaseDate: o.purchaseDate,
    mfgDate: o.mfgDate, expiryDate: o.expiryDate, qty, unitRate: o.rate ?? null, sellingRate: o.sellingRate ?? null,
  });

  return { codes: made, count, endSeq: startSeq + count };
}
