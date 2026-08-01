import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { gateEntryActionInput } from "@/lib/contracts/transport";

const PERM = "transport.gate-entry";

// Allowed transitions per current status (mirrors purchase/order/[id]/status).
// "exit" is intentionally NOT reachable through this generic status endpoint —
// Gate Exit needs its own dedicated form (seal/exitTime/securityOfficer) and is
// created via POST /api/transport/gate-exit, which also flips the status itself.
const NEXT: Record<string, Record<string, string>> = {
  "move-inside": { Waiting: "Inside Factory" },
  "start-loading": { "Inside Factory": "Loading" },
  complete: { Loading: "Completed" },
};

// POST /api/transport/gate-entry/[id]/status — { action: move-inside|start-loading|complete }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleGateEntry" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = gateEntryActionInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid action." }, { status: 422 });
  const { action, remarks } = parsed.data;

  if (action === "exit") {
    return NextResponse.json({ ok: false, message: "Use the Gate Exit form to complete this vehicle's exit." }, { status: 422 });
  }

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, select: { id: true, gateEntryNo: true, status: true, businessId: true, branchId: true } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });

  const to = NEXT[action]?.[entry.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${action.replace("-", " ")} a gate entry that is ${entry.status}.` }, { status: 422 });

  await prisma.vehicleGateEntry.update({ where: { id: entry.id }, data: { status: to, updatedBy: user.id } });
  await writeAudit(prisma, user, { action: `vehicle_gate_entry.${action}`, entity: "VehicleGateEntry", entityId: entry.id, summary: `Gate entry ${entry.gateEntryNo} ${entry.status} → ${to}`, meta: { remarks }, businessId: entry.businessId ?? null, branchId: entry.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: `Gate entry moved to ${to}.`, status: to });
}
