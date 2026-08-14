import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { MaterialProcessingSaveSchema, type MaterialProcessingDto, type MaterialProcessingStatus } from "@/lib/contracts/materialProcessing";

const PERM = "manufacturing.material-processing";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r3 = (n: number) => +n.toFixed(3);

async function toDto(id: number, tenantId: number): Promise<MaterialProcessingDto | null> {
  const r = await prisma.materialProcessing.findFirst({ where: { id, tenantId }, include: { outputs: { orderBy: { displayOrder: "asc" } } } });
  if (!r) return null;

  const areaIds = Array.from(new Set([r.processingAreaId, r.sourceAreaId, ...r.outputs.map((o) => o.outputAreaId)]));
  const productIds = Array.from(new Set([r.rawMaterialProductId, ...r.outputs.map((o) => o.productId)]));
  const userIds = Array.from(new Set([r.createdBy, r.initiatedBy, r.completedBy, r.cancelledBy].filter((v): v is number => v != null)));
  const [areas, products, users, set, branches, ledgerRows] = await Promise.all([
    prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true, code: true, baseUom: true } }),
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : Promise.resolve([]),
    prisma.processingSet.findFirst({ where: { id: r.processingSetId }, select: { code: true, name: true } }),
    getAllowedScope({ tenantId }),
    prisma.inventoryLedger.findMany({ where: { tenantId, refType: "MATERIAL_PROCESSING", refId: r.id }, orderBy: { id: "asc" } }),
  ]);
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const userName = new Map(users.map((u) => [u.id, u.fullName]));
  const branchName = new Map(branches.branches.map((b) => [b.id, b.name]));
  const ledgerMovements = ledgerRows.map((l) => ({
    id: l.id, txnDate: l.txnDate, txnType: l.txnType, direction: l.direction as "IN" | "OUT",
    productName: productById.get(l.productId)?.name ?? "", qty: num(l.qty), warehouse: l.warehouse ?? "",
    areaName: l.areaId != null ? (areaName.get(l.areaId) ?? "") : "", value: l.purchaseValue != null ? num(l.purchaseValue) : null,
  }));
  const rm = productById.get(r.rawMaterialProductId);

  const outputs = r.outputs.map((o) => {
    const p = productById.get(o.productId);
    return {
      id: o.id, productId: o.productId, productName: p?.name ?? "", productSku: p?.sku ?? p?.code ?? "",
      configuredPercentage: o.configuredPercentage != null ? num(o.configuredPercentage) : null,
      actualPercentage: num(o.actualPercentage), calculatedQuantity: num(o.calculatedQuantity), actualQuantity: num(o.actualQuantity),
      finalActualQuantity: o.finalActualQuantity != null ? num(o.finalActualQuantity) : null,
      outputAreaId: o.outputAreaId, outputAreaName: areaName.get(o.outputAreaId) ?? "", outputType: o.outputType, remarks: o.remarks,
    };
  });

  return {
    id: r.id, processingNumber: r.processingNumber, processingDate: r.processingDate,
    branchId: r.branchId, branchName: r.branchId ? (branchName.get(r.branchId) ?? "") : "All branches",
    processingAreaId: r.processingAreaId, processingAreaName: areaName.get(r.processingAreaId) ?? "",
    processingUnit: r.processingUnit,
    processingSetId: r.processingSetId, processingSetCode: set?.code ?? "", processingSetName: set?.name ?? "",
    rawMaterialProductId: r.rawMaterialProductId, rawMaterialName: rm?.name ?? "", rawMaterialSku: rm?.sku ?? rm?.code ?? "",
    sourceAreaId: r.sourceAreaId, sourceAreaName: areaName.get(r.sourceAreaId) ?? "",
    inputQuantity: num(r.inputQuantity), inputUom: r.inputUom ?? rm?.baseUom ?? "",
    status: r.status as MaterialProcessingStatus, requireFullAllocation: r.requireFullAllocation,
    totalActualOutputQty: num(r.totalActualOutputQty), finalOutputQty: r.finalOutputQty != null ? num(r.finalOutputQty) : null,
    processLossQty: r.processLossQty != null ? num(r.processLossQty) : null,
    fgReceiptNo: r.fgReceiptNo, outputs, ledgerMovements,
    createdBy: r.createdBy, createdByName: r.createdByName ?? (r.createdBy ? (userName.get(r.createdBy) ?? null) : null),
    createdAt: r.createdAt.toISOString(),
    initiatedAt: r.initiatedAt ? r.initiatedAt.toISOString() : null, initiatedByName: r.initiatedBy ? (userName.get(r.initiatedBy) ?? null) : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null, completedByName: r.completedBy ? (userName.get(r.completedBy) ?? null) : null,
    cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null, cancelledByName: r.cancelledBy ? (userName.get(r.cancelledBy) ?? null) : null,
    cancelReason: r.cancelReason, updatedAt: r.updatedAt.toISOString(),
  };
}

// GET /api/manufacturing/material-processing/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const data = await toDto(Number(params.id), user.tenantId);
  if (!data) return NextResponse.json({ ok: false, message: "Material Processing transaction not found." }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}

// PUT /api/manufacturing/material-processing/[id] — Draft only; full re-plan
// of the header + outputs. In Progress / Completed / Cancelled are read-only
// here (Initiate/Complete/Cancel are separate actions with their own rules).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "MaterialProcessing", entityId: id });
  if (denied) return denied;

  const cur = await prisma.materialProcessing.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Material Processing transaction not found." }, { status: 404 });
  if (cur.status !== "Draft") return NextResponse.json({ ok: false, message: `This transaction is ${cur.status} and can no longer be edited this way.` }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = MaterialProcessingSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branchId = b.branchId ?? cur.branchId ?? scope.branchId;
  if (branchId && !allowed.branches.some((x) => x.id === branchId)) return NextResponse.json({ ok: false, message: "Selected branch was not found." }, { status: 422 });

  const processingArea = await prisma.area.findFirst({ where: { id: b.processingAreaId, tenantId: user.tenantId } });
  if (!processingArea || processingArea.type !== "Processing" || processingArea.status !== "Active") return NextResponse.json({ ok: false, message: "Selected Processing Area is invalid." }, { status: 422 });
  if (branchId && processingArea.branchId !== branchId) return NextResponse.json({ ok: false, message: "Selected Processing Area does not belong to the selected branch." }, { status: 422 });

  const set = await prisma.processingSet.findFirst({ where: { id: b.processingSetId, tenantId: user.tenantId } });
  if (!set || set.status !== "Active") return NextResponse.json({ ok: false, message: "Selected Processing Set is invalid." }, { status: 422 });
  const rawMaterialProductId = set.rawMaterialProductId;

  const sourceArea = await prisma.area.findFirst({ where: { id: b.sourceAreaId, tenantId: user.tenantId } });
  if (!sourceArea || sourceArea.status !== "Active") return NextResponse.json({ ok: false, message: "Selected Source Storage Area is invalid." }, { status: 422 });
  if (branchId && sourceArea.branchId !== branchId) return NextResponse.json({ ok: false, message: "Selected Source Storage Area does not belong to the selected branch." }, { status: 422 });

  const outputAreaIds = Array.from(new Set(b.outputs.map((o) => o.outputAreaId)));
  const outputAreas = await prisma.area.findMany({ where: { id: { in: outputAreaIds }, tenantId: user.tenantId } });
  if (outputAreas.length !== outputAreaIds.length) return NextResponse.json({ ok: false, message: "One or more Output Storage Areas were not found." }, { status: 422 });
  const inactiveOut = outputAreas.find((a) => a.status !== "Active" || (branchId && a.branchId !== branchId));
  if (inactiveOut) return NextResponse.json({ ok: false, message: `Output Storage Area "${inactiveOut.name}" is inactive or not in the selected branch.` }, { status: 422 });

  const productIds = Array.from(new Set(b.outputs.map((o) => o.productId)));
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId }, select: { id: true } });
  if (products.length !== productIds.length) return NextResponse.json({ ok: false, message: "One or more Finished Good products were not found." }, { status: 422 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.materialProcessingOutput.deleteMany({ where: { materialProcessingId: cur.id } });
      await tx.materialProcessing.update({
        where: { id: cur.id },
        data: {
          branchId: branchId ?? undefined, processingDate: b.processingDate,
          processingAreaId: b.processingAreaId, processingUnit: b.processingUnit || null,
          processingSetId: b.processingSetId, rawMaterialProductId, sourceAreaId: b.sourceAreaId,
          inputQuantity: b.inputQuantity, inputUom: b.inputUom || undefined,
          totalActualOutputQty: r3(b.outputs.reduce((s, o) => s + o.actualQuantity, 0)),
          updatedBy: user.id,
          outputs: {
            create: b.outputs.map((o, i) => ({
              tenantId: user.tenantId, productId: o.productId,
              configuredPercentage: o.configuredPercentage ?? null,
              actualPercentage: o.actualPercentage, actualQuantity: o.actualQuantity,
              calculatedQuantity: o.configuredPercentage != null ? r3(b.inputQuantity * (o.configuredPercentage / 100)) : o.actualQuantity,
              outputAreaId: o.outputAreaId, remarks: o.remarks || null, displayOrder: i,
            })),
          },
        },
      });
    });
    await writeAudit(prisma, user, { action: "material_processing.update", entity: "MaterialProcessing", entityId: cur.id, summary: `Material Processing draft "${cur.processingNumber}" updated`, meta: { outputCount: b.outputs.length }, businessId: cur.businessId ?? null, branchId: cur.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Material Processing updated." });
  } catch (err) {
    console.error("[material-processing] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the Material Processing transaction." }, { status: 500 });
  }
}

// DELETE /api/manufacturing/material-processing/[id] — a Draft may be deleted
// outright (no stock impact ever existed); anything else must go through Cancel.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "MaterialProcessing", entityId: id });
  if (denied) return denied;

  const cur = await prisma.materialProcessing.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Material Processing transaction not found." }, { status: 404 });
  if (cur.status !== "Draft") return NextResponse.json({ ok: false, message: "Only a Draft transaction can be deleted — cancel it instead." }, { status: 422 });

  await prisma.materialProcessing.delete({ where: { id: cur.id } });
  await writeAudit(prisma, user, { action: "material_processing.delete", entity: "MaterialProcessing", entityId: cur.id, summary: `Deleted draft Material Processing ${cur.processingNumber}`, businessId: cur.businessId ?? null, branchId: cur.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Draft deleted." });
}
