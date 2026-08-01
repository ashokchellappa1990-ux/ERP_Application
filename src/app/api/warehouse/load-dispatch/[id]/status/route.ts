import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { completeLoadDispatch } from "@/lib/transport/loadDispatch";
import { loadDispatchActionInput } from "@/lib/contracts/loadDispatch";

const PERM = "warehouse.transfer";

// Simple status transitions; "complete" delegates to completeLoadDispatch()
// (the only place that calls postDispatch for Stock Transfer).
const NEXT: Record<string, Record<string, string>> = {
  "start-loading": { Draft: "Loading", Ready: "Loading" },
  cancel: { Draft: "Cancelled", Ready: "Cancelled", Loading: "Cancelled" },
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "LoadDispatch", entityId: id });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = loadDispatchActionInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid action." }, { status: 422 });
  const { action, remarks } = parsed.data;

  const scope = await getActiveScope(user);
  const sw = scopeWhere(scope, { branch: true });
  const doc = await prisma.loadDispatch.findFirst({ where: { ...sw, id, deletedAt: null }, select: { id: true, dispatchNo: true, status: true, businessId: true, branchId: true } });
  if (!doc) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });

  if (action === "complete") {
    try {
      await completeLoadDispatch(scope, { id: user.id, tenantId: user.tenantId, fullName: user.fullName ?? null }, id);
      return NextResponse.json({ ok: true, message: "Load & Dispatch completed.", status: "Dispatched" });
    } catch (err) {
      return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Could not complete the dispatch." }, { status: 422 });
    }
  }

  const to = NEXT[action]?.[doc.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${action.replace("-", " ")} a ${doc.status} dispatch.` }, { status: 422 });

  const data: Record<string, unknown> = { status: to };
  if (action === "start-loading") { data.startedBy = user.id; data.startedAt = new Date(); }
  if (action === "cancel") { data.cancelReason = remarks ?? null; }
  await prisma.loadDispatch.update({ where: { id: doc.id }, data });
  await writeAudit(prisma, user, { action: `load_dispatch.${action.replace("-", "_")}`, entity: "LoadDispatch", entityId: doc.id, summary: `Load & Dispatch ${doc.dispatchNo} ${doc.status} → ${to}`, meta: { remarks }, businessId: doc.businessId ?? null, branchId: doc.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: `Dispatch ${to.toLowerCase()}.`, status: to });
}
