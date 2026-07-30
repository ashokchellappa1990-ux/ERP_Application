import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { MappingStatusSchema } from "@/lib/contracts/terminalShift";

const PERM = "pos.terminal-shifts";

// PATCH /api/pos/terminal-shifts/[id] — activate / deactivate a mapping.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "TerminalShiftMap", entityId: id });
  if (denied) return denied;

  const existing = await prisma.terminalShiftMap.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Mapping not found." }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = MappingStatusSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 422 });

  await prisma.terminalShiftMap.update({ where: { id }, data: { status: parsed.data.status } });
  await writeAudit(prisma, user, {
    action: "terminal_shift.status", entity: "TerminalShiftMap", entityId: id,
    summary: `Mapping ${existing.terminalId}→${existing.shiftId} set ${parsed.data.status}`,
    businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: `Mapping ${parsed.data.status === "active" ? "activated" : "deactivated"}.` });
}

// DELETE /api/pos/terminal-shifts/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "TerminalShiftMap", entityId: id });
  if (denied) return denied;

  const existing = await prisma.terminalShiftMap.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Mapping not found." }, { status: 404 });

  await prisma.terminalShiftMap.delete({ where: { id } });
  await writeAudit(prisma, user, {
    action: "terminal_shift.delete", entity: "TerminalShiftMap", entityId: id,
    summary: `Removed mapping ${existing.terminalId}→${existing.shiftId}`,
    businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Mapping deleted." });
}
