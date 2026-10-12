import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { tyreMasterInput, type TyreDetail } from "@/lib/contracts/tyre";
import { computeTyreLifeAndCost } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const id = Number(params.id);
  const r = await prisma.tyreMaster.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null } });
  if (!r) return NextResponse.json({ ok: false, message: "Tyre not found." }, { status: 404 });

  const vehicle = r.currentVehicleId != null ? await prisma.vehicleMaster.findFirst({ where: { id: r.currentVehicleId }, select: { vehicleNo: true } }) : null;
  const { lifeKm, firstLifeKm, retreadLifeKm, netCost, costPerKm } = await computeTyreLifeAndCost(user.tenantId, id);

  const detail: TyreDetail = {
    id: r.id, tyreCode: r.tyreCode, serialNo: r.serialNo, brand: r.brand, size: r.size, tyreType: r.tyreType, category: r.category,
    status: r.status, currentVehicleId: r.currentVehicleId, currentVehicleNo: vehicle?.vehicleNo ?? null, currentPositionCode: r.currentPositionCode,
    purchaseCost: num(r.purchaseCost) ?? 0, retreadCount: r.retreadCount, createdAt: r.createdAt.toISOString(),
    pattern: r.pattern, productId: r.productId, supplierId: r.supplierId, supplierName: r.supplierName,
    purchaseDate: r.purchaseDate?.toISOString() ?? null, purchaseInvoiceNo: r.purchaseInvoiceNo,
    warrantyMonths: r.warrantyMonths, warrantyKm: num(r.warrantyKm), warrantyExpiryDate: r.warrantyExpiryDate?.toISOString() ?? null,
    originalTreadDepthMm: num(r.originalTreadDepthMm), minTreadDepthMm: num(r.minTreadDepthMm), ratedPressurePsi: num(r.ratedPressurePsi),
    remarks: r.remarks, lifeKm, firstLifeKm, retreadLifeKm, netCost, costPerKm,
  };
  return NextResponse.json({ ok: true, tyre: detail });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.tyreMaster.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null } });
  if (!existing) return NextResponse.json({ ok: false, message: "Tyre not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreMaster", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = tyreMasterInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  let supplierName: string | null = existing.supplierName;
  if (b.supplierId && b.supplierId !== existing.supplierId) {
    const sup = await prisma.supplier.findFirst({ where: { id: b.supplierId, tenantId: user.tenantId }, select: { name: true } });
    if (!sup) return NextResponse.json({ ok: false, message: "Supplier not found." }, { status: 422 });
    supplierName = sup.name;
  } else if (!b.supplierId) supplierName = null;

  await prisma.tyreMaster.update({
    where: { id },
    data: {
      serialNo: b.serialNo ?? null, brand: b.brand ?? null, pattern: b.pattern ?? null, size: b.size ?? null,
      tyreType: b.tyreType ?? null, category: b.category ?? null,
      productId: b.productId ?? null, supplierId: b.supplierId ?? null, supplierName,
      purchaseDate: b.purchaseDate ? new Date(b.purchaseDate) : null, purchaseInvoiceNo: b.purchaseInvoiceNo ?? null, purchaseCost: b.purchaseCost,
      warrantyMonths: b.warrantyMonths ?? null, warrantyKm: b.warrantyKm ?? null, warrantyExpiryDate: b.warrantyExpiryDate ? new Date(b.warrantyExpiryDate) : null,
      originalTreadDepthMm: b.originalTreadDepthMm ?? null, minTreadDepthMm: b.minTreadDepthMm, ratedPressurePsi: b.ratedPressurePsi ?? null,
      remarks: b.remarks ?? null, updatedBy: user.id,
    },
  });

  await writeAudit(prisma, user, { action: "tyre.update", entity: "TyreMaster", entityId: id, summary: `Tyre ${existing.tyreCode} updated`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Tyre updated." });
}
