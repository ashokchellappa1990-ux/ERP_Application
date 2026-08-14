import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const PERM = "transport.gate-entry";

// GET /api/transport/gate-entry/[id]/weighment — vehicle entry details (for
// read-only display) + whatever weighment/item data has already been captured,
// for the "Update Weight" follow-up screen.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const id = Number(params.id);
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id, deletedAt: null } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });

  const [vehicle, driver, company, supplier, items, area] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: entry.vehicleId }, select: { vehicleNo: true, ownerType: true } }),
    entry.driverId ? prisma.driverMaster.findFirst({ where: { id: entry.driverId }, select: { name: true, phone: true } }) : null,
    entry.transportCompanyId ? prisma.transportCompany.findFirst({ where: { id: entry.transportCompanyId }, select: { name: true } }) : null,
    entry.supplierId ? prisma.supplier.findFirst({ where: { id: entry.supplierId }, select: { gstin: true } }) : null,
    prisma.vehicleGateEntryItem.findMany({ where: { gateEntryId: id }, orderBy: { id: "asc" } }),
    entry.areaId ? prisma.area.findFirst({ where: { id: entry.areaId, tenantId: user.tenantId }, select: { name: true } }) : null,
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      id: entry.id, gateEntryNo: entry.gateEntryNo, status: entry.status, entryType: entry.entryType,
      vehicleNo: vehicle?.vehicleNo ?? "—", vehicleOwnerType: vehicle?.ownerType ?? null,
      driverName: entry.driverName || driver?.name || null, driverMobile: entry.driverMobile || driver?.phone || null,
      transportCompanyName: company?.name ?? null, transportMode: entry.transportMode,
      supplierName: entry.supplierName, supplierGstin: supplier?.gstin ?? null,
      arrivalTime: entry.arrivalTime ? entry.arrivalTime.toISOString() : null,
      grnId: entry.grnId,
      grossWeight: entry.grossWeight != null ? Number(entry.grossWeight) : null,
      tareWeight: entry.tareWeight != null ? Number(entry.tareWeight) : null,
      netWeight: entry.netWeight != null ? Number(entry.netWeight) : null,
      weightSlipRefNo: entry.weightSlipRefNo,
      areaId: entry.areaId,
      areaName: area?.name ?? null,
      items: items.map((i) => ({ productId: i.productId, productName: i.productName, sku: i.sku, uom: i.uom })),
    },
  });
}

// POST /api/transport/gate-entry/[id]/weighment — { grossWeight?, netWeight?,
// weightSlipRefNo?, inventoryMovement?, items: [{ productId, productName, sku,
// uom }] } (at most one item — Truck Weight Based GRN receives one product per
// document). Tare Weight is NOT captured here — the vehicle hasn't been
// unloaded/weighed empty yet; it's captured later on the posted GRN instead.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleGateEntry" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const b = raw as { grossWeight?: unknown; netWeight?: unknown; weightSlipRefNo?: unknown; areaId?: unknown; items?: { productId?: unknown; productName?: unknown; sku?: unknown; uom?: unknown }[] };
  const dec = (v: unknown) => { const n = Number(v); return v != null && v !== "" && Number.isFinite(n) && n >= 0 ? n : null; };
  const grossWeight = dec(b.grossWeight);
  const netWeight = dec(b.netWeight);
  const weightSlipRefNo = typeof b.weightSlipRefNo === "string" && b.weightSlipRefNo.trim() ? b.weightSlipRefNo.trim().slice(0, 60) : null;
  const areaIdInput = Number(b.areaId) || null;
  const item = (b.items ?? []).find((i) => Number(i.productId) > 0);

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, select: { id: true, gateEntryNo: true, entryType: true, grnId: true, businessId: true, branchId: true } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });
  if (entry.entryType !== "RawMaterial") return NextResponse.json({ ok: false, message: "This action only applies to Raw Material gate entries." }, { status: 422 });
  if (entry.grnId) return NextResponse.json({ ok: false, message: "A GRN has already been created for this gate entry." }, { status: 422 });

  const areaId = areaIdInput ? (await prisma.area.findFirst({ where: { id: areaIdInput, tenantId: user.tenantId }, select: { id: true } }))?.id ?? null : null;

  let productName = "", sku: string | null = null, uom: string | null = null;
  if (item) {
    const p = await prisma.product.findFirst({ where: { id: Number(item.productId), tenantId: user.tenantId }, select: { name: true, sku: true, baseUom: true } });
    if (!p) return NextResponse.json({ ok: false, message: "Selected product was not found in your catalog." }, { status: 422 });
    productName = (typeof item.productName === "string" && item.productName) || p.name;
    sku = (typeof item.sku === "string" && item.sku) || p.sku || null;
    uom = (typeof item.uom === "string" && item.uom) || p.baseUom || null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.vehicleGateEntry.update({ where: { id: entry.id }, data: { grossWeight, netWeight, weightSlipRefNo, areaId, updatedBy: user.id } });
    await tx.vehicleGateEntryItem.deleteMany({ where: { gateEntryId: entry.id } });
    if (item) {
      await tx.vehicleGateEntryItem.create({ data: { tenantId: user.tenantId, gateEntryId: entry.id, productId: Number(item.productId), productName, sku: sku ?? undefined, uom: uom ?? undefined, qty: 1 } });
    }
  });
  await writeAudit(prisma, user, { action: "vehicle_gate_entry.weighment", entity: "VehicleGateEntry", entityId: entry.id, summary: `Weighment recorded for ${entry.gateEntryNo}`, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Weighment recorded." });
}
