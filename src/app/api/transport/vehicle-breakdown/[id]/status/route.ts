import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { breakdownStatusInput } from "@/lib/contracts/vehicleMaintenance";

const PERM = "masters.transport";
type Action = "inspect" | "startRepair" | "test" | "complete" | "cancel";
const NEXT: Record<Action, Record<string, string>> = {
  inspect: { Reported: "Inspection" },
  startRepair: { Inspection: "RepairInProgress" },
  test: { RepairInProgress: "Testing" },
  complete: { Testing: "Completed", RepairInProgress: "Completed" },
  cancel: { Reported: "Cancelled", Inspection: "Cancelled", RepairInProgress: "Cancelled", Testing: "Cancelled" },
};

// POST /api/transport/vehicle-breakdown/[id]/status — { action, ...fields }.
// Controlled transitions only, mirroring Trip Management's status endpoint.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const bd = await prisma.vehicleBreakdown.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!bd) return NextResponse.json({ ok: false, message: "Breakdown not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleBreakdown", entityId: id, businessId: bd.businessId, branchId: bd.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = breakdownStatusInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  if (b.action === "cancel" && !b.cancellationReason?.trim()) return NextResponse.json({ ok: false, message: "A cancellation reason is required." }, { status: 422 });

  const to = NEXT[b.action]?.[bd.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${b.action} a breakdown that is ${bd.status}.` }, { status: 422 });

  const data: Record<string, unknown> = { status: to, updatedBy: user.id };
  if (b.diagnosisNotes) data.diagnosisNotes = b.diagnosisNotes;
  if (b.remarks) data.remarks = b.remarks;
  if (b.action === "cancel") { data.cancelledBy = user.id; data.cancelledAt = new Date(); data.cancellationReason = b.cancellationReason; }
  if (b.action === "complete") { data.releasedAt = new Date(); data.closedAt = new Date(); }

  await prisma.$transaction(async (tx) => {
    let partsCost = bd.partsCost != null ? Number(bd.partsCost) : 0;
    let labourCost = bd.labourCost != null ? Number(bd.labourCost) : 0;
    if (b.items) {
      await tx.vehicleMaintenanceItem.deleteMany({ where: { breakdownId: id } });
      if (b.items.length) await tx.vehicleMaintenanceItem.createMany({ data: b.items.map((i) => ({ tenantId: user.tenantId, breakdownId: id, productId: i.productId ?? null, itemName: i.itemName, qty: i.qty, uom: i.uom ?? null, rate: i.rate, amount: i.qty * i.rate, remarks: i.remarks ?? null })) });
      partsCost = b.items.reduce((s, i) => s + i.qty * i.rate, 0);
    }
    if (b.labour) {
      await tx.vehicleMaintenanceLabour.deleteMany({ where: { breakdownId: id } });
      if (b.labour.length) await tx.vehicleMaintenanceLabour.createMany({ data: b.labour.map((l) => ({ tenantId: user.tenantId, breakdownId: id, description: l.description, hours: l.hours ?? null, rate: l.rate, amount: (l.hours ?? 1) * l.rate, technician: l.technician ?? null, remarks: l.remarks ?? null })) });
      labourCost = b.labour.reduce((s, l) => s + (l.hours ?? 1) * l.rate, 0);
    }
    const otherCost = b.otherCost ?? (bd.otherCost != null ? Number(bd.otherCost) : 0);
    data.partsCost = partsCost; data.labourCost = labourCost; data.otherCost = otherCost;
    data.totalCost = partsCost + labourCost + otherCost;
    await tx.vehicleBreakdown.update({ where: { id }, data });
  });

  await writeAudit(prisma, user, { action: `vehicle_breakdown.${b.action}`, entity: "VehicleBreakdown", entityId: id, summary: `Breakdown ${bd.breakdownNo} ${bd.status} → ${to}`, meta: { from: bd.status, to }, businessId: bd.businessId, branchId: bd.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: to, message: `Breakdown ${b.action === "complete" ? "closed — vehicle released" : b.action === "cancel" ? "cancelled" : "updated"}.` });
}
