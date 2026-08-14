import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { getProcessingConfig } from "@/lib/settings/processingConfig";
import { MaterialProcessingSaveSchema, type MaterialProcessingRow, type MaterialProcessingStatus } from "@/lib/contracts/materialProcessing";

// Must match the permission key auto-derived from the sidebar route
// (/manufacturing/material-processing → "manufacturing.material-processing")
// — see routeKey() in lib/auth/permissions.ts.
const PERM = "manufacturing.material-processing";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r3 = (n: number) => +n.toFixed(3);

// GET /api/manufacturing/material-processing — list + search/filter.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const processingSetId = Number(url.searchParams.get("processingSetId")) || 0;
  const rawMaterialProductId = Number(url.searchParams.get("rawMaterialProductId")) || 0;
  const processingAreaId = Number(url.searchParams.get("processingAreaId")) || 0;
  const branchId = Number(url.searchParams.get("branchId")) || 0;
  const dateFrom = (url.searchParams.get("dateFrom") ?? "").trim();
  const dateTo = (url.searchParams.get("dateTo") ?? "").trim();

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.MaterialProcessingWhereInput = { ...sw };
  if (status !== "All") where.status = status;
  if (processingSetId) where.processingSetId = processingSetId;
  if (rawMaterialProductId) where.rawMaterialProductId = rawMaterialProductId;
  if (processingAreaId) where.processingAreaId = processingAreaId;
  if (branchId) where.branchId = branchId;
  if (dateFrom || dateTo) where.processingDate = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) };
  if (q) where.OR = [{ processingNumber: { contains: q } }];

  const rows = await prisma.materialProcessing.findMany({ where, orderBy: { createdAt: "desc" }, take: 500, include: { outputs: { select: { id: true } } } });

  const [branches, areaIds, setIds, productIds] = [
    (await getAllowedScope(user)).branches,
    Array.from(new Set(rows.map((r) => r.processingAreaId))),
    Array.from(new Set(rows.map((r) => r.processingSetId))),
    Array.from(new Set(rows.map((r) => r.rawMaterialProductId))),
  ];
  const [areas, sets, products] = await Promise.all([
    areaIds.length ? prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    setIds.length ? prisma.processingSet.findMany({ where: { id: { in: setIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, baseUom: true } }) : Promise.resolve([]),
  ]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const setName = new Map(sets.map((s) => [s.id, s.name]));
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const productUom = new Map(products.map((p) => [p.id, p.baseUom ?? ""]));

  const shaped: MaterialProcessingRow[] = rows.map((r) => ({
    id: r.id, processingNumber: r.processingNumber, processingDate: r.processingDate,
    branchName: r.branchId ? (branchName.get(r.branchId) ?? "") : "All branches",
    processingAreaName: areaName.get(r.processingAreaId) ?? "",
    processingSetName: setName.get(r.processingSetId) ?? "",
    rawMaterialName: productName.get(r.rawMaterialProductId) ?? "",
    inputQuantity: num(r.inputQuantity), inputUom: r.inputUom ?? productUom.get(r.rawMaterialProductId) ?? "",
    outputCount: r.outputs.length, status: r.status as MaterialProcessingStatus, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped });
}

// POST /api/manufacturing/material-processing — create a Draft transaction,
// starting from a Processing Set template (its raw material + output % are
// COPIED in, never dynamically re-read afterwards). No stock impact at Draft.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "MaterialProcessing" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = MaterialProcessingSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branchId = b.branchId ?? scope.branchId;
  if (branchId && !allowed.branches.some((x) => x.id === branchId)) return NextResponse.json({ ok: false, message: "Selected branch was not found." }, { status: 422 });

  const processingArea = await prisma.area.findFirst({ where: { id: b.processingAreaId, tenantId: user.tenantId } });
  if (!processingArea) return NextResponse.json({ ok: false, message: "Selected Processing Area was not found." }, { status: 422 });
  if (processingArea.type !== "Processing") return NextResponse.json({ ok: false, message: "Selected area is not configured as a Processing area." }, { status: 422 });
  if (processingArea.status !== "Active") return NextResponse.json({ ok: false, message: "Selected Processing Area is inactive." }, { status: 422 });
  if (branchId && processingArea.branchId !== branchId) return NextResponse.json({ ok: false, message: "Selected Processing Area does not belong to the selected branch." }, { status: 422 });

  const set = await prisma.processingSet.findFirst({ where: { id: b.processingSetId, tenantId: user.tenantId } });
  if (!set) return NextResponse.json({ ok: false, message: "Selected Processing Set was not found." }, { status: 422 });
  if (set.status !== "Active") return NextResponse.json({ ok: false, message: "Selected Processing Set is inactive." }, { status: 422 });
  // Raw Material is ALWAYS derived from the set — never trusted from the client.
  const rawMaterialProductId = set.rawMaterialProductId;

  const sourceArea = await prisma.area.findFirst({ where: { id: b.sourceAreaId, tenantId: user.tenantId } });
  if (!sourceArea) return NextResponse.json({ ok: false, message: "Selected Source Storage Area was not found." }, { status: 422 });
  if (sourceArea.status !== "Active") return NextResponse.json({ ok: false, message: "Selected Source Storage Area is inactive." }, { status: 422 });
  if (branchId && sourceArea.branchId !== branchId) return NextResponse.json({ ok: false, message: "Selected Source Storage Area does not belong to the selected branch." }, { status: 422 });

  const outputAreaIds = Array.from(new Set(b.outputs.map((o) => o.outputAreaId)));
  const outputAreas = await prisma.area.findMany({ where: { id: { in: outputAreaIds }, tenantId: user.tenantId } });
  if (outputAreas.length !== outputAreaIds.length) return NextResponse.json({ ok: false, message: "One or more Output Storage Areas were not found." }, { status: 422 });
  const inactiveOut = outputAreas.find((a) => a.status !== "Active" || (branchId && a.branchId !== branchId));
  if (inactiveOut) return NextResponse.json({ ok: false, message: `Output Storage Area "${inactiveOut.name}" is inactive or not in the selected branch.` }, { status: 422 });

  const productIds = Array.from(new Set(b.outputs.map((o) => o.productId)));
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId }, select: { id: true } });
  if (products.length !== productIds.length) return NextResponse.json({ ok: false, message: "One or more Finished Good products were not found." }, { status: 422 });

  const rmProduct = await prisma.product.findFirst({ where: { id: rawMaterialProductId }, select: { baseUom: true } });
  const processingConfig = await getProcessingConfig(user);
  const year = b.processingDate.slice(0, 4) || String(new Date().getFullYear());

  try {
    const id = await prisma.$transaction(async (tx) => {
      const created = await tx.materialProcessing.create({
        data: {
          tenantId: user.tenantId, ...scopeData(scope, { branch: false }), branchId: branchId ?? undefined,
          processingNumber: "TMP", processingDate: b.processingDate,
          processingAreaId: b.processingAreaId, processingUnit: b.processingUnit || null,
          processingSetId: b.processingSetId, rawMaterialProductId, sourceAreaId: b.sourceAreaId,
          inputQuantity: b.inputQuantity, inputUom: b.inputUom || rmProduct?.baseUom || null,
          status: "Draft", requireFullAllocation: processingConfig.flags.requireFullOutputAllocation,
          totalActualOutputQty: r3(b.outputs.reduce((s, o) => s + o.actualQuantity, 0)),
          createdBy: user.id, createdByName: user.fullName,
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
      const processingNumber = `MP-${year}-${String(created.id).padStart(5, "0")}`;
      await tx.materialProcessing.update({ where: { id: created.id }, data: { processingNumber } });
      return created.id;
    });
    await writeAudit(prisma, user, { action: "material_processing.create", entity: "MaterialProcessing", entityId: id, summary: `Material Processing draft created for "${set.name}"`, meta: { processingSetId: b.processingSetId, inputQuantity: b.inputQuantity, outputCount: b.outputs.length }, businessId: scope.businessId ?? null, branchId: branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, id, message: "Material Processing saved as Draft." }, { status: 201 });
  } catch (err) {
    console.error("[material-processing] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the Material Processing transaction." }, { status: 500 });
  }
}
