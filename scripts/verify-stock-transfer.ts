import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { transferOptions, availability, createRequest, updateRequest, requestAction, duplicateRequest, listRequests, getRequest } from "@/lib/warehouse/transfer";

const user = { id: 1, tenantId: 4, fullName: "E2E Runner" } as any;
const scope: ActiveScope = { tenantId: 4, businessId: 3, branchId: 5, readBranchIds: [5, 6] } as any;

async function main() {
  const created: number[] = [];
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("ASSERT FAIL: " + m); console.log("  ✓ " + m); };
  try {
    console.log("1) transferOptions");
    const opt = await transferOptions(scope);
    assert(opt.sourceBranches.length > 0, `sourceBranches=${opt.sourceBranches.length}`);
    assert(opt.transferTypes.length === 5, "5 transfer types");
    assert(opt.priorities.length === 4, "4 priorities");
    const dest = opt.destinationBranches.find((b) => b.id !== scope.branchId);
    assert(!!dest, `dest branch available (${dest?.name})`);
    console.log(`    default source=${opt.defaultSourceBranchId}, dest picked=${dest?.id}`);

    console.log("2) pick a product with stock at source");
    const bal = await prisma.inventoryBalance.findFirst({ where: { tenantId: 4, branchId: 5, qtyOnHand: { gt: 0 } }, select: { productId: true } });
    const productId = bal?.productId ?? (await prisma.product.findFirst({ where: { tenantId: 4 }, select: { id: true } }))!.id;
    const av = await availability(scope, { productId, sourceBranchId: 5, destBranchId: dest!.id });
    assert(av.productId === productId, `availability product ${av.name}`);
    console.log(`    availSource=${av.availableSource} availDest=${av.availableDest} uom=${av.uom} min=${av.minStockQty} max=${av.maxStockQty}`);

    console.log("3) createRequest");
    const c = await createRequest(scope, user, {
      transferType: "Internal Transfer", sourceBranchId: 5, destinationBranchId: dest!.id, priority: "High", requestDate: "2026-07-15",
      lines: [{ productId, productName: av.name || "P", sku: av.sku, uom: av.uom, availableSource: av.availableSource, availableDest: av.availableDest, requestedQty: 3, minStockQty: av.minStockQty, maxStockQty: av.maxStockQty, remarks: "e2e" }],
    });
    created.push(c.id);
    assert(/^STR-\d{5}$/.test(c.requestNo), `requestNo=${c.requestNo}`);

    console.log("4) getRequest shape");
    const g = await getRequest(scope, c.id);
    assert(!!g && g.header.status === "Draft", "status Draft");
    assert(g!.lines.length === 1 && g!.lines[0].requestedQty === 3, "1 line qty 3");
    assert(g!.editable === true, "editable in Draft");
    assert(g!.nextActions.includes("submit"), "submit is a next action");

    console.log("5) source ≠ dest validation");
    let threw = false;
    try { await createRequest(scope, user, { sourceBranchId: 5, destinationBranchId: 5, priority: "Normal", lines: [{ productId, productName: "P", availableSource: 0, availableDest: 0, requestedQty: 1 }] } as any); } catch { threw = true; }
    assert(threw, "rejected source==dest");

    console.log("6) updateRequest");
    const u = await updateRequest(scope, user, c.id, {
      transferType: "Replenishment", sourceBranchId: 5, destinationBranchId: dest!.id, priority: "Urgent", requestDate: "2026-07-15",
      lines: [{ productId, productName: av.name || "P", availableSource: av.availableSource, availableDest: av.availableDest, requestedQty: 7 }],
    });
    const g2 = await getRequest(scope, u.id);
    assert(g2!.lines[0].requestedQty === 7 && g2!.header.priority === "Urgent", "update applied (qty 7, Urgent)");

    console.log("7) submit → approval (config-driven)");
    const sub = await requestAction(scope, user, c.id, "submit");
    console.log(`    after submit: status=${sub.status} approval=${sub.approvalStatus}`);
    assert(["Submitted", "Approved"].includes(sub.status), "submit moved forward");

    if (sub.status === "Submitted") {
      console.log("8) approve (destination user — scope includes dest branch)");
      let blocked = false;
      try { await requestAction(scope, user, c.id, "approve"); } catch { blocked = true; }
      assert(blocked, "source-only user CANNOT approve (dest not in scope)");
      const destScope: ActiveScope = { tenantId: 4, businessId: 3, branchId: dest!.id, readBranchIds: [dest!.id] } as any;
      const ap = await requestAction(destScope, user, c.id, "approve");
      assert(ap.status === "Approved" && ap.approvalStatus === "Approved", "destination user approved");
    } else {
      console.log("8) auto-approved (no approval configured) — skipped explicit approve");
    }

    console.log("9) duplicate");
    const d = await duplicateRequest(scope, user, c.id);
    created.push(d.id);
    const gd = await getRequest(scope, d.id);
    assert(gd!.header.status === "Draft" && gd!.lines.length === 1, "duplicate is a fresh Draft");

    console.log("10) listRequests + filter");
    const list = await listRequests(scope, {});
    assert(list.some((r) => r.id === c.id), "list contains our request");
    const byStatus = await listRequests(scope, { status: "Draft" });
    assert(byStatus.every((r) => r.status === "Draft"), "status filter honoured");

    console.log("\nALL ASSERTIONS PASSED");
  } finally {
    console.log("\n-- rollback --");
    for (const id of created) {
      await prisma.stockTransferRequestLine.deleteMany({ where: { requestId: id } });
      await prisma.stockTransferRequest.delete({ where: { id } }).catch(() => {});
    }
    await prisma.auditLog.deleteMany({ where: { entity: "StockTransferRequest", entityId: { in: created.map(String) } } }).catch(() => {});
    const leftover = await prisma.stockTransferRequest.count({ where: { createdByName: "E2E Runner" } });
    console.log(`  cleaned ${created.length} requests; leftover E2E rows=${leftover}`);
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
