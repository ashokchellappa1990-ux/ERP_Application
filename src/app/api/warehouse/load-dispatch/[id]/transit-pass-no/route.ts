import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const PERM = "warehouse.transfer";
const body = z.object({ transitPassRefNo: z.string().trim().max(60).optional().nullable() });

// PATCH /api/warehouse/load-dispatch/[id]/transit-pass-no — lets the Transit
// Pass Number be entered/updated even after the main dispatch record is no
// longer editable (Dispatched / Delivery Challan Generated / Sales Invoice
// Posted) — the pass is often issued only after the vehicle actually leaves,
// so the number isn't always known while the record is still in Draft/Ready/
// Loading. The main PUT route stays locked to those earlier statuses for
// everything else; this route only ever touches transitPassRefNo.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "LoadDispatch", entityId: id });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const doc = await prisma.loadDispatch.findFirst({ where: { ...sw, id, deletedAt: null }, select: { id: true, dispatchNo: true, status: true, businessId: true, branchId: true, transitPassRefNo: true } });
  if (!doc) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });
  if (doc.status === "Cancelled") return NextResponse.json({ ok: false, message: "This dispatch is cancelled." }, { status: 422 });

  const transitPassRefNo = parsed.data.transitPassRefNo?.trim() || null;
  await prisma.loadDispatch.update({ where: { id }, data: { transitPassRefNo, updatedBy: user.id } });
  await writeAudit(prisma, user, {
    action: "load_dispatch.transit_pass_no.update", entity: "LoadDispatch", entityId: id,
    summary: `Transit Pass Number ${transitPassRefNo ? `set to ${transitPassRefNo}` : "cleared"} for ${doc.dispatchNo}`,
    meta: { from: doc.transitPassRefNo, to: transitPassRefNo }, businessId: doc.businessId ?? null, branchId: doc.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Transit Pass Number updated.", transitPassRefNo });
}
