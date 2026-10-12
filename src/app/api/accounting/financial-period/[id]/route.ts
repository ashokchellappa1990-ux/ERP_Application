import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const PERM = "accounting.financial-period";

// Legal status transitions. Audit-Locked is terminal (no further changes).
const ALLOWED: Record<string, string[]> = {
  "Open": ["Soft-Closed"],
  "Soft-Closed": ["Locked", "Open"],
  "Locked": ["Audit-Locked", "Open"],
  "Audit-Locked": [],
};

// PATCH /api/accounting/financial-period/[id] — advance / reopen the lock status.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "FinancialPeriod", entityId: id });
  if (denied) return denied;

  let b: { status?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const target = String(b.status ?? "");

  const period = await prisma.financialPeriod.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!period) return NextResponse.json({ ok: false, message: "Period not found." }, { status: 404 });

  if (!ALLOWED[period.status]?.includes(target)) {
    return NextResponse.json({ ok: false, message: `Cannot change status from ${period.status} to ${target || "—"}.` }, { status: 422 });
  }

  const updated = await prisma.financialPeriod.update({ where: { id: period.id }, data: { status: target } });
  await writeAudit(prisma, user, {
    action: "financial_period.status", entity: "FinancialPeriod", entityId: period.id,
    summary: `Period ${period.name} ${target === "Open" ? "reopened" : "moved to " + target}`,
    meta: { name: period.name, from: period.status, to: target },
    businessId: period.businessId, branchId: period.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: `Period ${target === "Open" ? "reopened" : "moved to " + target}.`, period: updated });
}

// DELETE /api/accounting/financial-period/[id] — remove an Open period only.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "FinancialPeriod", entityId: id });
  if (denied) return denied;

  const period = await prisma.financialPeriod.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!period) return NextResponse.json({ ok: false, message: "Period not found." }, { status: 404 });
  if (period.status !== "Open") {
    return NextResponse.json({ ok: false, message: "Only Open periods can be deleted. Reopen it first." }, { status: 422 });
  }

  await prisma.financialPeriod.delete({ where: { id: period.id } });
  await writeAudit(prisma, user, {
    action: "financial_period.delete", entity: "FinancialPeriod", entityId: period.id,
    summary: `Deleted open financial period ${period.name}`,
    meta: { name: period.name, fy: period.fy, type: period.type, fromDate: period.fromDate, toDate: period.toDate },
    businessId: period.businessId, branchId: period.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Period deleted." });
}
