import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { stationInput, type StationRow } from "@/lib/contracts/fuelManagement";

const PERM = "masters.transport";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const rows = await prisma.fuelStation.findMany({ where: scopeWhere(scope, { branch: true }), orderBy: { name: "asc" } });
  const tankCounts = await prisma.fuelTank.groupBy({ by: ["stationId"], where: { tenantId: user.tenantId }, _count: true });
  const cMap = new Map(tankCounts.map((c) => [c.stationId, c._count as number]));
  const list: StationRow[] = rows.map((r) => ({ id: r.id, code: r.code, name: r.name, location: r.location, status: r.status, tankCount: cMap.get(r.id) ?? 0 }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "FuelStation" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = stationInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.fuelStation.create({ data: { tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined, code: b.code, name: b.name, location: b.location ?? null, status: b.status, remarks: b.remarks ?? null, createdBy: user.id } });
    await writeAudit(prisma, user, { action: "fuel_station.create", entity: "FuelStation", entityId: created.id, summary: `Created fuel station ${created.code} — ${b.name}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, id: created.id, message: "Fuel station created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return NextResponse.json({ ok: false, message: `Station code "${b.code}" already exists.` }, { status: 409 });
    console.error("[fuel-station] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the fuel station." }, { status: 500 });
  }
}
