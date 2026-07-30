import { Prisma } from "@prisma/client";

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
