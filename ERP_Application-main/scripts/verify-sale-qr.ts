/**
 * Rolled-back verification of per-code sale posting (postSaleLineMovements).
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-sale-qr.ts
 * Everything happens inside one transaction that throws __RB__ to roll back.
 */
import { prisma } from "../src/lib/db/prisma";
import { addLot } from "../src/lib/inventory/ledger";
import { postSaleLineMovements } from "../src/lib/sales/postSaleLine";

const T = 4, BR = 5;

async function main() {
  const prod = await prisma.product.findFirst({ where: { tenantId: T }, select: { id: true } });
  if (!prod) { console.log("no product"); return; }
  const P = prod.id;

  await prisma.$transaction(async (tx) => {
    // Stock: two batches with plenty of qty.
    await addLot(tx as any, { tenantId: T, branchId: BR, productId: P, warehouse: "Main Store", batchNo: "VB1", refType: "GRN", refId: 90001, grnId: 90001, receivedDate: "2026-01-01", expiryDate: "2027-01-01", qty: 50, unitRate: 10, sellingRate: 20 });
    await addLot(tx as any, { tenantId: T, branchId: BR, productId: P, warehouse: "Main Store", batchNo: "VB2", refType: "GRN", refId: 90002, grnId: 90002, receivedDate: "2026-02-01", expiryDate: "2027-02-01", qty: 50, unitRate: 12, sellingRate: 22 });

    // QR mappings: 2 unique (batch VB1) + 1 shared (batch VB2).
    const mk = (code: string, mode: string, batch: string) =>
      tx.qrCodeMapping.create({ data: { code, tenantId: T, sourceType: "GRN", sourceId: 90001, productId: P, seq: 1, mode, status: "Active", batchNo: batch } });
    await mk("VQ-UNIQ-1", "unique", "VB1");
    await mk("VQ-UNIQ-2", "unique", "VB1");
    await mk("VQ-SHARED", "shared", "VB2");

    // A sale + two lines.
    const sale = await tx.sale.create({ data: { tenantId: T, businessId: 3, branchId: BR, invoiceNo: "VERIFY-TMP", saleDate: "2026-06-24", warehouse: "Main Store", status: "Completed" } });
    const line1 = await tx.saleLine.create({ data: { saleId: sale.id, productId: P, productName: "verify-unique", qty: 2, rate: 20, batchNo: "VB1" } });
    const line2 = await tx.saleLine.create({ data: { saleId: sale.id, productId: P, productName: "verify-mixed", qty: 3, rate: 22, batchNo: "VB2" } });

    const ctx = { tenantId: T, businessId: 3, branchId: BR, warehouse: "Main Store", saleId: sale.id, invoiceNo: "VERIFY-001", saleDate: "2026-06-24", createdBy: 8 };

    // Line 1: 2 unique codes (qty 2).
    const r1 = await postSaleLineMovements(tx as any, ctx, { id: line1.id, productId: P, qty: 2, rate: 20, batchNo: "VB1" }, ["VQ-UNIQ-1", "VQ-UNIQ-2"], { fefo: false });
    // Line 2: 1 shared code + qty 3 (so 0 unique → 1 remainder qty 3 tagged with shared).
    const r2 = await postSaleLineMovements(tx as any, ctx, { id: line2.id, productId: P, qty: 3, rate: 22, batchNo: "VB2" }, ["VQ-SHARED"], { fefo: false });

    const led = await tx.inventoryLedger.findMany({ where: { tenantId: T, refType: "SALES", refId: sale.id }, select: { qrCode: true, qty: true, batchNo: true, grnId: true }, orderBy: { id: "asc" } });
    const slq = await tx.saleLineQr.findMany({ where: { saleId: sale.id }, select: { saleLineId: true, code: true, mode: true, batchNo: true }, orderBy: { id: "asc" } });

    console.log("LINE1 cost:", r1.cost, " LINE2 cost:", r2.cost);
    console.log("ledger OUT rows (qrCode/qty/batch/grn):");
    for (const x of led) console.log("  ", x.qrCode, String(x.qty), x.batchNo, x.grnId);
    console.log("sale_line_qrs rows (line/code/mode/batch):");
    for (const x of slq) console.log("  ", x.saleLineId, x.code, x.mode, x.batchNo);

    const uniqueRows = led.filter((x) => x.qrCode === "VQ-UNIQ-1" || x.qrCode === "VQ-UNIQ-2");
    const sharedRow = led.find((x) => x.qrCode === "VQ-SHARED");
    console.log("\nASSERTIONS:");
    console.log("  2 unique OUT rows, qty 1 each:", uniqueRows.length === 2 && uniqueRows.every((x) => Number(x.qty) === 1));
    console.log("  distinct unique qrCodes:", new Set(uniqueRows.map((x) => x.qrCode)).size === 2);
    console.log("  shared remainder row qty 3:", !!sharedRow && Number(sharedRow.qty) === 3);
    console.log("  sale_line_qrs count = 3:", slq.length === 3);
    console.log("  line1 has 2 qr rows, line2 has 1:", slq.filter((x) => x.saleLineId === line1.id).length === 2 && slq.filter((x) => x.saleLineId === line2.id).length === 1);

    throw new Error("__RB__");
  }).catch((e) => { if (e.message !== "__RB__") throw e; console.log("\n(rolled back)"); });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
