import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { retreadingInput, type RetreadingRow } from "@/lib/contracts/tyre";
import { logTyreMovement } from "@/lib/transport/tyre";

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
  const where: Prisma.TyreRetreadingWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (tyreId) where.tyreId = Number(tyreId);

  const rows = await prisma.tyreRetreading.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const tyreIds = Array.from(new Set(rows.map((r) => r.tyreId)));
  const tyres = tyreIds.length ? await prisma.tyreMaster.findMany({ where: { id: { in: tyreIds } }, select: { id: true, tyreCode: true } }) : [];
  const tMap = new Map(tyres.map((t) => [t.id, t.tyreCode]));

  const list: RetreadingRow[] = rows.map((r) => ({
    id: r.id, retreadNo: r.retreadNo, tyreId: r.tyreId, tyreCode: tMap.get(r.tyreId) ?? "—",
    sentDate: r.sentDate.toISOString(), vendorName: r.vendorName, cost: num(r.cost) ?? 0,
    receivedDate: r.receivedDate?.toISOString() ?? null, status: r.status, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreRetreading" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = retreadingInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const tyre = await prisma.tyreMaster.findFirst({ where: { id: b.tyreId, tenantId: user.tenantId, deletedAt: null } });
  if (!tyre) return NextResponse.json({ ok: false, message: "Tyre not found." }, { status: 422 });
  // Rule: a Fitted tyre must be removed before it can be sent for retreading.
  if (tyre.status === "Fitted") return NextResponse.json({ ok: false, message: `Tyre ${tyre.tyreCode} is fitted — remove it from the vehicle first.` }, { status: 422 });

  let vendorName = b.vendorName ?? null;
  if (b.vendorId) {
    const sup = await prisma.supplier.findFirst({ where: { id: b.vendorId, tenantId: user.tenantId }, select: { name: true } });
    if (!sup) return NextResponse.json({ ok: false, message: "Retreading vendor not found." }, { status: 422 });
    vendorName = sup.name;
  }

  const scope = await getActiveScope(user);
  const seg = await resolveWriteScope(user);

  const retread = await prisma.$transaction(async (tx) => {
    const r = await tx.tyreRetreading.create({
      data: {
        tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        retreadNo: "TMP", tyreId: b.tyreId, sentDate: new Date(b.sentDate), sentOdometer: null,
        vendorId: b.vendorId ?? null, vendorName, retreadType: b.retreadType ?? null, cost: b.cost, status: "Sent", remarks: b.remarks ?? null, createdBy: user.id,
      },
    });
    await tx.tyreMaster.update({ where: { id: b.tyreId }, data: { status: "Under Retreading", updatedBy: user.id } });
    const retreadNo = `RTD-${String(r.id).padStart(6, "0")}`;
    await tx.tyreRetreading.update({ where: { id: r.id }, data: { retreadNo } });
    return { ...r, retreadNo };
  });

  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, tyreId: b.tyreId, eventType: "SentForRetreading", cost: b.cost, vendorId: b.vendorId ?? null, refEntity: "TyreRetreading", refId: retread.id, actorUserId: user.id, actorName: user.fullName ?? null, remarks: b.remarks ?? null });
  await writeAudit(prisma, user, { action: "tyre.retread", entity: "TyreRetreading", entityId: retread.id, summary: `Tyre ${tyre.tyreCode} sent for retreading (${retread.retreadNo})`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: retread.id, retreadNo: retread.retreadNo, message: "Sent for retreading." }, { status: 201 });
}
