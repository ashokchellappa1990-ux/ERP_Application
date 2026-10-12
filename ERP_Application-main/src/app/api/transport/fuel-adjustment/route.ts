import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { stockAdjustmentInput, type AdjustmentRow } from "@/lib/contracts/fuelManagement";

// Shares the module's one permission key — this app's RBAC has no per-action
// granularity to plug a "stock adjustment needs higher authorization" tier
// into (confirmed: every permission key is auto-derived 1:1 from a nav route,
// no custom/sub-keys are assignable to any role). Compensated for in the UI
// instead — Adjustment requires an explicit reason and is always audited.
const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
function dateStr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const tankId = url.searchParams.get("tankId");
  const scope = await getActiveScope(user);
  const where: Prisma.FuelStockAdjustmentWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (tankId) where.tankId = Number(tankId);

  const rows = await prisma.fuelStockAdjustment.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  const tanks = await prisma.fuelTank.findMany({ where: { id: { in: Array.from(new Set(rows.map((r) => r.tankId))) } }, select: { id: true, tankName: true } });
  const tMap = new Map(tanks.map((t) => [t.id, t.tankName]));
  const createdByIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is number => x != null)));
  const users = createdByIds.length ? await prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [];
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  const list: AdjustmentRow[] = rows.map((r) => ({
    id: r.id, adjustmentNo: r.adjustmentNo, tankId: r.tankId, tankName: tMap.get(r.tankId) ?? "—", adjustmentDate: dateStr(r.adjustmentDate) ?? "",
    adjustmentType: r.adjustmentType, quantity: num(r.quantity) ?? 0, reason: r.reason, createdByName: r.createdBy != null ? uMap.get(r.createdBy) ?? null : null, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "FuelStockAdjustment" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = stockAdjustmentInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const tank = await prisma.fuelTank.findFirst({ where: { id: b.tankId, tenantId: user.tenantId } });
  if (!tank) return NextResponse.json({ ok: false, message: "Fuel tank not found." }, { status: 422 });
  if (b.adjustmentType === "Decrease" && Number(tank.currentQty) < b.quantity) {
    return NextResponse.json({ ok: false, message: `Cannot decrease by ${b.quantity}L — tank only has ${tank.currentQty}L.` }, { status: 422 });
  }

  const seg = await resolveWriteScope(user);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.fuelStockAdjustment.create({
      data: { tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined, adjustmentNo: "TMP", tankId: b.tankId, adjustmentDate: new Date(b.adjustmentDate), adjustmentType: b.adjustmentType, quantity: b.quantity, reason: b.reason, remarks: b.remarks ?? null, createdBy: user.id },
    });
    await tx.fuelTank.update({ where: { id: b.tankId }, data: { currentQty: b.adjustmentType === "Increase" ? { increment: b.quantity } : { decrement: b.quantity } } });
    return row;
  });
  const adjustmentNo = `FADJ-${String(created.id).padStart(6, "0")}`;
  await prisma.fuelStockAdjustment.update({ where: { id: created.id }, data: { adjustmentNo } });

  await writeAudit(prisma, user, { action: "fuel_adjustment.create", entity: "FuelStockAdjustment", entityId: created.id, summary: `${b.adjustmentType} ${b.quantity}L on ${tank.tankName} — ${b.reason}`, meta: { reason: b.reason }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, adjustmentNo, message: "Stock adjustment recorded." }, { status: 201 });
}
