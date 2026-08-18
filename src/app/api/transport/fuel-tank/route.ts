import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { tankInput, type TankRow } from "@/lib/contracts/fuelManagement";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const scope = await getActiveScope(user);
  const where: Prisma.FuelTankWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (status && status !== "All") where.status = status;

  const rows = await prisma.fuelTank.findMany({ where, orderBy: { tankName: "asc" } });
  const stations = await prisma.fuelStation.findMany({ where: { id: { in: Array.from(new Set(rows.map((r) => r.stationId))) } }, select: { id: true, name: true } });
  const sMap = new Map(stations.map((s) => [s.id, s.name]));

  const list: TankRow[] = rows.map((r) => {
    const currentQty = num(r.currentQty) ?? 0;
    const minLevel = num(r.minLevel);
    return {
      id: r.id, tankCode: r.tankCode, tankName: r.tankName, stationId: r.stationId, stationName: sMap.get(r.stationId) ?? "—",
      fuelType: r.fuelType, capacity: num(r.capacity) ?? 0, currentQty, minLevel, maxLevel: num(r.maxLevel),
      status: r.status, lowStock: minLevel != null && currentQty < minLevel,
    };
  });
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "FuelTank" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = tankInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const station = await prisma.fuelStation.findFirst({ where: { id: b.stationId, tenantId: user.tenantId } });
  if (!station) return NextResponse.json({ ok: false, message: "Fuel station not found." }, { status: 422 });

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.fuelTank.create({
      data: { tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined, tankCode: b.tankCode, tankName: b.tankName, stationId: b.stationId, fuelType: b.fuelType, capacity: b.capacity, minLevel: b.minLevel ?? null, maxLevel: b.maxLevel ?? null, status: b.status, remarks: b.remarks ?? null, createdBy: user.id },
    });
    await writeAudit(prisma, user, { action: "fuel_tank.create", entity: "FuelTank", entityId: created.id, summary: `Created fuel tank ${created.tankCode} — ${b.tankName}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, id: created.id, message: "Fuel tank created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return NextResponse.json({ ok: false, message: `Tank code "${b.tankCode}" already exists.` }, { status: 409 });
    console.error("[fuel-tank] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the fuel tank." }, { status: 500 });
  }
}
