import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { IN_TRANSIT_WAREHOUSE, BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";
import { availabilityAt, createDispatch, validateDispatch, postDispatch, generateChallan, getDispatch, listDispatches } from "@/lib/warehouse/dispatch";

const user = { id: 1, tenantId: 4, fullName: "E2E Runner" } as any;
const SRC = 5, DST = 6; // direct dispatch: login branch 5 → branch 6
const scope: ActiveScope = { tenantId: 4, businessId: 3, branchId: SRC, readBranchIds: [SRC, DST] } as any;
const num = (v: unknown) => Number(v) || 0;

async function main() {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("ASSERT FAIL: " + m); console.log("  ✓ " + m); };
  let dispatchId = 0;
  // snapshot for precise rollback
  let snapBal: { id: number; qtyOnHand: any; purchaseValue: any; sellingValue: any }[] = [];
  let snapLot: { id: number; qtyOnHand: any; purchaseValue: any; sellingValue: any }[] = [];
  let productId = 0;
  try {
    console.log("0) pick a product WITH lots at branch 5");
    const lot = await prisma.inventoryLot.findFirst({ where: { tenantId: 4, branchId: SRC, qtyOnHand: { gt: 5 }, warehouse: { notIn: BUCKET_WAREHOUSES } }, select: { productId: true } });
    productId = lot?.productId ?? 0;
    if (!productId) throw new Error("no lot at branch 5 to test with");
    const prod = await prisma.product.findFirst({ where: { id: productId }, select: { name: true } });
    console.log(`    product ${prod?.name} (#${productId})`);
    snapBal = await prisma.inventoryBalance.findMany({ where: { tenantId: 4, productId, branchId: { in: [SRC, DST] } }, select: { id: true, qtyOnHand: true, purchaseValue: true, sellingValue: true } });
    snapLot = await prisma.inventoryLot.findMany({ where: { tenantId: 4, productId, branchId: { in: [SRC, DST] } }, select: { id: true, qtyOnHand: true, purchaseValue: true, sellingValue: true } });
    const srcBefore = num((await prisma.inventoryBalance.aggregate({ where: { tenantId: 4, productId, branchId: SRC, warehouse: { notIn: BUCKET_WAREHOUSES } }, _sum: { qtyOnHand: true } }))._sum.qtyOnHand);
    const transitBefore = num((await prisma.inventoryBalance.aggregate({ where: { tenantId: 4, productId, branchId: DST, warehouse: IN_TRANSIT_WAREHOUSE }, _sum: { qtyOnHand: true } }))._sum.qtyOnHand);
    console.log(`    source on-hand=${srcBefore}, dest in-transit=${transitBefore}`);
    const qty = 3;

    console.log("1) availability at source");
    const av = await availabilityAt(scope, { productId, branchId: SRC });
    assert(av.onHand === srcBefore, `availability onHand=${av.onHand}`);
    console.log(`    policy=${av.policy} available=${av.available} unitCost=${av.unitCost}`);

    console.log("2) createDispatch (Direct Dispatch → branch 6)");
    const c = await createDispatch(scope, user, { dispatchType: "Direct Dispatch", destinationBranchId: DST, dispatchDate: "2026-07-15", priority: "Normal", items: [{ productId, productName: prod?.name || "P", availableQty: av.available, dispatchQty: qty, unitCost: av.unitCost }] } as any);
    dispatchId = c.id;
    assert(/^DISP-\d{5}$/.test(c.dispatchNo), `dispatchNo=${c.dispatchNo}`);
    const g0 = await getDispatch(scope, dispatchId);
    assert(g0!.header.status === "Draft" && g0!.items.length === 1, "draft with 1 item");

    console.log("3) validate");
    const v = await validateDispatch(scope, dispatchId);
    assert(v.ok, `validate ok (${v.errors.join("; ")})`);

    console.log("4) POST dispatch (the real move)");
    const p = await postDispatch(scope, user, dispatchId);
    assert(p.status === "Dispatched", `status=${p.status}`);
    assert(Math.abs(p.totalValue - qty * av.unitCost) < 1, `value=${p.totalValue} ≈ ${qty * av.unitCost}`);

    console.log("5) inventory effects");
    const srcAfter = num((await prisma.inventoryBalance.aggregate({ where: { tenantId: 4, productId, branchId: SRC, warehouse: { notIn: BUCKET_WAREHOUSES } }, _sum: { qtyOnHand: true } }))._sum.qtyOnHand);
    const transitAfter = num((await prisma.inventoryBalance.aggregate({ where: { tenantId: 4, productId, branchId: DST, warehouse: IN_TRANSIT_WAREHOUSE }, _sum: { qtyOnHand: true } }))._sum.qtyOnHand);
    assert(Math.abs(srcAfter - (srcBefore - qty)) < 0.001, `source reduced ${srcBefore} → ${srcAfter} (−${qty})`);
    assert(Math.abs(transitAfter - (transitBefore + qty)) < 0.001, `dest in-transit ${transitBefore} → ${transitAfter} (+${qty})`);

    console.log("6) stock ledger entries");
    const led = await prisma.inventoryLedger.findMany({ where: { tenantId: 4, refType: "TRANSFER_DISPATCH", refId: dispatchId }, select: { direction: true, txnType: true, branchId: true, qty: true } });
    assert(led.some((l) => l.direction === "OUT" && l.txnType === "TRANSFER_OUT" && l.branchId === SRC), "ledger OUT at source");
    assert(led.some((l) => l.direction === "IN" && l.txnType === "TRANSFER_IN" && l.branchId === DST), "ledger IN at destination");

    console.log("7) accounting — internal movement ONLY (Dr 1210 / Cr 1200)");
    const je = await prisma.journalEntry.findFirst({ where: { tenantId: 4, sourceType: "TRANSFER_DISPATCH", sourceId: dispatchId }, include: { lines: { include: { account: true } } } });
    assert(!!je, "journal entry posted");
    assert(je!.lines.length === 2, `exactly 2 GL lines (no GST/sales) — got ${je!.lines.length}`);
    const dr = je!.lines.find((l) => num(l.debit) > 0)!, cr = je!.lines.find((l) => num(l.credit) > 0)!;
    assert(dr.account.code === "1210", `Dr = Inventory In-Transit 1210 (got ${dr.account.code})`);
    assert(cr.account.code === "1200", `Cr = Inventory 1200 (got ${cr.account.code})`);
    assert(Math.abs(num(je!.totalDebit) - num(je!.totalCredit)) < 0.01, "journal balanced");

    console.log("8) delivery challan");
    const dc = await generateChallan(scope, user, dispatchId);
    assert(/^DC-\d{5}$/.test(dc.challanNo), `challanNo=${dc.challanNo}`);
    const dc2 = await generateChallan(scope, user, dispatchId);
    assert(dc2.challanNo === dc.challanNo && (dc2 as any).existing, "challan idempotent");

    console.log("9) history list");
    const hist = await listDispatches(scope, { history: true });
    assert(hist.some((r) => r.id === dispatchId), "dispatch appears in history");

    console.log("10) posted dispatch cannot be cancelled");
    let blocked = false;
    try { const { cancelDispatch } = await import("@/lib/warehouse/dispatch"); await cancelDispatch(scope, user, dispatchId, "x"); } catch { blocked = true; }
    assert(blocked, "posted dispatch cancel rejected (needs Transfer Return)");

    console.log("\nALL ASSERTIONS PASSED");
  } finally {
    console.log("\n-- rollback --");
    if (dispatchId) {
      // reverse inventory: restore balances + lots from snapshot, drop new in-transit rows
      await prisma.inventoryLedger.deleteMany({ where: { tenantId: 4, refType: "TRANSFER_DISPATCH", refId: dispatchId } }).catch(() => {});
      await prisma.inventoryLot.deleteMany({ where: { tenantId: 4, refType: "TRANSFER_DISPATCH", refId: dispatchId } }).catch(() => {});
      for (const b of snapBal) await prisma.inventoryBalance.update({ where: { id: b.id }, data: { qtyOnHand: b.qtyOnHand, purchaseValue: b.purchaseValue, sellingValue: b.sellingValue } }).catch(() => {});
      for (const l of snapLot) await prisma.inventoryLot.update({ where: { id: l.id }, data: { qtyOnHand: l.qtyOnHand, purchaseValue: l.purchaseValue, sellingValue: l.sellingValue } }).catch(() => {});
      // delete any in-transit balance rows created for this product at DST
      await prisma.inventoryBalance.deleteMany({ where: { tenantId: 4, productId, branchId: DST, warehouse: IN_TRANSIT_WAREHOUSE, id: { notIn: snapBal.map((b) => b.id) } } }).catch(() => {});
      // delete GL
      const jes = await prisma.journalEntry.findMany({ where: { tenantId: 4, sourceType: "TRANSFER_DISPATCH", sourceId: dispatchId }, select: { id: true } });
      for (const j of jes) { await prisma.journalLine.deleteMany({ where: { journalId: j.id } }); await prisma.journalEntry.delete({ where: { id: j.id } }).catch(() => {}); }
      await prisma.stockTransferDispatchItem.deleteMany({ where: { dispatchId } });
      await prisma.stockTransferDispatch.delete({ where: { id: dispatchId } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { entity: "StockTransferDispatch", entityId: String(dispatchId) } }).catch(() => {});
    }
    const srcNow = num((await prisma.inventoryBalance.aggregate({ where: { tenantId: 4, productId, branchId: SRC, warehouse: { notIn: BUCKET_WAREHOUSES } }, _sum: { qtyOnHand: true } }))._sum.qtyOnHand);
    const leftover = await prisma.stockTransferDispatch.count({ where: { createdByName: "E2E Runner" } });
    console.log(`  restored source on-hand=${srcNow}; leftover dispatches=${leftover}`);
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
