import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { retreadReceiveInput } from "@/lib/contracts/tyre";
import { logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
type Action = "start" | "receive" | "reject" | "cancel";
const NEXT: Record<Action, Record<string, string>> = {
  start: { Sent: "InProgress" },
  receive: { Sent: "Received", InProgress: "Received" },
  reject: { Sent: "Rejected", InProgress: "Rejected" },
  cancel: { Sent: "Cancelled", InProgress: "Cancelled" },
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const retread = await prisma.tyreRetreading.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!retread) return NextResponse.json({ ok: false, message: "Retreading record not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreRetreading", entityId: id, businessId: retread.businessId, branchId: retread.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = retreadReceiveInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const to = NEXT[b.action]?.[retread.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${b.action} a retreading record that is ${retread.status}.` }, { status: 422 });

  const tyre = await prisma.tyreMaster.findFirst({ where: { id: retread.tyreId, tenantId: user.tenantId } });

  await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = { status: to, updatedBy: user.id };
    if (b.action === "receive") { data.receivedDate = new Date(); data.newTreadDepthMm = b.newTreadDepthMm ?? null; }
    await tx.tyreRetreading.update({ where: { id }, data });
    if (tyre && (b.action === "receive" || b.action === "reject" || b.action === "cancel")) {
      const nextTyreData: Record<string, unknown> = { status: "Available", updatedBy: user.id };
      if (b.action === "receive") {
        nextTyreData.retreadCount = { increment: 1 };
        if (b.newTreadDepthMm != null) nextTyreData.originalTreadDepthMm = b.newTreadDepthMm;
      }
      await tx.tyreMaster.update({ where: { id: tyre.id }, data: nextTyreData });
    }
  });

  if (b.action === "receive" && tyre) await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: retread.businessId, branchId: retread.branchId, tyreId: tyre.id, eventType: "RetreadReceived", cost: retread.cost != null ? Number(retread.cost) : null, refEntity: "TyreRetreading", refId: id, actorUserId: user.id, actorName: user.fullName ?? null });
  await writeAudit(prisma, user, { action: `tyre.retread.${b.action}`, entity: "TyreRetreading", entityId: id, summary: `Retreading ${retread.retreadNo} ${retread.status} → ${to}`, businessId: retread.businessId, branchId: retread.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: to, message: "Retreading status updated." });
}
