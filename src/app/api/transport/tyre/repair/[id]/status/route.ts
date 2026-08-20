import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { repairStatusInput } from "@/lib/contracts/tyre";
import { logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
type Action = "start" | "complete" | "cancel";
const NEXT: Record<Action, Record<string, string>> = {
  start: { Draft: "InProgress" },
  complete: { Draft: "Completed", InProgress: "Completed" },
  cancel: { Draft: "Cancelled", InProgress: "Cancelled" },
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const repair = await prisma.tyreRepair.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!repair) return NextResponse.json({ ok: false, message: "Repair not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreRepair", entityId: id, businessId: repair.businessId, branchId: repair.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = repairStatusInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  if (b.action === "cancel" && !b.cancellationReason?.trim()) return NextResponse.json({ ok: false, message: "A cancellation reason is required." }, { status: 422 });

  const to = NEXT[b.action]?.[repair.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${b.action} a repair that is ${repair.status}.` }, { status: 422 });

  const tyre = await prisma.tyreMaster.findFirst({ where: { id: repair.tyreId, tenantId: user.tenantId } });

  await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = { status: to, updatedBy: user.id };
    if (b.action === "cancel") { data.cancelledBy = user.id; data.cancelledAt = new Date(); data.cancellationReason = b.cancellationReason; }
    await tx.tyreRepair.update({ where: { id }, data });
    if (b.action === "complete" && tyre) await tx.tyreMaster.update({ where: { id: tyre.id }, data: { status: "Available", updatedBy: user.id } });
    if (b.action === "cancel" && tyre?.status === "Under Repair") await tx.tyreMaster.update({ where: { id: tyre.id }, data: { status: "Available", updatedBy: user.id } });
  });

  if (b.action === "complete" && tyre) await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: repair.businessId, branchId: repair.branchId, tyreId: tyre.id, eventType: "RepairCompleted", cost: repair.totalCost != null ? Number(repair.totalCost) : null, refEntity: "TyreRepair", refId: id, actorUserId: user.id, actorName: user.fullName ?? null });
  await writeAudit(prisma, user, { action: `tyre.repair.${b.action}`, entity: "TyreRepair", entityId: id, summary: `Repair ${repair.repairNo} ${repair.status} → ${to}`, businessId: repair.businessId, branchId: repair.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: to, message: "Repair status updated." });
}
