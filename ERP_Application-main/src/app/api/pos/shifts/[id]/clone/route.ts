import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const PERM = "pos.shifts";

// POST /api/pos/shifts/[id]/clone — duplicate a shift's configuration under a new
// code/name. Body: { code, name? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "Shift", entityId: id });
  if (denied) return denied;

  let body: { code?: string; name?: string } = {};
  try { body = await req.json(); } catch { /* code may be auto-derived */ }

  const src = await prisma.shift.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!src) return NextResponse.json({ ok: false, message: "Shift not found." }, { status: 404 });

  const code = (body.code || `${src.code}-COPY`).trim();
  const dupe = await prisma.shift.findFirst({ where: { tenantId: user.tenantId, code }, select: { id: true } });
  if (dupe) return NextResponse.json({ ok: false, message: `Shift code "${code}" already exists.` }, { status: 422 });

  const created = await prisma.shift.create({
    data: {
      tenantId: src.tenantId, businessId: src.businessId, branchId: src.branchId,
      code, name: (body.name || `${src.name} (Copy)`).trim(), description: src.description,
      startTime: src.startTime, endTime: src.endTime, crossDay: src.crossDay, gracePeriodMins: src.gracePeriodMins,
      openingCashMandatory: src.openingCashMandatory, closingCashMandatory: src.closingCashMandatory,
      physicalCountRequired: src.physicalCountRequired, managerApprovalRequired: src.managerApprovalRequired,
      maxCashDifference: src.maxCashDifference,
      status: "inactive", // clones start inactive
      config: (src.config ?? {}) as Prisma.InputJsonValue, createdBy: user.id,
    },
    select: { id: true, code: true },
  });
  await writeAudit(prisma, user, {
    action: "shift.clone", entity: "Shift", entityId: created.id,
    summary: `Cloned shift ${src.code} → ${created.code}`,
    meta: { sourceId: src.id, sourceCode: src.code }, businessId: src.businessId, branchId: src.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Shift cloned (inactive).", id: created.id }, { status: 201 });
}
