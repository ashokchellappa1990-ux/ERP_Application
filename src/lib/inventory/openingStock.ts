import { Prisma } from "@prisma/client";
import { postMovement, addLot, reverseRef } from "@/lib/inventory/ledger";

/** Editor line shape coming from the Quick Stock Entry UI. */
interface LineInput {
  productId?: number;
  productName?: string;
  sku?: string;
  uom?: string;
  category?: string;
  qty?: string | number;
  mrp?: string | number;
  purchasePrice?: string | number;
  batchNo?: string;
  mfgDate?: string;
  expiryDate?: string;
  supplier?: string;
  purchaseRef?: string;
  purchaseDate?: string;
  remarks?: string;
}

const s = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return t ? t : null;
};
const dec = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : v;
  if (t === "" || t == null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export type BuiltDoc = {
  header: {
    asOnDate: string;
    warehouse: string | null;
    notes: string | null;
    status: string;
    totalQty: number;
    totalValue: number;
    lineCount: number;
  };
  lines: Prisma.OpeningStockLineCreateWithoutDocumentInput[];
  submit: boolean;
  productIds: number[];
};

/** Validate + normalise the editor payload into header + line create data. */
export function buildDocPayload(body: unknown): BuiltDoc | { error: string } {
  const b = (body ?? {}) as {
    asOnDate?: string; warehouse?: string; notes?: string; status?: string; lines?: LineInput[];
  };
  const status = b.status === "Submitted" ? "Submitted" : "Draft";
  const submit = status === "Submitted";

  const asOnDate = s(b.asOnDate);
  if (!asOnDate) return { error: "As-on date is required." };

  const raw = (b.lines ?? []).filter((l) => Number(l.productId) > 0 && Number(l.qty) > 0);
  if (!raw.length) return { error: "Add at least one product line with a quantity." };

  let totalQty = 0;
  let totalValue = 0;
  const productIds = new Set<number>();
  const lines: Prisma.OpeningStockLineCreateWithoutDocumentInput[] = raw.map((l) => {
    const qty = Number(l.qty) || 0;
    const mrp = dec(l.mrp);
    const purchasePrice = dec(l.purchasePrice);
    const value = qty * (purchasePrice ?? mrp ?? 0);
    totalQty += qty;
    totalValue += value;
    productIds.add(Number(l.productId));
    return {
      product: { connect: { id: Number(l.productId) } },
      productName: s(l.productName) ?? "",
      sku: s(l.sku),
      uom: s(l.uom),
      category: s(l.category),
      qty,
      mrp,
      purchasePrice,
      value,
      batchNo: s(l.batchNo),
      mfgDate: s(l.mfgDate),
      expiryDate: s(l.expiryDate),
      supplier: s(l.supplier),
      purchaseRef: s(l.purchaseRef),
      purchaseDate: s(l.purchaseDate),
      remarks: s(l.remarks),
    };
  });

  return {
    header: {
      asOnDate,
      warehouse: s(b.warehouse),
      notes: s(b.notes),
      status,
      totalQty,
      totalValue,
      lineCount: lines.length,
    },
    lines,
    submit,
    productIds: Array.from(productIds),
  };
}

/** Recompute each product's opening stock as the sum of all SUBMITTED opening
 * lines for that product (so re-submits and multi-doc entries stay consistent). */
export async function recomputeProductStock(tx: Prisma.TransactionClient, productIds: number[]) {
  for (const pid of productIds) {
    const agg = await tx.openingStockLine.aggregate({
      where: { productId: pid, document: { status: "Submitted" } },
      _sum: { qty: true, value: true },
    });
    await tx.product.update({
      where: { id: pid },
      data: { openingQty: Number(agg._sum.qty ?? 0), openingValue: Number(agg._sum.value ?? 0) },
    });
  }
}

/**
 * Products with `qrRequired = false` don't need the manual "Generate QR" step —
 * their opening-stock lines post straight to the inventory ledger the moment the
 * document is Submitted. QR-required products still wait for the explicit
 * Generate action (src/app/api/inventory/opening-stock/[id]/qr/route.ts), since
 * the ledger posting there is keyed to the generated code itself.
 *
 * Idempotent: reverses any prior posting for a line before re-posting, so a
 * doc that's edited and resubmitted never double-counts. Only touches lines
 * still `Pending` — once Generated (QR path), a line is left alone.
 */
export async function autoPostNonQrLines(
  tx: Prisma.TransactionClient,
  opts: { tenantId: number; userId: number; docId: number; businessId: number | null; branchId: number | null; warehouse: string | null; asOnDate: string; docNo: string },
) {
  const lines = await tx.openingStockLine.findMany({
    where: { openingStockId: opts.docId, qrStatus: "Pending", product: { qrRequired: false } },
    select: { id: true, productId: true, qty: true, purchasePrice: true, mrp: true, batchNo: true, mfgDate: true, expiryDate: true, purchaseDate: true },
  });
  for (const l of lines) {
    await reverseRef(tx, opts.tenantId, "OPENING", l.id);
    const qty = Number(l.qty);
    const rate = l.purchasePrice != null ? Number(l.purchasePrice) : l.mrp != null ? Number(l.mrp) : null;
    const sellingRate = l.mrp != null ? Number(l.mrp) : null;
    await postMovement(tx, {
      tenantId: opts.tenantId, businessId: opts.businessId ?? undefined, branchId: opts.branchId ?? undefined,
      productId: l.productId, txnType: "OPENING", direction: "IN", qty, rate, sellingRate, warehouse: opts.warehouse,
      batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate,
      refType: "OPENING", refId: l.id, refNo: opts.docNo, txnDate: opts.asOnDate, createdBy: opts.userId,
    });
    await addLot(tx, {
      tenantId: opts.tenantId, businessId: opts.businessId ?? undefined, branchId: opts.branchId ?? undefined,
      productId: l.productId, warehouse: opts.warehouse, batchNo: l.batchNo,
      refType: "OPENING", refId: l.id, refNo: opts.docNo, receivedDate: opts.asOnDate, purchaseDate: l.purchaseDate,
      mfgDate: l.mfgDate, expiryDate: l.expiryDate, qty, unitRate: rate, sellingRate,
    });
    await tx.openingStockLine.update({ where: { id: l.id }, data: { qrStatus: "Not Required", qrGeneratedCount: 0 } });
  }
}
