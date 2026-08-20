import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { warrantyClaimInput, type WarrantyClaimRow } from "@/lib/contracts/tyre";
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
  const where: Prisma.TyreWarrantyClaimWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (tyreId) where.tyreId = Number(tyreId);

  const rows = await prisma.tyreWarrantyClaim.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const tyreIds = Array.from(new Set(rows.map((r) => r.tyreId)));
  const tyres = tyreIds.length ? await prisma.tyreMaster.findMany({ where: { id: { in: tyreIds } }, select: { id: true, tyreCode: true } }) : [];
  const tMap = new Map(tyres.map((t) => [t.id, t.tyreCode]));

  const list: WarrantyClaimRow[] = rows.map((r) => ({
    id: r.id, claimNo: r.claimNo, tyreId: r.tyreId, tyreCode: tMap.get(r.tyreId) ?? "—",
    claimDate: r.claimDate.toISOString(), reason: r.reason, claimedAmount: num(r.claimedAmount), approvedAmount: num(r.approvedAmount),
    status: r.status, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreWarrantyClaim" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = warrantyClaimInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const tyre = await prisma.tyreMaster.findFirst({ where: { id: b.tyreId, tenantId: user.tenantId, deletedAt: null } });
  if (!tyre) return NextResponse.json({ ok: false, message: "Tyre not found." }, { status: 422 });

  let supplierName: string | null = null;
  const supplierId = b.supplierId ?? tyre.supplierId ?? null;
  if (supplierId) {
    const sup = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId: user.tenantId }, select: { name: true } });
    supplierName = sup?.name ?? null;
  }

  const scope = await getActiveScope(user);
  const seg = await resolveWriteScope(user);

  const claim = await prisma.$transaction(async (tx) => {
    const c = await tx.tyreWarrantyClaim.create({
      data: {
        tenantId: user.tenantId, ...scopeData(scope, { branch: true }), businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        claimNo: "TMP", tyreId: b.tyreId, claimDate: new Date(b.claimDate), reason: b.reason, supplierId, supplierName,
        claimedAmount: b.claimedAmount ?? null, status: "Filed", remarks: b.remarks ?? null, createdBy: user.id,
      },
    });
    if (tyre.status !== "Fitted") await tx.tyreMaster.update({ where: { id: b.tyreId }, data: { status: "Warranty Claim", updatedBy: user.id } });
    const claimNo = `WCL-${String(c.id).padStart(6, "0")}`;
    await tx.tyreWarrantyClaim.update({ where: { id: c.id }, data: { claimNo } });
    return { ...c, claimNo };
  });

  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, tyreId: b.tyreId, eventType: "WarrantyClaimed", cost: b.claimedAmount ?? null, vendorId: supplierId, refEntity: "TyreWarrantyClaim", refId: claim.id, actorUserId: user.id, actorName: user.fullName ?? null, remarks: b.reason });
  await writeAudit(prisma, user, { action: "tyre.warranty_claim.create", entity: "TyreWarrantyClaim", entityId: claim.id, summary: `Warranty claim ${claim.claimNo} filed for tyre ${tyre.tyreCode}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: claim.id, claimNo: claim.claimNo, message: "Warranty claim filed." }, { status: 201 });
}
