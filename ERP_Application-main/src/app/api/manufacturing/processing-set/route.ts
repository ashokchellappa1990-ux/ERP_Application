import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ProcessingSetSaveSchema, type ProcessingSetRow } from "@/lib/contracts/processingSet";

// Must match the permission key auto-derived from the sidebar route
// (/manufacturing/processing-set → "manufacturing.processing-set") — see
// routeKey() in lib/auth/permissions.ts.
const PERM = "manufacturing.processing-set";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/manufacturing/processing-set — list + search/filter (tenant+business scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const rawMaterialProductId = Number(url.searchParams.get("rawMaterialProductId")) || 0;

  // ProcessingSet has no branchId (a business-wide recipe master, not per-branch)
  // so scope manually to tenant + active business rather than scopeWhere({branch:true}).
  const scopeNow = await getActiveScope(user);
  const sw: Prisma.ProcessingSetWhereInput = { tenantId: scopeNow.tenantId, ...(scopeNow.businessId ? { businessId: scopeNow.businessId } : {}) };
  const where: Prisma.ProcessingSetWhereInput = { ...sw };
  if (status !== "All") where.status = status;
  if (rawMaterialProductId) where.rawMaterialProductId = rawMaterialProductId;
  if (q) {
    // Match on the set's own name/code, or on its Raw Material's name/sku —
    // rawMaterialProductId is a plain FK (no Prisma relation to Product), so
    // resolve matching product ids first.
    const matchingProducts = await prisma.product.findMany({ where: { tenantId: user.tenantId, OR: [{ name: { contains: q } }, { sku: { contains: q } }, { code: { contains: q } }] }, select: { id: true }, take: 200 });
    where.OR = [{ name: { contains: q } }, { code: { contains: q } }, ...(matchingProducts.length ? [{ rawMaterialProductId: { in: matchingProducts.map((p) => p.id) } }] : [])];
  }

  const [rows, allSets] = await Promise.all([
    prisma.processingSet.findMany({ where, orderBy: { createdAt: "desc" }, include: { outputs: true } }),
    // Unfiltered raw-material list for the filter dropdown, so it doesn't
    // shrink to just what the current filter/search happens to match.
    prisma.processingSet.findMany({ where: sw, select: { rawMaterialProductId: true }, distinct: ["rawMaterialProductId"] }),
  ]);
  const productIds = Array.from(new Set([...rows.map((r) => r.rawMaterialProductId), ...allSets.map((r) => r.rawMaterialProductId)]));
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }) : [];
  const productName = new Map(products.map((p) => [p.id, p.name]));

  const shaped: ProcessingSetRow[] = rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, rawMaterialProductId: r.rawMaterialProductId,
    rawMaterialName: productName.get(r.rawMaterialProductId) ?? "",
    outputCount: r.outputs.length,
    processLossPercentage: num(r.processLossPercentage),
    totalPercentage: +(r.outputs.reduce((s, o) => s + num(o.expectedPercentage), 0) + num(r.processLossPercentage)).toFixed(3),
    status: r.status as ProcessingSetRow["status"], createdAt: r.createdAt.toISOString(),
  }));
  const rawMaterials = allSets.map((r) => ({ id: r.rawMaterialProductId, name: productName.get(r.rawMaterialProductId) ?? "" }));
  return NextResponse.json({ ok: true, rows: shaped, rawMaterials });
}

// POST /api/manufacturing/processing-set — create a Processing Set + its
// Finished Goods output lines. Configuration only — no stock/GL posting.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ProcessingSet" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ProcessingSetSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const scope = await getActiveScope(user);

  const rawMaterial = await prisma.product.findFirst({ where: { id: b.rawMaterialProductId, tenantId: user.tenantId }, select: { id: true, inventoryCategory: true } });
  if (!rawMaterial) return NextResponse.json({ ok: false, message: "Selected Raw Material was not found." }, { status: 422 });
  if (rawMaterial.inventoryCategory && rawMaterial.inventoryCategory !== "Raw Material") {
    return NextResponse.json({ ok: false, message: "Selected product is not a Raw Material." }, { status: 422 });
  }

  const fgIds = b.outputs.map((o) => o.finishedGoodProductId);
  const fgProducts = await prisma.product.findMany({ where: { id: { in: fgIds }, tenantId: user.tenantId }, select: { id: true } });
  if (fgProducts.length !== new Set(fgIds).size) return NextResponse.json({ ok: false, message: "One or more Finished Goods were not found." }, { status: 422 });

  const dupe = await prisma.processingSet.findFirst({ where: { tenantId: user.tenantId, name: b.name } });
  if (dupe) return NextResponse.json({ ok: false, message: `Processing Set Name "${b.name}" already exists.` }, { status: 409 });

  try {
    const id = await prisma.$transaction(async (tx) => {
      const created = await tx.processingSet.create({
        data: {
          tenantId: user.tenantId, businessId: scope.businessId ?? undefined,
          code: "TMP", name: b.name, rawMaterialProductId: b.rawMaterialProductId,
          description: b.description || null, status: b.status, processLossPercentage: b.processLossPercentage, createdBy: user.id,
          outputs: { create: b.outputs.map((o, i) => ({ tenantId: user.tenantId, finishedGoodProductId: o.finishedGoodProductId, expectedPercentage: o.expectedPercentage, remarks: o.remarks || null, displayOrder: i })) },
        },
      });
      const code = `PS-${String(created.id).padStart(3, "0")}`;
      await tx.processingSet.update({ where: { id: created.id }, data: { code } });
      return created.id;
    });
    await writeAudit(prisma, user, { action: "processing_set.create", entity: "ProcessingSet", entityId: id, summary: `Processing Set "${b.name}" created`, meta: { name: b.name, rawMaterialProductId: b.rawMaterialProductId, outputCount: b.outputs.length }, businessId: scope.businessId ?? null, branchId: null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, id, message: "Processing Set created." }, { status: 201 });
  } catch (err) {
    console.error("[processing-set] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the Processing Set." }, { status: 500 });
  }
}
