import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { postMovement, addLot, consumeLots } from "@/lib/inventory/ledger";
import { WIP_WAREHOUSE } from "@/lib/inventory/buckets";
import { getAreaStockBreakdown } from "@/lib/manufacturing/areaStock";

const PERM = "manufacturing.material-processing";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +n.toFixed(2);
const r3 = (n: number) => +n.toFixed(3);

// POST /api/manufacturing/material-processing/[id]/initiate — Draft -> InProgress.
// Moves the raw material from its Source Storage Area into the WIP bucket.
// Re-validates stock against the ACTUAL current balance (not just what the
// editor last saw), per spec: entry-time checks are advisory, this is authoritative.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "MaterialProcessing", entityId: id });
  if (denied) return denied;

  const mp = await prisma.materialProcessing.findFirst({ where: { id, tenantId: user.tenantId }, include: { outputs: true } });
  if (!mp) return NextResponse.json({ ok: false, message: "Material Processing transaction not found." }, { status: 404 });
  if (mp.status !== "Draft") return NextResponse.json({ ok: false, message: `This transaction is already ${mp.status} — only a Draft can be initiated.` }, { status: 422 });

  // Final validation (mirrors what the editor already checked, re-verified authoritatively).
  const [processingArea, sourceArea, set] = await Promise.all([
    prisma.area.findFirst({ where: { id: mp.processingAreaId, tenantId: user.tenantId } }),
    prisma.area.findFirst({ where: { id: mp.sourceAreaId, tenantId: user.tenantId } }),
    prisma.processingSet.findFirst({ where: { id: mp.processingSetId, tenantId: user.tenantId } }),
  ]);
  if (!processingArea || processingArea.type !== "Processing" || processingArea.status !== "Active") return NextResponse.json({ ok: false, message: "Processing Area is invalid or inactive." }, { status: 422 });
  if (!sourceArea || sourceArea.status !== "Active") return NextResponse.json({ ok: false, message: "Source Storage Area is invalid or inactive." }, { status: 422 });
  if (!set || set.status !== "Active") return NextResponse.json({ ok: false, message: "Processing Set is invalid or inactive." }, { status: 422 });
  if (!mp.outputs.length) return NextResponse.json({ ok: false, message: "Add at least one Finished Good output before initiating." }, { status: 422 });
  const outputAreaIds = Array.from(new Set(mp.outputs.map((o) => o.outputAreaId)));
  const outputAreas = await prisma.area.findMany({ where: { id: { in: outputAreaIds }, tenantId: user.tenantId } });
  if (outputAreas.some((a) => a.status !== "Active")) return NextResponse.json({ ok: false, message: "One or more Output Storage Areas are inactive." }, { status: 422 });
  if (num(mp.inputQuantity) <= 0) return NextResponse.json({ ok: false, message: "Processing Quantity must be greater than 0." }, { status: 422 });

  if (mp.requireFullAllocation) {
    const total = r3(mp.outputs.reduce((s, o) => s + num(o.actualQuantity), 0));
    if (Math.abs(total - num(mp.inputQuantity)) > 0.001) {
      return NextResponse.json({ ok: false, message: `Output allocation must equal 100% of the Processing Quantity (${num(mp.inputQuantity)} ${mp.inputUom ?? ""}) — currently ${total}.` }, { status: 422 });
    }
  }

  // Authoritative stock check — the actual current balance, not the editor's
  // snapshot. `InventoryBalance` has no areaId column, so Area-scoped on-hand
  // is derived from the ledger (same approach the Inventory Ledger page's
  // Area filter uses) — physical stock tagged to this Area may live under one
  // or more distinct `warehouse` strings, since warehouse and Area are set
  // independently at receipt time.
  const inputQty = num(mp.inputQuantity);
  const breakdown = await getAreaStockBreakdown(user.tenantId, mp.branchId ?? null, mp.rawMaterialProductId, sourceArea.id);
  const availableQty = r3(breakdown.reduce((s, b) => s + b.qty, 0));
  if (inputQty > availableQty + 0.0005) {
    return NextResponse.json({ ok: false, message: `Processing quantity cannot exceed available stock in the selected storage area. Available: ${availableQty}, Requested: ${inputQty}.` }, { status: 422 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Drain each warehouse holding Area-tagged stock in turn (largest share
      // first) until the full input qty is issued — one OUT movement per
      // warehouse actually drawn from, since a balance row is keyed by
      // warehouse. Falls back to an unconstrained draw from the Area's own
      // name if lot data is short of the requested qty, same convention as
      // Sales/Dispatch consumption elsewhere in this codebase.
      let remaining = inputQty;
      let totalCost = 0;
      let lastBatchNo: string | null = null, lastMfgDate: string | null = null, lastExpiryDate: string | null = null;
      for (const share of breakdown) {
        if (remaining <= 0.0005) break;
        const draw = r3(Math.min(remaining, share.qty));
        const res = await consumeLots(tx, user.tenantId, mp.branchId ?? null, mp.rawMaterialProductId, share.warehouse, draw);
        const unitRate = draw > 0 ? r2(res.cost / draw) : 0;
        await postMovement(tx, {
          tenantId: user.tenantId, businessId: mp.businessId ?? undefined, branchId: mp.branchId ?? undefined,
          productId: mp.rawMaterialProductId, txnType: "MP_ISSUE", direction: "OUT", qty: draw, rate: unitRate,
          warehouse: share.warehouse, areaId: sourceArea.id, batchNo: res.batchNo, mfgDate: res.mfgDate, expiryDate: res.expiryDate,
          refType: "MATERIAL_PROCESSING", refId: mp.id, refNo: mp.processingNumber, txnDate: mp.processingDate, createdBy: user.id,
          remarks: `Issued to WIP for Material Processing ${mp.processingNumber}`,
        });
        totalCost += res.cost;
        lastBatchNo = res.batchNo ?? lastBatchNo; lastMfgDate = res.mfgDate ?? lastMfgDate; lastExpiryDate = res.expiryDate ?? lastExpiryDate;
        remaining = r3(remaining - draw);
      }
      if (remaining > 0.0005) {
        const fb = await consumeLots(tx, user.tenantId, mp.branchId ?? null, mp.rawMaterialProductId, sourceArea.name, remaining);
        totalCost += fb.cost;
        lastBatchNo = fb.batchNo ?? lastBatchNo; lastMfgDate = fb.mfgDate ?? lastMfgDate; lastExpiryDate = fb.expiryDate ?? lastExpiryDate;
        await postMovement(tx, {
          tenantId: user.tenantId, businessId: mp.businessId ?? undefined, branchId: mp.branchId ?? undefined,
          productId: mp.rawMaterialProductId, txnType: "MP_ISSUE", direction: "OUT", qty: remaining, rate: remaining > 0 ? r2(fb.cost / remaining) : 0,
          warehouse: sourceArea.name, areaId: sourceArea.id, batchNo: fb.batchNo, mfgDate: fb.mfgDate, expiryDate: fb.expiryDate,
          refType: "MATERIAL_PROCESSING", refId: mp.id, refNo: mp.processingNumber, txnDate: mp.processingDate, createdBy: user.id,
          remarks: `Issued to WIP for Material Processing ${mp.processingNumber}`,
        });
      }
      const unitRate = inputQty > 0 ? r2(totalCost / inputQty) : 0;

      await postMovement(tx, {
        tenantId: user.tenantId, businessId: mp.businessId ?? undefined, branchId: mp.branchId ?? undefined,
        productId: mp.rawMaterialProductId, txnType: "MP_WIP_IN", direction: "IN", qty: inputQty, rate: unitRate,
        warehouse: WIP_WAREHOUSE, areaId: processingArea.id, batchNo: lastBatchNo, mfgDate: lastMfgDate, expiryDate: lastExpiryDate,
        refType: "MATERIAL_PROCESSING", refId: mp.id, refNo: mp.processingNumber, txnDate: mp.processingDate, createdBy: user.id,
      });
      await addLot(tx, {
        tenantId: user.tenantId, businessId: mp.businessId ?? undefined, branchId: mp.branchId ?? undefined,
        productId: mp.rawMaterialProductId, warehouse: WIP_WAREHOUSE, areaId: processingArea.id, batchNo: lastBatchNo,
        refType: "MATERIAL_PROCESSING", refId: mp.id, refNo: mp.processingNumber, receivedDate: mp.processingDate,
        mfgDate: lastMfgDate, expiryDate: lastExpiryDate, qty: inputQty, unitRate,
      });

      await tx.materialProcessing.update({ where: { id: mp.id }, data: { status: "InProgress", initiatedAt: new Date(), initiatedBy: user.id } });
    }, { maxWait: 10_000, timeout: 30_000 });

    await writeAudit(prisma, user, { action: "material_processing.initiate", entity: "MaterialProcessing", entityId: mp.id, summary: `Initiated Material Processing ${mp.processingNumber} — ${inputQty} ${mp.inputUom ?? ""} moved to WIP`, meta: { inputQuantity: inputQty, sourceAreaId: mp.sourceAreaId, processingAreaId: mp.processingAreaId }, businessId: mp.businessId ?? null, branchId: mp.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Material Processing initiated — raw material moved to WIP." });
  } catch (err) {
    console.error("[material-processing] initiate error", err);
    return NextResponse.json({ ok: false, message: "Could not initiate processing." }, { status: 500 });
  }
}
