import type { Prisma } from "@prisma/client";

/**
 * Inventory movement posting. Every stock activity (opening, purchase, inward,
 * sales, returns, adjustments…) is recorded as a signed row in `inventory_ledger`
 * and reflected in the per-product/warehouse `inventory_balances`. This is the
 * single entry point so future modules (purchase, POS, returns) reuse it.
 */

export type Direction = "IN" | "OUT";

export interface MovementInput {
  tenantId: number;
  businessId?: number | null; // segregation: stock is per business …
  branchId?: number | null;   // … and per branch (balance keyed by branch)
  productId: number;
  qrCode?: string | null;
  txnType: string; // OPENING | PURCHASE | INWARD | SALES | SALES_RETURN | PURCHASE_RETURN | ADJUSTMENT | TRANSFER_IN | TRANSFER_OUT | WASTAGE
  direction: Direction;
  qty: number;
  rate?: number | null;
  warehouse?: string | null;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  refType?: string | null;
  refId?: number | null;
  refNo?: string | null;
  grnId?: number | null;
  sellingRate?: number | null;
  txnDate: string; // YYYY-MM-DD
  remarks?: string | null;
  createdBy?: number | null;
}

export interface LotInput {
  tenantId: number;
  businessId?: number | null;
  branchId?: number | null;
  productId: number;
  warehouse?: string | null;
  batchNo?: string | null;
  grnId?: number | null;
  refType?: string | null;
  refId?: number | null;
  refNo?: string | null;
  receivedDate?: string | null;
  purchaseDate?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  qty: number;
  unitRate?: number | null;
  sellingRate?: number | null;
}

/** What a consumption took from stock — COGS plus the (first) batch consumed, so
 * the sale line can record which batch/mfg/expiry went out, and the source GRN id
 * of that lot (for GRN → sale traceability on the ledger). */
export interface ConsumeResult {
  cost: number;
  taken: number; // qty actually drawn from lots (may be < requested if short)
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  grnId: number | null;
}

const WH = (w?: string | null) => (w && w.trim() ? w.trim() : "Main Store");

/** Find-or-create the per-branch stock balance for a product/warehouse. Keyed by
 * branch so each branch carries its own on-hand independently (a null branch is a
 * legacy / all-branch balance). Uses find-then-create (not a compound upsert) so
 * a nullable branchId works in the lookup. */
async function ensureBalance(tx: Prisma.TransactionClient, tenantId: number, branchId: number | null, productId: number, warehouse: string, businessId?: number | null) {
  const existing = await tx.inventoryBalance.findFirst({ where: { tenantId, branchId: branchId ?? null, productId, warehouse } });
  if (existing) return existing;
  return tx.inventoryBalance.create({ data: { tenantId, businessId: businessId ?? undefined, branchId: branchId ?? undefined, productId, warehouse, qtyOnHand: 0, purchaseValue: 0, sellingValue: 0 } });
}

/** Post one stock movement: write the ledger row and update on-hand balance.
 * Valuation is unit-rate based — the balance carries the latest inbound purchase
 * & selling rate; purchaseValue = qtyOnHand × purchaseRate and
 * sellingValue = qtyOnHand × sellingRate. */
export async function postMovement(tx: Prisma.TransactionClient, m: MovementInput): Promise<number> {
  const warehouse = WH(m.warehouse);
  const bal = await ensureBalance(tx, m.tenantId, m.branchId ?? null, m.productId, warehouse, m.businessId);
  const signedQty = m.direction === "IN" ? m.qty : -m.qty;
  const newQty = +(Number(bal.qtyOnHand) + signedQty).toFixed(3);

  // Inbound movements set/refresh the purchase & selling rate; others keep the prior one.
  const priorRate = bal.purchaseRate != null ? Number(bal.purchaseRate) : null;
  const purchaseRate = m.direction === "IN" && m.rate != null ? m.rate : priorRate ?? m.rate ?? null;
  const newPurchaseValue = purchaseRate != null ? +(newQty * purchaseRate).toFixed(2) : Number(bal.purchaseValue);
  const priorSelling = bal.sellingRate != null ? Number(bal.sellingRate) : null;
  const sellingRate = m.direction === "IN" && m.sellingRate != null ? m.sellingRate : priorSelling;
  const newSellingValue = sellingRate != null ? +(newQty * sellingRate).toFixed(2) : Number(bal.sellingValue);
  // Per-movement values use this movement's own qty.
  const linePurchaseValue = m.rate != null ? +(m.qty * m.rate).toFixed(2) : null;
  const lineSellingValue = m.sellingRate != null ? +(m.qty * m.sellingRate).toFixed(2) : null;

  await tx.inventoryLedger.create({
    data: {
      tenantId: m.tenantId,
      businessId: m.businessId ?? undefined,
      branchId: m.branchId ?? undefined,
      productId: m.productId,
      qrCode: m.qrCode ?? null,
      txnType: m.txnType,
      direction: m.direction,
      qty: m.qty,
      purchaseRate: m.rate ?? null,
      sellingRate: m.sellingRate ?? null,
      purchaseValue: linePurchaseValue,
      sellingValue: lineSellingValue,
      balanceQty: newQty,
      warehouse,
      batchNo: m.batchNo ?? null,
      mfgDate: m.mfgDate ?? null,
      expiryDate: m.expiryDate ?? null,
      refType: m.refType ?? null,
      refId: m.refId ?? null,
      refNo: m.refNo ?? null,
      grnId: m.grnId ?? null,
      txnDate: m.txnDate,
      remarks: m.remarks ?? null,
      createdBy: m.createdBy ?? null,
    },
  });

  await tx.inventoryBalance.update({
    where: { id: bal.id },
    data: { qtyOnHand: newQty, purchaseValue: newPurchaseValue, sellingValue: newSellingValue, purchaseRate, sellingRate, lastMovementAt: new Date() },
  });
  return newQty;
}

/**
 * Reverse every ledger row that came from a given source reference and undo its
 * effect on balances (used when an opening-stock line is edited/regenerated so
 * the ledger never double-counts). The ledger is otherwise append-only history.
 */
export async function reverseRef(tx: Prisma.TransactionClient, tenantId: number, refType: string, refId: number) {
  const rows = await tx.inventoryLedger.findMany({ where: { tenantId, refType, refId } });
  for (const r of rows) {
    const warehouse = WH(r.warehouse);
    const bal = await ensureBalance(tx, tenantId, r.branchId ?? null, r.productId, warehouse, r.businessId);
    const undoQty = r.direction === "IN" ? -Number(r.qty) : Number(r.qty);
    const newQty = +(Number(bal.qtyOnHand) + undoQty).toFixed(3);
    const purchaseRate = bal.purchaseRate != null ? Number(bal.purchaseRate) : null;
    const sellingRate = bal.sellingRate != null ? Number(bal.sellingRate) : null;
    const newPurchaseValue = purchaseRate != null ? +(newQty * purchaseRate).toFixed(2) : Number(bal.purchaseValue);
    const newSellingValue = sellingRate != null ? +(newQty * sellingRate).toFixed(2) : Number(bal.sellingValue);
    await tx.inventoryBalance.update({
      where: { id: bal.id },
      data: { qtyOnHand: newQty, purchaseValue: newPurchaseValue, sellingValue: newSellingValue, lastMovementAt: new Date() },
    });
  }
  if (rows.length) await tx.inventoryLedger.deleteMany({ where: { tenantId, refType, refId } });
  // Stock layers from this source are removed too (balance already reversed above).
  await tx.inventoryLot.deleteMany({ where: { tenantId, refType, refId } });
}

/** Consume stock from the product's lots for an outbound movement (sales / issue).
 *  - When `opts.batchNo` is given (a specific batch was scanned/picked), only that
 *    batch's lot(s) are drawn down — so a batch-tracked sale depletes the exact batch.
 *  - Otherwise picking is FEFO (earliest expiry first) when `opts.fefo` is set
 *    (expiry-tracked products), else FIFO (oldest received first).
 * Returns the COGS plus the first batch/mfg/expiry consumed (for the sale line).
 * Lots can't go below zero; any shortfall is simply not costed. */
export async function consumeLots(
  tx: Prisma.TransactionClient,
  tenantId: number,
  branchId: number | null,
  productId: number,
  warehouse: string | null | undefined,
  qty: number,
  opts?: { batchNo?: string | null; fefo?: boolean },
): Promise<ConsumeResult> {
  const wh = WH(warehouse);
  const where: Prisma.InventoryLotWhereInput = { tenantId, branchId: branchId ?? null, productId, warehouse: wh, qtyOnHand: { gt: 0 } };
  if (opts?.batchNo) where.batchNo = opts.batchNo;
  const orderBy: Prisma.InventoryLotOrderByWithRelationInput[] = opts?.fefo
    ? [{ expiryDate: "asc" }, { receivedDate: "asc" }, { id: "asc" }]
    : [{ receivedDate: "asc" }, { id: "asc" }];
  const lots = await tx.inventoryLot.findMany({ where, orderBy });
  let remaining = qty;
  let cost = 0;
  let took: { batchNo: string | null; mfgDate: string | null; expiryDate: string | null; grnId: number | null } | null = null;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(lot.qtyOnHand));
    if (take > 0 && !took) took = { batchNo: lot.batchNo ?? null, mfgDate: lot.mfgDate ?? null, expiryDate: lot.expiryDate ?? null, grnId: lot.grnId ?? null };
    const rate = lot.purchaseRate != null ? Number(lot.purchaseRate) : 0;
    const sRate = lot.sellingRate != null ? Number(lot.sellingRate) : 0;
    cost += take * rate;
    const newQty = +(Number(lot.qtyOnHand) - take).toFixed(3);
    await tx.inventoryLot.update({ where: { id: lot.id }, data: { qtyOnHand: newQty, purchaseValue: +(newQty * rate).toFixed(2), sellingValue: +(newQty * sRate).toFixed(2) } });
    remaining -= take;
  }
  return {
    cost: +cost.toFixed(2),
    taken: +(qty - remaining).toFixed(3),
    batchNo: took?.batchNo ?? opts?.batchNo ?? null,
    mfgDate: took?.mfgDate ?? null,
    expiryDate: took?.expiryDate ?? null,
    grnId: took?.grnId ?? null,
  };
}

/** Create a stock layer / lot for an inbound receipt (one per receipt line) so
 * age-wise and batch/GRN/purchase-date balances can be reported. */
export async function addLot(tx: Prisma.TransactionClient, l: LotInput) {
  const warehouse = WH(l.warehouse);
  const purchaseValue = l.unitRate != null ? +(l.qty * l.unitRate).toFixed(2) : 0;
  const sellingValue = l.sellingRate != null ? +(l.qty * l.sellingRate).toFixed(2) : 0;
  await tx.inventoryLot.create({
    data: {
      tenantId: l.tenantId,
      businessId: l.businessId ?? undefined,
      branchId: l.branchId ?? undefined,
      productId: l.productId,
      warehouse,
      batchNo: l.batchNo ?? null,
      grnId: l.grnId ?? null,
      refType: l.refType ?? null,
      refId: l.refId ?? null,
      refNo: l.refNo ?? null,
      receivedDate: l.receivedDate ?? null,
      purchaseDate: l.purchaseDate ?? null,
      mfgDate: l.mfgDate ?? null,
      expiryDate: l.expiryDate ?? null,
      receivedQty: l.qty,
      qtyOnHand: l.qty,
      purchaseRate: l.unitRate ?? null,
      sellingRate: l.sellingRate ?? null,
      purchaseValue,
      sellingValue,
    },
  });
}
