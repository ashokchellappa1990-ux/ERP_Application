import type { Prisma } from "@prisma/client";
import { postMovement, consumeLots } from "@/lib/inventory/ledger";

/**
 * Post the inventory OUT movements + per-code `sale_line_qrs` records for ONE sale
 * line, mirroring how GRN unique-mode posting writes one ledger row per code
 * (`src/lib/qr/generate.ts`). For each scanned UNIQUE code: one OUT movement
 * (qty 1, that code) + one `sale_line_qrs` row, consuming that code's batch. The
 * remaining qty (manual units / shared-front units) posts ONE aggregate OUT
 * movement (carrying a scanned shared code when present). Returns the line COGS
 * and the first consumed batch (to stamp the sale line).
 *
 * NOTE for a future sales-return/void path: reverse with
 * `reverseRef(tx, tenantId, "SALES", saleId)`, flip the linked `qr_code_mappings`
 * back to Active (clear soldSaleId), and delete the `sale_line_qrs` rows.
 */
export interface SaleLineCtx {
  tenantId: number;
  businessId?: number | null;
  branchId?: number | null;
  warehouse: string;
  saleId: number;
  invoiceNo: string;
  saleDate: string;
  createdBy?: number | null;
}

export interface SaleLineRow {
  id: number;
  productId: number;
  qty: Prisma.Decimal | number | string;
  rate: Prisma.Decimal | number | string | null;
  batchNo: string | null;
}

export async function postSaleLineMovements(
  tx: Prisma.TransactionClient,
  ctx: SaleLineCtx,
  line: SaleLineRow,
  codes: string[],
  opts: { fefo: boolean },
): Promise<{ cost: number; batchNo: string | null; mfgDate: string | null; expiryDate: string | null }> {
  const qty = Number(line.qty);
  const sellingRate = line.rate != null ? Number(line.rate) : null;
  const branchId = ctx.branchId ?? null;
  const base = {
    tenantId: ctx.tenantId, businessId: ctx.businessId ?? null, branchId,
    productId: line.productId, txnType: "SALES", direction: "OUT" as const, warehouse: ctx.warehouse,
    sellingRate, refType: "SALES", refId: ctx.saleId, refNo: ctx.invoiceNo, txnDate: ctx.saleDate, createdBy: ctx.createdBy ?? null,
  };

  // Validation upstream guarantees every code resolves to a mapping.
  const mappings = codes.length
    ? await tx.qrCodeMapping.findMany({ where: { tenantId: ctx.tenantId, code: { in: codes } }, select: { id: true, code: true, mode: true, batchNo: true, mfgDate: true, expiryDate: true } })
    : [];
  const byCode = new Map(mappings.map((m) => [m.code, m]));
  const uniqueCodes = codes.filter((c) => byCode.get(c)?.mode === "unique");
  const sharedCodes = codes.filter((c) => byCode.get(c)?.mode === "shared");

  let totalCost = 0;
  let first: { batchNo: string | null; mfgDate: string | null; expiryDate: string | null } | null = null;

  // 1) One OUT row + one sale_line_qrs row per scanned UNIQUE code (qty 1 each).
  for (const code of uniqueCodes) {
    const m = byCode.get(code)!;
    let res = await consumeLots(tx, ctx.tenantId, branchId, line.productId, ctx.warehouse, 1, { batchNo: m.batchNo ?? line.batchNo, fefo: opts.fefo });
    // Depleted/mismatched batch → fall back to unconstrained FEFO/FIFO so COGS isn't lost.
    if (res.taken < 1) res = await consumeLots(tx, ctx.tenantId, branchId, line.productId, ctx.warehouse, 1, { fefo: opts.fefo });
    totalCost += res.cost;
    if (!first) first = { batchNo: res.batchNo, mfgDate: res.mfgDate, expiryDate: res.expiryDate };
    await postMovement(tx, { ...base, qty: 1, rate: res.cost, qrCode: code, batchNo: res.batchNo, mfgDate: res.mfgDate, expiryDate: res.expiryDate, grnId: res.grnId });
    await tx.saleLineQr.create({ data: {
      tenantId: ctx.tenantId, businessId: ctx.businessId ?? undefined, branchId: ctx.branchId ?? undefined,
      saleId: ctx.saleId, saleLineId: line.id, qrCodeMappingId: m.id, productId: line.productId,
      code, mode: "unique", batchNo: res.batchNo, mfgDate: res.mfgDate, expiryDate: res.expiryDate,
    } });
  }

  // 2) Remainder (manual units + shared-front units) → ONE aggregate OUT movement,
  //    tagged with a scanned shared code when one was used.
  const rem = +(qty - uniqueCodes.length).toFixed(3);
  if (rem > 0) {
    const res = await consumeLots(tx, ctx.tenantId, branchId, line.productId, ctx.warehouse, rem, { batchNo: line.batchNo, fefo: opts.fefo });
    const unitCost = +(res.cost / rem).toFixed(2);
    totalCost += res.cost;
    if (!first) first = { batchNo: res.batchNo, mfgDate: res.mfgDate, expiryDate: res.expiryDate };
    await postMovement(tx, { ...base, qty: rem, rate: unitCost, qrCode: sharedCodes[0] ?? null, batchNo: res.batchNo, mfgDate: res.mfgDate, expiryDate: res.expiryDate, grnId: res.grnId });
  }

  // 3) One sale_line_qrs row per scanned SHARED code (the code fronts the line).
  for (const code of sharedCodes) {
    const m = byCode.get(code)!;
    await tx.saleLineQr.create({ data: {
      tenantId: ctx.tenantId, businessId: ctx.businessId ?? undefined, branchId: ctx.branchId ?? undefined,
      saleId: ctx.saleId, saleLineId: line.id, qrCodeMappingId: m.id, productId: line.productId,
      code, mode: "shared", batchNo: m.batchNo ?? first?.batchNo ?? null, mfgDate: m.mfgDate ?? null, expiryDate: m.expiryDate ?? null,
    } });
  }

  return { cost: +totalCost.toFixed(2), batchNo: first?.batchNo ?? null, mfgDate: first?.mfgDate ?? null, expiryDate: first?.expiryDate ?? null };
}
