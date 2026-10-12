import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { dispatchExecutionActionInput } from "@/lib/contracts/transport";

const PERM = "transport";

/**
 * Only `assign-vehicle` and `cancel` are handled here. `gate-in` /
 * `start-loading` / `complete` are driven by the separate Gate Entry / Gate
 * Exit screens, which update DispatchExecution.status themselves as a side
 * effect (and Gate Exit ultimately calls completeExecution()) — this route
 * intentionally does not implement those transitions.
 */
const NEXT: Record<string, Record<string, string>> = {
  "assign-vehicle": { Draft: "Vehicle Assigned" },
  cancel: { Draft: "Cancelled", "Vehicle Assigned": "Cancelled", "Gate In": "Cancelled", Loading: "Cancelled", Loaded: "Cancelled" },
};

// POST /api/transport/dispatch-execution/[id]/status — { action: assign-vehicle|cancel, vehicleId?, driverId?, transportCompanyId?, remarks? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "DispatchExecution" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = dispatchExecutionActionInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid action." }, { status: 422 });
  const { action, remarks, vehicleId, driverId, transportCompanyId } = parsed.data;
  if (action !== "assign-vehicle" && action !== "cancel") {
    return NextResponse.json({ ok: false, message: `Action "${action}" is handled by the Gate Entry / Gate Exit screens, not here.` }, { status: 422 });
  }

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const exec = await prisma.dispatchExecution.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, select: { id: true, docNo: true, status: true, businessId: true, branchId: true } });
  if (!exec) return NextResponse.json({ ok: false, message: "Dispatch execution not found." }, { status: 404 });

  const to = NEXT[action]?.[exec.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${action.replace("-", " ")} a ${exec.status} dispatch execution.` }, { status: 422 });

  if (action === "assign-vehicle" && !vehicleId) return NextResponse.json({ ok: false, message: "Select a vehicle." }, { status: 422 });

  const data: Record<string, unknown> = { status: to };
  if (action === "assign-vehicle") { data.vehicleId = vehicleId; data.driverId = driverId ?? null; data.transportCompanyId = transportCompanyId ?? null; }
  if (action === "cancel") { data.cancelledAt = new Date(); data.cancelReason = remarks ?? null; }
  await prisma.dispatchExecution.update({ where: { id: exec.id }, data });
  await writeAudit(prisma, user, { action: `dispatch_execution.${action.replace("-", "_")}`, entity: "DispatchExecution", entityId: exec.id, summary: `Dispatch execution ${exec.docNo} ${exec.status} → ${to}`, meta: { remarks, vehicleId, driverId, transportCompanyId }, businessId: exec.businessId ?? null, branchId: exec.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: `Dispatch execution ${to === "Vehicle Assigned" ? "vehicle assigned" : to.toLowerCase()}.`, status: to });
}
