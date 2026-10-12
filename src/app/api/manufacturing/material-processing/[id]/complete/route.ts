import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { postMovement, addLot, consumeLots } from "@/lib/inventory/ledger";
import { WIP_WAREHOUSE } from "@/lib/inventory/buckets";
import { CompleteProcessSchema } from "@/lib/contracts/materialProcessing";

const PERM = "manufacturing.material-processing";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +n.toFixed(2);
const r3 = (n: number) => +n.toFixed(3);

// POST /api/manufacturing/material-processing/[id]/complete — InProgress -> Completed.
// Clears WIP entirely (the full input qty) and receives each Finished Good's
// FINAL actual quantity into its output area. Generates a display-only FG
// Receipt number; every ledger row stays tagged to the Material Processing
// number itself for traceability (no separate receipt document/table).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "MaterialProcessing", entityId: id });
  if (denied) return denied;

  const mp = await prisma.materialProcessing.findFirst({ where: { id, tenantId: user.tenantId }, include: { outputs: true } });
  if (!mp) return NextResponse.json({ ok: false, message: "Material Processing transaction not found." }, { status: 404 });
  if (mp.status !== "InProgress") return NextResponse.json({ ok: false, message: `This transaction is ${mp.status} — only an In Progress transaction can be completed.` }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = CompleteProcessSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const finalById = new Map(parsed.data.outputs.map((o) => [o.id, o.finalActualQuantity]));
  if (mp.outputs.some((o) => !finalById.has(o.id))) return NextResponse.json({ ok: false, message: "Final actual quantity is required for every output line." }, { status: 422 });

  const processingArea = await prisma.area.findFirst({ where: { id: mp.processingAreaId, tenantId: user.tenantId } });
  if (!processingArea) return NextResponse.json({ ok: false, message: "Processing Area not found." }, { status: 422 });
  const outputAreaIds = Array.from(new Set(mp.outputs.map((o) => o.outputAreaId)));
  const outputAreas = await prisma.area.findMany({ where: { id: { in: outputAreaIds }, tenantId: user.tenantId } });
  const outputAreaById = new Map(outputAreas.map((a) => [a.id, a]));

  const inputQty = num(mp.inputQuantity);
  const totalFinalQty = r3(mp.outputs.reduce((s, o) => s + (finalById.get(o.id) ?? 0), 0));
  const processLossQty = r3(inputQty - totalFinalQty);
  const year = mp.processingDate.slice(0, 4) || String(new Date().getFullYear());
  const today = new Date().toISOString().slice(0, 10);

  try {
    await prisma.$transaction(async (tx) => {
      // Clear WIP entirely — the full input qty leaves WIP regardless of the
      // total final output (any shortfall is unaccounted loss, not re-posted).
      let wipRes = await consumeLots(tx, user.tenantId, mp.branchId ?? null, mp.rawMaterialProductId, WIP_WAREHOUSE, inputQty);
      if (wipRes.taken < inputQty - 0.001) {
        const shortfall = r3(inputQty - wipRes.taken);
        const fb = await consumeLots(tx, user.tenantId, mp.branchId ?? null, mp.rawMaterialProductId, WIP_WAREHOUSE, shortfall);
        wipRes = { cost: r2(wipRes.cost + fb.cost), taken: inputQty, batchNo: wipRes.batchNo ?? fb.batchNo, mfgDate: wipRes.mfgDate ?? fb.mfgDate, expiryDate: wipRes.expiryDate ?? fb.expiryDate, grnId: wipRes.grnId ?? fb.grnId };
      }
      const totalWipCost = wipRes.cost;

      // Split WIP's clearance into what actually became productive output
      // (posted as MP_WIP_OUT, shown under Transfer Out) vs. what didn't
      // (MP_WASTAGE — the process loss, shown under its own Wastage column),
      // each carrying its proportional share of the raw material's cost so
      // nothing silently vanishes from the valuation.
      const transferQty = r3(Math.min(totalFinalQty, inputQty));
      const wastageQty = r3(Math.max(0, inputQty - transferQty));

      if (transferQty > 0.0005) {
        await postMovement(tx, {
          tenantId: user.tenantId, businessId: mp.businessId ?? undefined, branchId: mp.branchId ?? undefined,
          productId: mp.rawMaterialProductId, txnType: "MP_WIP_OUT", direction: "OUT", qty: transferQty,
          rate: r2(totalWipCost * (transferQty / inputQty) / transferQty), warehouse: WIP_WAREHOUSE, areaId: processingArea.id,
          refType: "MATERIAL_PROCESSING", refId: mp.id, refNo: mp.processingNumber, txnDate: today, createdBy: user.id,
          remarks: `WIP cleared to Finished Goods on completion of Material Processing ${mp.processingNumber}`,
        });
      }
      if (wastageQty > 0.0005) {
        await postMovement(tx, {
          tenantId: user.tenantId, businessId: mp.businessId ?? undefined, branchId: mp.branchId ?? undefined,
          productId: mp.rawMaterialProductId, txnType: "MP_WASTAGE", direction: "OUT", qty: wastageQty,
          rate: r2(totalWipCost * (wastageQty / inputQty) / wastageQty), warehouse: WIP_WAREHOUSE, areaId: processingArea.id,
          refType: "MATERIAL_PROCESSING", refId: mp.id, refNo: mp.processingNumber, txnDate: today, createdBy: user.id,
          remarks: `Process Loss — Material Processing ${mp.processingNumber}`,
        });
      }

      const fgReceiptNo = `FGR-${year}-${String(mp.id).padStart(5, "0")}`;
      for (const o of mp.outputs) {
        const finalQty = r3(finalById.get(o.id) ?? 0);
        await tx.materialProcessingOutput.update({ where: { id: o.id }, data: { finalActualQuantity: finalQty } });
        if (finalQty <= 0) continue;
        const outArea = outputAreaById.get(o.outputAreaId);
        if (!outArea) continue;
        // Allocate the raw material's total WIP cost proportionally by each
        // line's share of the total final output, so FG receipt values aren't
        // left at zero — physical process loss absorbs no residual value.
        const shareCost = totalFinalQty > 0 ? r2(totalWipCost * (finalQty / totalFinalQty)) : 0;
        const unitRate = finalQty > 0 ? r2(shareCost / finalQty) : 0;

        await postMovement(tx, {
          tenantId: user.tenantId, businessId: mp.businessId ?? undefined, branchId: mp.branchId ?? undefined,
          productId: o.productId, txnType: "MP_RECEIPT", direction: "IN", qty: finalQty, rate: unitRate,
          warehouse: outArea.name, areaId: outArea.id,
          refType: "MATERIAL_PROCESSING", refId: mp.id, refNo: mp.processingNumber, txnDate: today, createdBy: user.id,
          remarks: `Finished Goods Receipt ${fgReceiptNo} — from Material Processing ${mp.processingNumber}`,
        });
        await addLot(tx, {
          tenantId: user.tenantId, businessId: mp.businessId ?? undefined, branchId: mp.branchId ?? undefined,
          productId: o.productId, warehouse: outArea.name, areaId: outArea.id,
          refType: "MATERIAL_PROCESSING", refId: mp.id, refNo: mp.processingNumber, receivedDate: today,
          qty: finalQty, unitRate,
        });
      }

      await tx.materialProcessing.update({
        where: { id: mp.id },
        data: { status: "Completed", completedAt: new Date(), completedBy: user.id, finalOutputQty: totalFinalQty, processLossQty, fgReceiptNo },
      });
    }, { maxWait: 10_000, timeout: 30_000 });

    await writeAudit(prisma, user, { action: "material_processing.complete", entity: "MaterialProcessing", entityId: mp.id, summary: `Completed Material Processing ${mp.processingNumber} — ${totalFinalQty} ${mp.inputUom ?? ""} received (loss ${processLossQty})`, meta: { totalFinalQty, processLossQty }, businessId: mp.businessId ?? null, branchId: mp.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Material Processing completed — Finished Goods received." });
  } catch (err) {
    console.error("[material-processing] complete error", err);
    return NextResponse.json({ ok: false, message: "Could not complete processing." }, { status: 500 });
  }
}
