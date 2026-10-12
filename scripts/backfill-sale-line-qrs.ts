/**
 * Backfill existing sales into the new per-code model:
 *  - create sale_line_qrs rows from each sale line's legacy `qrCodes` CSV
 *  - split the single SALES OUT inventory_ledger row into one row per code (+ a
 *    remainder row for un-coded units). Net qty/value is preserved, so
 *    inventory_balances are NOT touched (balanceQty snapshots are historical).
 *
 * Dry-run by default (prints + rolls back). Pass `--apply` to commit.
 *   node_modules/.bin/tsx --env-file=.env scripts/backfill-sale-line-qrs.ts
 *   node_modules/.bin/tsx --env-file=.env scripts/backfill-sale-line-qrs.ts --apply
 */
import { prisma } from "../src/lib/db/prisma";

const APPLY = process.argv.includes("--apply");

async function run() {
  let slqCreated = 0, ledgerSplit = 0, ledgerSkipped = 0;
  const unmatched: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Lines that still carry the legacy CSV.
    const lines = await tx.saleLine.findMany({
      where: { qrCodes: { not: null } },
      select: { id: true, saleId: true, productId: true, qty: true, qrCodes: true, batchNo: true, mfgDate: true, expiryDate: true,
        sale: { select: { tenantId: true, businessId: true, branchId: true } } },
    });
    console.log(`Found ${lines.length} sale line(s) with legacy qrCodes CSV.`);

    for (const l of lines) {
      const codes = [...new Set((l.qrCodes ?? "").split(",").map((c) => c.trim()).filter(Boolean))];
      if (!codes.length) continue;
      const tenantId = l.sale.tenantId;
      const maps = await tx.qrCodeMapping.findMany({ where: { tenantId, code: { in: codes } }, select: { id: true, code: true, mode: true, batchNo: true, mfgDate: true, expiryDate: true } });
      const byCode = new Map(maps.map((m) => [m.code, m]));

      // 1) sale_line_qrs (idempotent: skip codes already linked to this line).
      const existing = new Set((await tx.saleLineQr.findMany({ where: { saleLineId: l.id }, select: { code: true } })).map((x) => x.code));
      for (const code of codes) {
        const m = byCode.get(code);
        if (!m) { unmatched.push(code); continue; }
        if (existing.has(code)) continue;
        if (APPLY) await tx.saleLineQr.create({ data: {
          tenantId, businessId: l.sale.businessId ?? undefined, branchId: l.sale.branchId ?? undefined,
          saleId: l.saleId, saleLineId: l.id, qrCodeMappingId: m.id, productId: l.productId,
          code, mode: m.mode, batchNo: m.batchNo ?? l.batchNo, mfgDate: m.mfgDate ?? l.mfgDate, expiryDate: m.expiryDate ?? l.expiryDate,
        } });
        slqCreated++;
      }

      // 2) Split the single OUT ledger row for this line into per-code rows.
      const uniqueCodes = codes.filter((c) => byCode.get(c)?.mode === "unique");
      const sharedCode = codes.find((c) => byCode.get(c)?.mode === "shared") ?? null;
      // The legacy code stored on the OUT row was codes[0]. Find that exact row.
      const out = await tx.inventoryLedger.findFirst({
        where: { tenantId, refType: "SALES", refId: l.saleId, productId: l.productId, direction: "OUT", qrCode: codes[0] },
      });
      const total = Number(l.qty);
      if (!out || Number(out.qty) !== total) { ledgerSkipped++; continue; }

      const rem = +(total - uniqueCodes.length).toFixed(3);
      const unit = uniqueCodes.length ? +(Number(out.purchaseValue ?? 0) / total).toFixed(2) : null;
      if (APPLY) {
        await tx.inventoryLedger.delete({ where: { id: out.id } });
        for (const code of uniqueCodes) {
          const m = byCode.get(code)!;
          await tx.inventoryLedger.create({ data: {
            tenantId, businessId: out.businessId, branchId: out.branchId, productId: l.productId, qrCode: code,
            txnType: out.txnType, direction: "OUT", qty: 1, purchaseRate: unit, sellingRate: out.sellingRate,
            purchaseValue: unit, sellingValue: out.sellingRate, balanceQty: out.balanceQty, warehouse: out.warehouse,
            batchNo: m.batchNo ?? out.batchNo, mfgDate: m.mfgDate ?? out.mfgDate, expiryDate: m.expiryDate ?? out.expiryDate,
            refType: "SALES", refId: l.saleId, refNo: out.refNo, grnId: out.grnId, txnDate: out.txnDate, createdBy: out.createdBy,
          } });
        }
        if (rem > 0) await tx.inventoryLedger.create({ data: {
          tenantId, businessId: out.businessId, branchId: out.branchId, productId: l.productId, qrCode: sharedCode,
          txnType: out.txnType, direction: "OUT", qty: rem, purchaseRate: out.purchaseRate, sellingRate: out.sellingRate,
          purchaseValue: out.purchaseRate != null ? +(rem * Number(out.purchaseRate)).toFixed(2) : null, sellingValue: out.sellingRate != null ? +(rem * Number(out.sellingRate)).toFixed(2) : null,
          balanceQty: out.balanceQty, warehouse: out.warehouse, batchNo: out.batchNo, mfgDate: out.mfgDate, expiryDate: out.expiryDate,
          refType: "SALES", refId: l.saleId, refNo: out.refNo, grnId: out.grnId, txnDate: out.txnDate, createdBy: out.createdBy,
        } });
      }
      ledgerSplit++;
    }

    console.log(`\n${APPLY ? "APPLIED" : "DRY-RUN"} — sale_line_qrs created: ${slqCreated}, ledger rows split: ${ledgerSplit}, ledger skipped (no single matching OUT row): ${ledgerSkipped}`);
    if (unmatched.length) console.log(`Codes referenced by a sale but with NO qr_code_mappings row (unrecoverable): ${[...new Set(unmatched)].join(", ")}`);
    console.log("Note: codes never captured at sale time (e.g. dropped shared/searched scans) are not in any CSV and cannot be backfilled — re-sell to record them.");

    if (!APPLY) throw new Error("__RB__");
  }).catch((e) => { if (e.message !== "__RB__") throw e; console.log("(rolled back — dry run)"); });
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
