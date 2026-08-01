import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { dispatchPlanningActionInput } from "@/lib/contracts/transport";

const PERM = "warehouse";

// Allowed transitions per current status. "assign-vehicle" here only moves
// Approved → "Vehicle Assigned" — "Vehicle Pending" is an informational status
// that a future Dispatch Execution / Gate flow may set on this plan, not
// something this route needs to produce.
const NEXT: Record<string, Record<string, string>> = {
  approve: { Draft: "Approved" },
  "assign-vehicle": { Approved: "Vehicle Assigned" },
  complete: { "Vehicle Assigned": "Completed" },
  cancel: { Draft: "Cancelled", Approved: "Cancelled", "Vehicle Pending": "Cancelled", "Vehicle Assigned": "Cancelled" },
};

// POST /api/transport/dispatch-planning/[id]/status — { action, remarks? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "DispatchPlanning" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = dispatchPlanningActionInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid action." }, { status: 422 });
  const { action, remarks } = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const plan = await prisma.dispatchPlanning.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, select: { id: true, planningNo: true, status: true, businessId: true, branchId: true } });
  if (!plan) return NextResponse.json({ ok: false, message: "Dispatch plan not found." }, { status: 404 });

  const to = NEXT[action]?.[plan.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${action.replace("-", " ")} a ${plan.status} dispatch plan.` }, { status: 422 });

  const data: Record<string, unknown> = { status: to };
  if (action === "approve") { data.approvedBy = user.id; data.approvedByName = user.fullName ?? null; data.approvedAt = new Date(); }
  if (action === "cancel") { data.cancelledAt = new Date(); data.cancelReason = remarks ?? null; }
  await prisma.dispatchPlanning.update({ where: { id: plan.id }, data });
  await writeAudit(prisma, user, { action: `dispatch_planning.${action.replace("-", "_")}`, entity: "DispatchPlanning", entityId: plan.id, summary: `Dispatch plan ${plan.planningNo} ${plan.status} → ${to}`, meta: { remarks }, businessId: plan.businessId ?? null, branchId: plan.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: `Dispatch plan ${to.toLowerCase()}.`, status: to });
}
