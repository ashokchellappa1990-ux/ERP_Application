import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { tyreMasterInput, type TyreRow } from "@/lib/contracts/tyre";
import { logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.TyreMasterWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  if (status && status !== "All") where.status = status;
  if (q) where.OR = [{ tyreCode: { contains: q } }, { serialNo: { contains: q } }, { brand: { contains: q } }];

  const rows = await prisma.tyreMaster.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const vehicleIds = Array.from(new Set(rows.map((r) => r.currentVehicleId).filter((x): x is number => x != null)));
  const vehicles = vehicleIds.length ? await prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [];
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));

  const list: TyreRow[] = rows.map((r) => ({
    id: r.id, tyreCode: r.tyreCode, serialNo: r.serialNo, brand: r.brand, size: r.size,
    tyreType: r.tyreType, category: r.category, status: r.status,
    currentVehicleId: r.currentVehicleId, currentVehicleNo: r.currentVehicleId != null ? vMap.get(r.currentVehicleId) ?? null : null,
    currentPositionCode: r.currentPositionCode,
    purchaseCost: num(r.purchaseCost) ?? 0, retreadCount: r.retreadCount, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreMaster" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = tyreMasterInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  let supplierName: string | null = null;
  if (b.supplierId) {
    const sup = await prisma.supplier.findFirst({ where: { id: b.supplierId, tenantId: user.tenantId }, select: { name: true } });
    if (!sup) return NextResponse.json({ ok: false, message: "Supplier not found." }, { status: 422 });
    supplierName = sup.name;
  }

  const scope = await getActiveScope(user);
  const seg = await resolveWriteScope(user);
  const created = await prisma.tyreMaster.create({
    data: {
      tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
      tyreCode: "TMP", serialNo: b.serialNo ?? null, brand: b.brand ?? null, pattern: b.pattern ?? null, size: b.size ?? null,
      tyreType: b.tyreType ?? null, category: b.category ?? null,
      productId: b.productId ?? null, supplierId: b.supplierId ?? null, supplierName,
      purchaseDate: b.purchaseDate ? new Date(b.purchaseDate) : null, purchaseInvoiceNo: b.purchaseInvoiceNo ?? null, purchaseCost: b.purchaseCost,
      warrantyMonths: b.warrantyMonths ?? null, warrantyKm: b.warrantyKm ?? null, warrantyExpiryDate: b.warrantyExpiryDate ? new Date(b.warrantyExpiryDate) : null,
      originalTreadDepthMm: b.originalTreadDepthMm ?? null, minTreadDepthMm: b.minTreadDepthMm, ratedPressurePsi: b.ratedPressurePsi ?? null,
      status: "In Stock", remarks: b.remarks ?? null, createdBy: user.id,
    },
  });
  const tyreCode = b.tyreCode?.trim() || `TYR-${String(created.id).padStart(6, "0")}`;
  await prisma.tyreMaster.update({ where: { id: created.id }, data: { tyreCode } });

  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, tyreId: created.id, eventType: "Purchased", cost: b.purchaseCost, refEntity: "TyreMaster", refId: created.id, actorUserId: user.id, actorName: user.fullName ?? null });
  await writeAudit(prisma, user, { action: "tyre.create", entity: "TyreMaster", entityId: created.id, summary: `Tyre ${tyreCode} added to stock`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, tyreCode, message: "Tyre added to stock." }, { status: 201 });
}
