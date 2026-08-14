import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ProcessingSetSaveSchema, ProcessingSetStatusSchema, type ProcessingSetDto } from "@/lib/contracts/processingSet";

const PERM = "manufacturing.processing-set";
const num = (v: unknown) => (v == null ? 0 : Number(v));

async function toDto(setId: number, tenantId: number): Promise<ProcessingSetDto | null> {
  const r = await prisma.processingSet.findFirst({ where: { id: setId, tenantId }, include: { outputs: { orderBy: { displayOrder: "asc" } } } });
  if (!r) return null;
  const productIds = Array.from(new Set([r.rawMaterialProductId, ...r.outputs.map((o) => o.finishedGoodProductId)]));
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true, code: true, baseUom: true } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const rm = byId.get(r.rawMaterialProductId);
  const outputs = r.outputs.map((o) => {
    const fg = byId.get(o.finishedGoodProductId);
    return { id: o.id, finishedGoodProductId: o.finishedGoodProductId, finishedGoodName: fg?.name ?? "", finishedGoodSku: fg?.sku ?? fg?.code ?? "", expectedPercentage: num(o.expectedPercentage), remarks: o.remarks };
  });
  const processLossPercentage = num(r.processLossPercentage);
  return {
    id: r.id, code: r.code, name: r.name, rawMaterialProductId: r.rawMaterialProductId,
    rawMaterialName: rm?.name ?? "", rawMaterialSku: rm?.sku ?? rm?.code ?? "", rawMaterialUom: rm?.baseUom ?? "",
    description: r.description, status: r.status as ProcessingSetDto["status"],
    outputs, processLossPercentage,
    totalPercentage: +(outputs.reduce((s, o) => s + o.expectedPercentage, 0) + processLossPercentage).toFixed(3),
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

// GET /api/manufacturing/processing-set/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const data = await toDto(Number(params.id), user.tenantId);
  if (!data) return NextResponse.json({ ok: false, message: "Processing Set not found." }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}

// PUT /api/manufacturing/processing-set/[id] — replace name/raw material/description/outputs.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "ProcessingSet", entityId: id });
  if (denied) return denied;

  const cur = await prisma.processingSet.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Processing Set not found." }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ProcessingSetSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const rawMaterial = await prisma.product.findFirst({ where: { id: b.rawMaterialProductId, tenantId: user.tenantId }, select: { id: true, inventoryCategory: true } });
  if (!rawMaterial) return NextResponse.json({ ok: false, message: "Selected Raw Material was not found." }, { status: 422 });
  if (rawMaterial.inventoryCategory && rawMaterial.inventoryCategory !== "Raw Material") {
    return NextResponse.json({ ok: false, message: "Selected product is not a Raw Material." }, { status: 422 });
  }
  const fgIds = b.outputs.map((o) => o.finishedGoodProductId);
  const fgProducts = await prisma.product.findMany({ where: { id: { in: fgIds }, tenantId: user.tenantId }, select: { id: true } });
  if (fgProducts.length !== new Set(fgIds).size) return NextResponse.json({ ok: false, message: "One or more Finished Goods were not found." }, { status: 422 });

  if (b.name !== cur.name) {
    const dupe = await prisma.processingSet.findFirst({ where: { tenantId: user.tenantId, name: b.name, id: { not: cur.id } } });
    if (dupe) return NextResponse.json({ ok: false, message: `Processing Set Name "${b.name}" already exists.` }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.processingSetOutput.deleteMany({ where: { processingSetId: cur.id } });
      await tx.processingSet.update({
        where: { id: cur.id },
        data: {
          name: b.name, rawMaterialProductId: b.rawMaterialProductId, description: b.description || null, status: b.status, processLossPercentage: b.processLossPercentage, updatedBy: user.id,
          outputs: { create: b.outputs.map((o, i) => ({ tenantId: user.tenantId, finishedGoodProductId: o.finishedGoodProductId, expectedPercentage: o.expectedPercentage, remarks: o.remarks || null, displayOrder: i })) },
        },
      });
    });
    await writeAudit(prisma, user, { action: "processing_set.update", entity: "ProcessingSet", entityId: cur.id, summary: `Processing Set "${b.name}" updated`, meta: { name: b.name, outputCount: b.outputs.length }, businessId: cur.businessId ?? null, branchId: null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Processing Set updated." });
  } catch (err) {
    console.error("[processing-set] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the Processing Set." }, { status: 500 });
  }
}

// PATCH /api/manufacturing/processing-set/[id] — Activate / Deactivate.
// Deactivating never touches historical data — it only stops the set from
// being offered to NEW processing transactions (future feature).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "ProcessingSet", entityId: id });
  if (denied) return denied;

  const cur = await prisma.processingSet.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Processing Set not found." }, { status: 404 });

  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = ProcessingSetStatusSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 422 });

  await prisma.processingSet.update({ where: { id: cur.id }, data: { status: parsed.data.status, updatedBy: user.id } });
  await writeAudit(prisma, user, { action: "processing_set.status_change", entity: "ProcessingSet", entityId: cur.id, summary: `Processing Set "${cur.name}" → ${parsed.data.status}`, meta: { from: cur.status, to: parsed.data.status }, businessId: cur.businessId ?? null, branchId: null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: parsed.data.status, message: `Processing Set ${parsed.data.status === "Inactive" ? "deactivated" : "activated"}.` });
}
