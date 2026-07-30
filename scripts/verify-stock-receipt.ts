import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { IN_TRANSIT_WAREHOUSE, BUCKET_WAREHOUSE, BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";
import { createDispatch, postDispatch } from "@/lib/warehouse/dispatch";
import { availabilityAt } from "@/lib/warehouse/dispatch";
import { loadDispatchForReceipt, createReceipt, postReceipt, getReceipt, listReceipts } from "@/lib/warehouse/receipt";

const user = { id: 1, tenantId: 4, fullName: "E2E Runner" } as any;
const SRC = 5, DST = 6;
const dispatchScope: ActiveScope = { tenantId: 4, businessId: 3, branchId: SRC, readBranchIds: [SRC, DST] } as any;
const receiptScope: ActiveScope = { tenantId: 4, businessId: 3, branchId: DST, readBranchIds: [SRC, DST] } as any;
const num = (v: unknown) => Number(v) || 0;
const MAIN = "Main Store", DAMAGE = BUCKET_WAREHOUSE.damaged;

async function bal(productId: number, branchId: number, warehouse: string) {
  return num((await prisma.inventoryBalance.aggregate({ where: { tenantId: 4, productId, branchId, warehouse }, _sum: { qtyOnHand: true } }))._sum.qtyOnHand);
}

async function main() {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("ASSERT FAIL: " + m); console.log("  ✓ " + m); };
  let dispatchId = 0, receiptId = 0, productId = 0;
  let snapBal: any[] = [], snapLot: any[] = [];
  try {
    console.log("0) pick product with lots at branch 5, snapshot inventory");
    const lot = await prisma.inventoryLot.findFirst({ where: { tenantId: 4, branchId: SRC, qtyOnHand: { gt: 8 }, warehouse: { notIn: BUCKET_WAREHOUSES } }, select: { productId: true } });
    productId = lot?.productId ?? 0;
    if (!productId) throw new Error("no lot at branch 5");
    const prod = await prisma.product.findFirst({ where: { id: productId }, select: { name: true } });
    console.log(`    product ${prod?.name} (#${productId})`);
    snapBal = await prisma.inventoryBalance.findMany({ where: { tenantId: 4, productId, branchId: { in: [SRC, DST] } }, select: { id: true, qtyOnHand: true, purchaseValue: true, sellingValue: true, purchaseRate: true, sellingRate: true } });
    snapLot = await prisma.inventoryLot.findMany({ where: { tenantId: 4, productId, branchId: { in: [SRC, DST] } }, select: { id: true, qtyOnHand: true, purchaseValue: true, sellingValue: true } });
    const qty = 5, damaged = 1, accepted = qty - damaged, sellPrice = 999;

    console.log("1) DISPATCH branch 5 → 6 (qty 5)");
    const av = await availabilityAt(dispatchScope, { productId, branchId: SRC });
    const cD = await createDispatch(dispatchScope, user, { dispatchType: "Direct Dispatch", destinationBranchId: DST, dispatchDate: "2026-07-10", priority: "Normal", items: [{ productId, productName: prod?.name || "P", availableQty: av.available, dispatchQty: qty, unitCost: av.unitCost }] } as any);
    dispatchId = cD.id;
    await postDispatch(dispatchScope, user, dispatchId);
    const transit0 = await bal(productId, DST, IN_TRANSIT_WAREHOUSE);
    assert(transit0 === qty, `in-transit at dest = ${transit0}`);

    console.log("2) LOAD dispatch for receipt (destination user, branch 6)");
    const loaded = await loadDispatchForReceipt(receiptScope, dispatchId);
    assert(loaded.items.length === 1 && loaded.items[0].dispatchQty === qty, `loaded ${loaded.items.length} item, dispatchQty ${loaded.items[0]?.dispatchQty}`);
    assert(num(loaded.items[0].purchasePrice) === num(av.unitCost), "purchase price carried from dispatch");

    console.log("3) CREATE + RECEIVE (received 5, damaged 1, selling price 999)");
    const mainBefore = await bal(productId, DST, MAIN);
    const dmgBefore = await bal(productId, DST, DAMAGE);
    const cR = await createReceipt(receiptScope, user, { dispatchId, receiptDate: "2026-07-15", items: [{ dispatchItemId: loaded.items[0].dispatchItemId, productId, productName: prod?.name || "P", dispatchQty: qty, receivedQty: qty, damagedQty: damaged, purchasePrice: num(av.unitCost), sellingPrice: sellPrice, mrp: 0 }] } as any);
    receiptId = cR.id;
    assert(/^RCPT-\d{5}$/.test(cR.receiptNo), `receiptNo=${cR.receiptNo}`);
    const p = await postReceipt(receiptScope, user, receiptId);
    assert(p.status === "Received", `receipt status=${p.status}`);
    assert(p.totalAcceptedQty === accepted && p.totalDamagedQty === damaged && p.totalMissingQty === 0, `acc ${p.totalAcceptedQty} dmg ${p.totalDamagedQty} miss ${p.totalMissingQty}`);

    console.log("4) inventory effects");
    const transit1 = await bal(productId, DST, IN_TRANSIT_WAREHOUSE);
    const mainAfter = await bal(productId, DST, MAIN);
    const dmgAfter = await bal(productId, DST, DAMAGE);
    assert(transit1 === 0, `in-transit cleared ${transit0} → ${transit1}`);
    assert(Math.abs(mainAfter - (mainBefore + accepted)) < 0.001, `dest Main Store +${accepted} (${mainBefore}→${mainAfter})`);
    assert(Math.abs(dmgAfter - (dmgBefore + damaged)) < 0.001, `dest Damage Store +${damaged} (${dmgBefore}→${dmgAfter})`);

    console.log("5) selling price became the branch default");
    const mainRow = await prisma.inventoryBalance.findFirst({ where: { tenantId: 4, productId, branchId: DST, warehouse: MAIN }, select: { sellingRate: true } });
    assert(num(mainRow?.sellingRate) === sellPrice, `dest Main Store sellingRate = ${num(mainRow?.sellingRate)}`);

    console.log("6) stock ledger + dispatch status");
    const led = await prisma.inventoryLedger.count({ where: { tenantId: 4, refType: "TRANSFER_RECEIPT", refId: receiptId } });
    assert(led >= 2, `receipt ledger rows = ${led}`);
    const disp = await prisma.stockTransferDispatch.findUnique({ where: { id: dispatchId }, select: { status: true } });
    assert(disp?.status === "Received", `dispatch status → ${disp?.status}`);

    console.log("7) accounting — Dr Inventory 1200 / Cr In-Transit 1210 only");
    const je = await prisma.journalEntry.findFirst({ where: { tenantId: 4, sourceType: "TRANSFER_RECEIPT", sourceId: receiptId }, include: { lines: { include: { account: true } } } });
    assert(!!je && je.lines.length === 2, `2 GL lines (no GST) — got ${je?.lines.length}`);
    const dr = je!.lines.find((l) => num(l.debit) > 0)!, cr = je!.lines.find((l) => num(l.credit) > 0)!;
    assert(dr.account.code === "1200", `Dr Inventory 1200 (got ${dr.account.code})`);
    assert(cr.account.code === "1210", `Cr Inventory In-Transit 1210 (got ${cr.account.code})`);

    console.log("8) receipt visible in history");
    const g = await getReceipt(receiptScope, receiptId);
    assert(g!.header.status === "Received", "getReceipt ok");
    const hist = await listReceipts(receiptScope, { history: true });
    assert(hist.some((r) => r.id === receiptId), "receipt in history");

    console.log("\nALL ASSERTIONS PASSED");
  } finally {
    console.log("\n-- rollback --");
    for (const refId of [dispatchId, receiptId]) {
      if (!refId) continue;
      const rt = refId === dispatchId ? "TRANSFER_DISPATCH" : "TRANSFER_RECEIPT";
      await prisma.inventoryLedger.deleteMany({ where: { tenantId: 4, refType: rt, refId } }).catch(() => {});
      await prisma.inventoryLot.deleteMany({ where: { tenantId: 4, refType: rt, refId } }).catch(() => {});
    }
    for (const b of snapBal) await prisma.inventoryBalance.update({ where: { id: b.id }, data: { qtyOnHand: b.qtyOnHand, purchaseValue: b.purchaseValue, sellingValue: b.sellingValue, purchaseRate: b.purchaseRate, sellingRate: b.sellingRate } }).catch(() => {});
    for (const l of snapLot) await prisma.inventoryLot.update({ where: { id: l.id }, data: { qtyOnHand: l.qtyOnHand, purchaseValue: l.purchaseValue, sellingValue: l.sellingValue } }).catch(() => {});
    if (productId) await prisma.inventoryBalance.deleteMany({ where: { tenantId: 4, productId, branchId: { in: [SRC, DST] }, id: { notIn: snapBal.map((b) => b.id) } } }).catch(() => {});
    for (const st of ["TRANSFER_DISPATCH", "TRANSFER_RECEIPT"] as const) {
      const rid = st === "TRANSFER_DISPATCH" ? dispatchId : receiptId;
      if (!rid) continue;
      const jes = await prisma.journalEntry.findMany({ where: { tenantId: 4, sourceType: st, sourceId: rid }, select: { id: true } });
      for (const j of jes) { await prisma.journalLine.deleteMany({ where: { journalId: j.id } }); await prisma.journalEntry.delete({ where: { id: j.id } }).catch(() => {}); }
    }
    if (receiptId) { await prisma.stockTransferReceiptItem.deleteMany({ where: { receiptId } }); await prisma.stockTransferReceipt.delete({ where: { id: receiptId } }).catch(() => {}); await prisma.auditLog.deleteMany({ where: { entity: "StockTransferReceipt", entityId: String(receiptId) } }).catch(() => {}); }
    if (dispatchId) { await prisma.stockTransferDispatchItem.deleteMany({ where: { dispatchId } }); await prisma.stockTransferDispatch.delete({ where: { id: dispatchId } }).catch(() => {}); await prisma.auditLog.deleteMany({ where: { entity: "StockTransferDispatch", entityId: String(dispatchId) } }).catch(() => {}); }
    const srcNow = productId ? await bal(productId, SRC, "Main Store") : 0;
    const leftover = await prisma.stockTransferReceipt.count({ where: { createdByName: "E2E Runner" } });
    console.log(`  restored source Main Store=${srcNow}; leftover receipts=${leftover}`);
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
