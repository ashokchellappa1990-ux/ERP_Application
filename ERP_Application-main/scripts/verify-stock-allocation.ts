import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";
import { allocationRequiredForBranch, productAvailability, createFromRequest, allocate, allocationAction, getAllocation, listPendingRequests, listAllocations } from "@/lib/warehouse/allocation";

const user = { id: 1, tenantId: 4, fullName: "E2E Runner" } as any;
const scope: ActiveScope = { tenantId: 4, businessId: 3, branchId: 5, readBranchIds: [5, 6] } as any;

async function main() {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("ASSERT FAIL: " + m); console.log("  ✓ " + m); };
  const num = (v: unknown) => Number(v) || 0;
  let strId = 0; let allocId = 0;
  try {
    console.log("0) pick a product with stock at branch 5");
    const bal = await prisma.inventoryBalance.findFirst({ where: { tenantId: 4, branchId: 5, qtyOnHand: { gt: 3 }, warehouse: { notIn: BUCKET_WAREHOUSES } }, select: { productId: true, qtyOnHand: true } });
    if (!bal) throw new Error("no stock at branch 5 to test with");
    const productId = bal.productId;
    const product = await prisma.product.findFirst({ where: { id: productId }, select: { name: true } });
    const physBefore = num((await prisma.inventoryBalance.aggregate({ where: { tenantId: 4, branchId: 5, productId, warehouse: { notIn: BUCKET_WAREHOUSES } }, _sum: { qtyOnHand: true } }))._sum.qtyOnHand);
    console.log(`    product ${product?.name} (#${productId}) physical on-hand=${physBefore}`);
    const reqQty = 3;

    console.log("1) config gate (default true when no warehouse config)");
    const required = await allocationRequiredForBranch(scope, 5);
    assert(required === true, `allocationRequiredForBranch(branch 5) = ${required}`);

    console.log("2) seed an Approved Stock Transfer Request (destination = branch 5, the stock-holding branch)");
    const str = await prisma.stockTransferRequest.create({ data: { tenantId: 4, businessId: 3, requestNo: "TMP", requestDate: "2026-07-15", transferType: "Internal Transfer", sourceBranchId: 6, destinationBranchId: 5, priority: "Normal", status: "Approved", approvalStatus: "Approved", totalRequestedQty: reqQty, itemCount: 1, createdByName: "E2E Runner", lines: { create: [{ tenantId: 4, productId, productName: product?.name || "P", requestedQty: reqQty }] } } });
    strId = str.id;
    await prisma.stockTransferRequest.update({ where: { id: str.id }, data: { requestNo: `STR-E2E-${str.id}` } });
    assert(!!strId, `seeded approved STR #${strId}`);

    console.log("3) listPendingRequests shows it");
    const pending = await listPendingRequests(scope);
    assert(pending.some((r) => r.requestId === strId), "pending list contains the request");

    console.log("4) availability BEFORE allocation");
    const av0 = await productAvailability(scope, { productId, branchId: 5 });
    console.log(`    policy=${av0.policy} onHand=${av0.onHand} reserved=${av0.reserved} available=${av0.available}`);
    assert(av0.reserved === 0, "no reservations yet");

    console.log("5) createFromRequest → Draft allocation");
    const c = await createFromRequest(scope, user, strId);
    allocId = c.id;
    assert(/^ALLOC-\d{5}$/.test((c as any).allocationNo), `allocationNo=${(c as any).allocationNo}`);
    const g0 = await getAllocation(scope, allocId);
    assert(g0!.header.status === "Draft" && g0!.lines.length === 1, "draft with 1 line");
    assert(g0!.lines[0].policy === av0.policy, `line policy = ${g0!.lines[0].policy}`);

    console.log("6) idempotent createFromRequest returns the same draft");
    const c2 = await createFromRequest(scope, user, strId);
    assert(c2.id === allocId && (c2 as any).existing === true, "returns existing draft, no duplicate");

    console.log("7) allocate qty");
    const lineId = g0!.lines[0].id;
    const al = await allocate(scope, user, allocId, { lines: [{ lineId, allocatedQty: reqQty }] });
    assert(al.status === "Allocated", `status=${al.status} allocated=${al.totalAllocatedQty}`);
    const g1 = await getAllocation(scope, allocId);
    assert(num(g1!.lines[0].reservedQty) === reqQty, `line reservedQty=${g1!.lines[0].reservedQty}`);
    const lotCount = await prisma.stockAllocationLot.count({ where: { allocationId: allocId, status: "Active" } });
    assert(lotCount >= 1, `active reservation rows=${lotCount}`);

    console.log("8) reservation DECREASES available, physical UNCHANGED");
    const av1 = await productAvailability(scope, { productId, branchId: 5 });
    assert(Math.abs(av1.available - (av0.available - reqQty)) < 0.001, `available ${av0.available} → ${av1.available} (−${reqQty})`);
    assert(av1.reserved === reqQty, `reserved now ${av1.reserved}`);
    const physAfter = num((await prisma.inventoryBalance.aggregate({ where: { tenantId: 4, branchId: 5, productId, warehouse: { notIn: BUCKET_WAREHOUSES } }, _sum: { qtyOnHand: true } }))._sum.qtyOnHand);
    assert(physAfter === physBefore, `physical on-hand unchanged (${physBefore})`);

    console.log("9) re-allocating does NOT double-reserve");
    await allocate(scope, user, allocId, { lines: [{ lineId, allocatedQty: reqQty }] });
    const av2 = await productAvailability(scope, { productId, branchId: 5 });
    assert(av2.reserved === reqQty, `still reserved ${av2.reserved} (not ${reqQty * 2})`);

    console.log("10) cannot allocate more than available (guard fires when requested > available)");
    // Temporarily raise the requested qty above on-hand so we can attempt an over-allocation.
    await prisma.stockAllocationLine.update({ where: { id: lineId }, data: { requestedQty: physBefore + 50, remainingQty: physBefore + 50 } });
    let blocked = false;
    try { await allocate(scope, user, allocId, { lines: [{ lineId, allocatedQty: physBefore + 40 }] }); } catch { blocked = true; }
    assert(blocked, "over-allocation (> available) rejected");
    // Failed allocate mutates nothing → the step-9 reservation is intact. Restore + re-allocate cleanly.
    const stillReserved = (await productAvailability(scope, { productId, branchId: 5 })).reserved;
    assert(stillReserved === reqQty, "failed allocate did not touch existing reservation");
    await prisma.stockAllocationLine.update({ where: { id: lineId }, data: { requestedQty: reqQty } });
    await allocate(scope, user, allocId, { lines: [{ lineId, allocatedQty: reqQty }] });

    console.log("11) reallocate → Draft, reservations freed");
    await allocationAction(scope, user, allocId, "reallocate");
    const g3 = await getAllocation(scope, allocId);
    assert(g3!.header.status === "Draft", "status back to Draft");
    const avR = await productAvailability(scope, { productId, branchId: 5 });
    assert(avR.reserved === 0, "reservations freed on reallocate");

    console.log("12) allocate again then release");
    await allocate(scope, user, allocId, { lines: [{ lineId, allocatedQty: reqQty }] });
    const rel = await allocationAction(scope, user, allocId, "release");
    assert(rel.status === "Released", "released");
    const avRel = await productAvailability(scope, { productId, branchId: 5 });
    assert(avRel.reserved === 0 && Math.abs(avRel.available - av0.available) < 0.001, "available fully restored after release");

    console.log("13) history list contains the released allocation");
    const hist = await listAllocations(scope, { history: true });
    assert(hist.some((r) => r.id === allocId), "history contains released allocation");

    console.log("\nALL ASSERTIONS PASSED");
  } finally {
    console.log("\n-- rollback --");
    if (allocId) { await prisma.stockAllocationLot.deleteMany({ where: { allocationId: allocId } }); await prisma.stockAllocationLine.deleteMany({ where: { allocationId: allocId } }); await prisma.stockAllocation.delete({ where: { id: allocId } }).catch(() => {}); }
    if (strId) { await prisma.stockTransferRequestLine.deleteMany({ where: { requestId: strId } }); await prisma.stockTransferRequest.delete({ where: { id: strId } }).catch(() => {}); }
    await prisma.auditLog.deleteMany({ where: { entity: "StockAllocation", entityId: { in: allocId ? [String(allocId)] : [] } } }).catch(() => {});
    const leftover = await prisma.stockAllocation.count({ where: { createdByName: "E2E Runner" } });
    console.log(`  cleaned alloc #${allocId}, STR #${strId}; leftover E2E allocations=${leftover}`);
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
