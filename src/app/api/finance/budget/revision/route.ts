import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { headSnapshot } from "@/lib/finance/budgetService";
import { resolveUsers, nameOf } from "@/lib/finance/budgetTxn";
import { RevisionCreateSchema, type RevisionRow } from "@/lib/contracts/budgetTxn";

const PERM = "finance.budget";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

// GET /api/finance/budget/revision — list of budget revisions.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branchName = (id: number | null) => (id == null ? null : allowed.branches.find((b) => b.id === id)?.name ?? null);
  const rows = await prisma.budgetRevision.findMany({
    where: { tenantId: user.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) },
    include: { header: { select: { scope: true } } }, orderBy: { id: "desc" }, take: 300,
  });
  const users = await resolveUsers(prisma, rows.flatMap((r) => [r.requestedBy, r.approvedBy]));
  const list: RevisionRow[] = rows.map((r) => ({
    id: r.id, revisionNo: r.revisionNo, revisionDate: r.revisionDate, fy: r.fy,
    scope: (r.header.scope as "company" | "branch"), branchName: branchName(r.branchId), headName: r.headName ?? "",
    revisionType: r.revisionType as "increase" | "decrease", originalBudget: num(r.originalBudget), previousBudget: num(r.previousBudget),
    amount: num(r.amount), revisedBudget: num(r.revisedBudget), status: r.status as RevisionRow["status"],
    requestedByName: nameOf(users, r.requestedBy), approvedByName: nameOf(users, r.approvedBy), remarks: r.remarks ?? null,
  }));
  return NextResponse.json({ ok: true, rows: list });
}

// POST /api/finance/budget/revision — request a budget revision (Pending).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "BudgetRevision" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = RevisionCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const header = await prisma.budgetHeader.findFirst({ where: { id: b.headerId, tenantId: user.tenantId } });
  if (!header) return NextResponse.json({ ok: false, message: "Budget plan not found." }, { status: 404 });
  if (header.status === "Closed") return NextResponse.json({ ok: false, message: "Cannot revise a Closed budget." }, { status: 422 });
  const line = await prisma.budgetLine.findFirst({ where: { headerId: header.id, headId: b.headId } });
  if (!line) return NextResponse.json({ ok: false, message: "Expense head is not in this budget plan." }, { status: 422 });

  const snap = await headSnapshot(prisma, header.id, b.headId);
  if (!snap) return NextResponse.json({ ok: false, message: "Could not read the head's budget." }, { status: 422 });
  const amount = r2(b.amount);
  const revised = r2(b.revisionType === "increase" ? snap.current + amount : snap.current - amount);
  if (b.revisionType === "decrease") {
    if (revised < snap.committed) return NextResponse.json({ ok: false, message: `Cannot reduce budget below Committed (${snap.committed.toFixed(2)}). Max reduction: ${(snap.current - snap.committed).toFixed(2)}.` }, { status: 422 });
    if (revised < snap.actual) return NextResponse.json({ ok: false, message: `Cannot reduce budget below Actual Expense (${snap.actual.toFixed(2)}).` }, { status: 422 });
    if (revised < 0) return NextResponse.json({ ok: false, message: "Revised budget cannot be negative." }, { status: 422 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const rev = await tx.budgetRevision.create({
      data: {
        tenantId: user.tenantId, headerId: header.id, revisionNo: "TMP", revisionDate: b.revisionDate.slice(0, 10),
        headId: b.headId, headName: line.headName, businessId: header.businessId, branchId: header.branchId, fy: header.fy,
        revisionType: b.revisionType, amount, originalBudget: r2(snap.original), previousBudget: r2(snap.current), revisedBudget: revised,
        committedSnapshot: r2(snap.committed), actualSnapshot: r2(snap.actual),
        reason: b.reason ?? null, effectiveDate: b.effectiveDate ?? null, remarks: b.remarks ?? null,
        attachmentsJson: b.attachments?.length ? JSON.stringify(b.attachments) : null, status: "Pending", requestedBy: user.id,
      },
    });
    const revisionNo = `REV-${String(rev.id).padStart(6, "0")}`;
    await tx.budgetRevision.update({ where: { id: rev.id }, data: { revisionNo } });
    return { id: rev.id, revisionNo };
  });

  await writeAudit(prisma, user, {
    action: "budget_revision.create", entity: "BudgetRevision", entityId: created.id,
    summary: `Revision ${created.revisionNo} — ${line.headName} ${b.revisionType} ${amount.toFixed(2)}`,
    meta: { revisionNo: created.revisionNo, headId: b.headId, type: b.revisionType, amount, previous: snap.current, revised },
    businessId: header.businessId ?? null, branchId: header.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, id: created.id, revisionNo: created.revisionNo, message: "Budget revision submitted for approval." }, { status: 201 });
}
