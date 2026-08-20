import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { repairInput, type RepairRow } from "@/lib/contracts/tyre";
import { getCurrentOdometer, logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const tyreId = url.searchParams.get("tyreId");
  const scope = await getActiveScope(user);
  const where: Prisma.TyreRepairWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (tyreId) where.tyreId = Number(tyreId);

  const rows = await prisma.tyreRepair.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const tyreIds = Array.from(new Set(rows.map((r) => r.tyreId)));
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId).filter((x): x is number => x != null)));
  const [tyres, vehicles] = await Promise.all([
    tyreIds.length ? prisma.tyreMaster.findMany({ where: { id: { in: tyreIds } }, select: { id: true, tyreCode: true } }) : [],
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
  ]);
  const tMap = new Map(tyres.map((t) => [t.id, t.tyreCode]));
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));

  const list: RepairRow[] = rows.map((r) => ({
    id: r.id, repairNo: r.repairNo, tyreId: r.tyreId, tyreCode: tMap.get(r.tyreId) ?? "—",
    vehicleId: r.vehicleId, vehicleNo: r.vehicleId != null ? vMap.get(r.vehicleId) ?? null : null,
    repairDate: r.repairDate.toISOString(), workshopName: r.workshopName, repairType: r.repairType, totalCost: num(r.totalCost) ?? 0, status: r.status, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreRepair" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = repairInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const tyre = await prisma.tyreMaster.findFirst({ where: { id: b.tyreId, tenantId: user.tenantId, deletedAt: null } });
  if (!tyre) return NextResponse.json({ ok: false, message: "Tyre not found." }, { status: 422 });
  // Rule: a Fitted tyre must be removed before it can be sent for repair.
  if (tyre.status === "Fitted") return NextResponse.json({ ok: false, message: `Tyre ${tyre.tyreCode} is fitted — remove it from the vehicle first.` }, { status: 422 });

  let workshopName = b.workshopName ?? null;
  if (b.workshopId) {
    const sup = await prisma.supplier.findFirst({ where: { id: b.workshopId, tenantId: user.tenantId }, select: { name: true } });
    if (!sup) return NextResponse.json({ ok: false, message: "Workshop (supplier) not found." }, { status: 422 });
    workshopName = sup.name;
  }

  const odometer = tyre.currentVehicleId ? await getCurrentOdometer(user.tenantId, tyre.currentVehicleId) : null;
  const partsCost = b.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const labourCost = b.labour.reduce((s, l) => s + (l.hours ?? 1) * l.rate, 0);
  const totalCost = partsCost + labourCost + b.otherCost;

  const scope = await getActiveScope(user);
  const seg = await resolveWriteScope(user);

  const repair = await prisma.$transaction(async (tx) => {
    const r = await tx.tyreRepair.create({
      data: {
        tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        repairNo: "TMP", tyreId: b.tyreId, vehicleId: b.vehicleId ?? tyre.currentVehicleId ?? null,
        repairDate: new Date(b.repairDate), odometer, workshopId: b.workshopId ?? null, workshopName,
        repairType: b.repairType ?? null, description: b.description ?? null,
        partsCost, labourCost, otherCost: b.otherCost, totalCost, status: "Draft", remarks: b.remarks ?? null, createdBy: user.id,
      },
    });
    if (b.items.length) await tx.vehicleMaintenanceItem.createMany({ data: b.items.map((i) => ({ tenantId: user.tenantId, tyreRepairId: r.id, productId: i.productId ?? null, itemName: i.itemName, qty: i.qty, uom: i.uom ?? null, rate: i.rate, amount: i.qty * i.rate, remarks: i.remarks ?? null })) });
    if (b.labour.length) await tx.vehicleMaintenanceLabour.createMany({ data: b.labour.map((l) => ({ tenantId: user.tenantId, tyreRepairId: r.id, description: l.description, hours: l.hours ?? null, rate: l.rate, amount: (l.hours ?? 1) * l.rate, technician: l.technician ?? null, remarks: l.remarks ?? null })) });
    await tx.tyreMaster.update({ where: { id: b.tyreId }, data: { status: "Under Repair", updatedBy: user.id } });
    const repairNo = `TRP-${String(r.id).padStart(6, "0")}`;
    await tx.tyreRepair.update({ where: { id: r.id }, data: { repairNo } });
    return { ...r, repairNo };
  });

  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, tyreId: b.tyreId, eventType: "SentForRepair", odometer, cost: totalCost, vendorId: b.workshopId ?? null, refEntity: "TyreRepair", refId: repair.id, actorUserId: user.id, actorName: user.fullName ?? null, remarks: b.remarks ?? null });
  await writeAudit(prisma, user, { action: "tyre.repair", entity: "TyreRepair", entityId: repair.id, summary: `Tyre ${tyre.tyreCode} sent for repair (${repair.repairNo})`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: repair.id, repairNo: repair.repairNo, message: "Repair recorded." }, { status: 201 });
}
