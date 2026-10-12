import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { headSnapshot } from "@/lib/finance/budgetService";
import { resolveUsers, nameOf, buildBudgetLog } from "@/lib/finance/budgetTxn";
import { ApproveSchema, type RevisionDetail, type Attachment } from "@/lib/contracts/budgetTxn";

const PERM = "finance.budget";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/finance/budget/revision/:id — full detail + the head's budget timeline.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.budgetRevision.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId }, include: { header: { select: { scope: true } } } });
  if (!r) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const allowed = await getAllowedScope(user);
  const users = await resolveUsers(prisma, [r.requestedBy, r.approvedBy]);
  const detail: RevisionDetail = {
    id: r.id, revisionNo: r.revisionNo, revisionDate: r.revisionDate, fy: r.fy, scope: r.header.scope as "company" | "branch",
    branchName: r.branchId == null ? null : allowed.branches.find((b) => b.id === r.branchId)?.name ?? null,
    headerId: r.headerId, headId: r.headId, headName: r.headName ?? "", revisionType: r.revisionType as "increase" | "decrease",
    originalBudget: num(r.originalBudget), previousBudget: num(r.previousBudget), amount: num(r.amount), revisedBudget: num(r.revisedBudget),
    committedSnapshot: num(r.committedSnapshot), actualSnapshot: num(r.actualSnapshot),
    reason: r.reason ?? null, effectiveDate: r.effectiveDate ?? null, remarks: r.remarks ?? null,
    attachments: r.attachmentsJson ? (JSON.parse(r.attachmentsJson) as Attachment[]) : [],
    status: r.status as RevisionDetail["status"], requestedByName: nameOf(users, r.requestedBy), approvedByName: nameOf(users, r.approvedBy),
    rejectReason: r.rejectReason ?? null, approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null, createdAt: r.createdAt.toISOString(),
  };
  const timeline = await buildBudgetLog(prisma, r.headerId, r.headId);
  return NextResponse.json({ ok: true, detail, timeline });
}

// PATCH /api/finance/budget/revision/:id — approve / reject.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "BudgetRevision" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ApproveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 422 });

  const r = await prisma.budgetRevision.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (r.status !== "Pending") return NextResponse.json({ ok: false, message: `Revision already ${r.status}.` }, { status: 422 });

  if (parsed.data.action === "reject") {
    await prisma.budgetRevision.update({ where: { id: r.id }, data: { status: "Rejected", rejectedBy: user.id, rejectReason: parsed.data.rejectReason ?? null, approvedAt: new Date() } });
    await writeAudit(prisma, user, { action: "budget_revision.reject", entity: "BudgetRevision", entityId: r.id, summary: `Revision ${r.revisionNo} rejected`, meta: { revisionNo: r.revisionNo, reason: parsed.data.rejectReason ?? null }, businessId: r.businessId ?? null, branchId: r.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, status: "Rejected", message: "Revision rejected." });
  }

  // Approve — re-validate a decrease against the CURRENT committed/actual (may have moved).
  if (r.revisionType === "decrease") {
    const snap = await headSnapshot(prisma, r.headerId, r.headId);
    if (snap) {
      const floor = Math.max(snap.committed, snap.actual);
      if (num(r.revisedBudget) < floor) return NextResponse.json({ ok: false, message: `Cannot approve: revised budget ${num(r.revisedBudget).toFixed(2)} is now below committed/actual (${floor.toFixed(2)}).` }, { status: 422 });
    }
  }
  await prisma.budgetRevision.update({ where: { id: r.id }, data: { status: "Approved", approvedBy: user.id, approvedAt: new Date() } });
  await writeAudit(prisma, user, { action: "budget_revision.approve", entity: "BudgetRevision", entityId: r.id, summary: `Revision ${r.revisionNo} approved — ${r.headName} ${r.revisionType} ${num(r.amount).toFixed(2)}`, meta: { revisionNo: r.revisionNo, previous: num(r.previousBudget), revised: num(r.revisedBudget) }, businessId: r.businessId ?? null, branchId: r.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: "Approved", message: "Revision approved — effective budget updated." });
}
