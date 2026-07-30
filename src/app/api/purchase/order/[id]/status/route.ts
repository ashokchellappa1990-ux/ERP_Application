import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { PoStatusSchema } from "@/lib/contracts/purchaseOrder";

const PERM = "purchase.order";

// Allowed transitions per current status.
const NEXT: Record<string, Record<string, string>> = {
  approve: { Draft: "Approved" },
  issue: { Draft: "Issued", Approved: "Issued" },
  cancel: { Draft: "Cancelled", Approved: "Cancelled", Issued: "Cancelled", "Partially Received": "Cancelled" },
  close: { Issued: "Closed", "Partially Received": "Closed", Received: "Closed" },
  reopen: { Cancelled: "Draft", Closed: "Issued" },
};

// POST /api/purchase/order/[id]/status — { action: approve|issue|cancel|close|reopen, note? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "PurchaseOrder" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = PoStatusSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid action." }, { status: 422 });
  const { action, note } = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const order = await prisma.purchaseOrder.findFirst({ where: { ...sw, id: Number(params.id) }, select: { id: true, poNo: true, status: true, businessId: true, branchId: true } });
  if (!order) return NextResponse.json({ ok: false, message: "Purchase order not found." }, { status: 404 });

  const to = NEXT[action]?.[order.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${action} a ${order.status} order.` }, { status: 422 });

  const data: Record<string, unknown> = { status: to };
  if (action === "approve") { data.approvedBy = user.id; data.approvedByName = user.fullName ?? null; data.approvedAt = new Date(); data.approvalNote = note ?? null; }
  if (action === "issue") data.issuedAt = new Date();
  if (action === "cancel") { data.cancelledAt = new Date(); data.cancelReason = note ?? null; }
  await prisma.purchaseOrder.update({ where: { id: order.id }, data });
  await writeAudit(prisma, user, { action: `purchase_order.${action}`, entity: "PurchaseOrder", entityId: order.id, summary: `Purchase order ${order.poNo} ${order.status} → ${to}`, meta: { note }, businessId: order.businessId ?? null, branchId: order.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: `Purchase order ${action === "issue" ? "issued" : action === "approve" ? "approved" : to.toLowerCase()}.`, status: to });
}
