import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { warrantyStatusInput } from "@/lib/contracts/tyre";

const PERM = "transport.tyre";
type Action = "review" | "approve" | "reject" | "settle";
const NEXT: Record<Action, Record<string, string>> = {
  review: { Filed: "UnderReview" },
  approve: { Filed: "Approved", UnderReview: "Approved" },
  reject: { Filed: "Rejected", UnderReview: "Rejected" },
  settle: { Approved: "Settled" },
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const claim = await prisma.tyreWarrantyClaim.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!claim) return NextResponse.json({ ok: false, message: "Warranty claim not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreWarrantyClaim", entityId: id, businessId: claim.businessId, branchId: claim.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = warrantyStatusInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const to = NEXT[b.action]?.[claim.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${b.action} a claim that is ${claim.status}.` }, { status: 422 });

  const data: Record<string, unknown> = { status: to, updatedBy: user.id };
  if (b.action === "approve") data.approvedAmount = b.approvedAmount ?? claim.claimedAmount;
  if (b.action === "settle") data.creditNoteRef = b.creditNoteRef ?? claim.creditNoteRef;
  await prisma.tyreWarrantyClaim.update({ where: { id }, data });

  const tyre = await prisma.tyreMaster.findFirst({ where: { id: claim.tyreId, tenantId: user.tenantId } });
  if (tyre?.status === "Warranty Claim" && (b.action === "reject" || b.action === "settle")) {
    await prisma.tyreMaster.update({ where: { id: tyre.id }, data: { status: "Available", updatedBy: user.id } });
  }

  await writeAudit(prisma, user, { action: `tyre.warranty_claim.${b.action}`, entity: "TyreWarrantyClaim", entityId: id, summary: `Warranty claim ${claim.claimNo} ${claim.status} → ${to}`, businessId: claim.businessId, branchId: claim.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: to, message: "Warranty claim updated." });
}
