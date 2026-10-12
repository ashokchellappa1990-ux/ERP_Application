import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { headSnapshot } from "@/lib/finance/budgetService";
import { resolveUsers, nameOf, buildBudgetLog } from "@/lib/finance/budgetTxn";
import { ApproveSchema, type TransferDetail, type Attachment } from "@/lib/contracts/budgetTxn";

const PERM = "finance.budget";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/finance/budget/transfer/:id — full detail + budget timeline (both heads).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.budgetTransfer.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId }, include: { header: { select: { scope: true } } } });
  if (!r) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const allowed = await getAllowedScope(user);
  const users = await resolveUsers(prisma, [r.requestedBy, r.approvedBy]);
  const detail: TransferDetail = {
    id: r.id, transferNo: r.transferNo, transferDate: r.transferDate, fy: r.fy, scope: r.header.scope as "company" | "branch",
    branchName: r.branchId == null ? null : allowed.branches.find((b) => b.id === r.branchId)?.name ?? null,
    headerId: r.headerId, fromHeadId: r.fromHeadId, fromHeadName: r.fromHeadName ?? "", toHeadId: r.toHeadId, toHeadName: r.toHeadName ?? "", amount: num(r.amount),
    fromPrevBudget: num(r.fromPrevBudget), fromNewBudget: num(r.fromNewBudget), toPrevBudget: num(r.toPrevBudget), toNewBudget: num(r.toNewBudget),
    reason: r.reason ?? null, effectiveDate: r.effectiveDate ?? null, remarks: r.remarks ?? null,
    attachments: r.attachmentsJson ? (JSON.parse(r.attachmentsJson) as Attachment[]) : [],
    status: r.status as TransferDetail["status"], requestedByName: nameOf(users, r.requestedBy), approvedByName: nameOf(users, r.approvedBy),
    rejectReason: r.rejectReason ?? null, approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null, createdAt: r.createdAt.toISOString(),
  };
  const timeline = [...await buildBudgetLog(prisma, r.headerId, r.fromHeadId), ...await buildBudgetLog(prisma, r.headerId, r.toHeadId)].sort((a, b) => (a.date < b.date ? -1 : 1));
  return NextResponse.json({ ok: true, detail, timeline });
}

// PATCH /api/finance/budget/transfer/:id — approve / reject.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "BudgetTransfer" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ApproveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 422 });

  const r = await prisma.budgetTransfer.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (r.status !== "Pending") return NextResponse.json({ ok: false, message: `Transfer already ${r.status}.` }, { status: 422 });

  if (parsed.data.action === "reject") {
    await prisma.budgetTransfer.update({ where: { id: r.id }, data: { status: "Rejected", rejectedBy: user.id, rejectReason: parsed.data.rejectReason ?? null, approvedAt: new Date() } });
    await writeAudit(prisma, user, { action: "budget_transfer.reject", entity: "BudgetTransfer", entityId: r.id, summary: `Transfer ${r.transferNo} rejected`, meta: { transferNo: r.transferNo, reason: parsed.data.rejectReason ?? null }, businessId: r.businessId ?? null, branchId: r.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, status: "Rejected", message: "Transfer rejected." });
  }

  // Approve — re-check the source still has enough available budget.
  const snap = await headSnapshot(prisma, r.headerId, r.fromHeadId);
  if (snap && num(r.amount) > snap.available) return NextResponse.json({ ok: false, message: `Cannot approve: transfer amount ${num(r.amount).toFixed(2)} now exceeds the source's available budget (${snap.available.toFixed(2)}).` }, { status: 422 });

  await prisma.budgetTransfer.update({ where: { id: r.id }, data: { status: "Approved", approvedBy: user.id, approvedAt: new Date() } });
  await writeAudit(prisma, user, { action: "budget_transfer.approve", entity: "BudgetTransfer", entityId: r.id, summary: `Transfer ${r.transferNo} approved — ${num(r.amount).toFixed(2)} ${r.fromHeadName} → ${r.toHeadName}`, meta: { transferNo: r.transferNo, amount: num(r.amount) }, businessId: r.businessId ?? null, branchId: r.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: "Approved", message: "Transfer approved — effective budgets updated." });
}
