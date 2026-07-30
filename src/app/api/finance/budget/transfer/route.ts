import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { headSnapshot } from "@/lib/finance/budgetService";
import { resolveUsers, nameOf } from "@/lib/finance/budgetTxn";
import { TransferCreateSchema, type TransferRow } from "@/lib/contracts/budgetTxn";

const PERM = "finance.budget";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

// GET /api/finance/budget/transfer — list of budget transfers.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branchName = (id: number | null) => (id == null ? null : allowed.branches.find((b) => b.id === id)?.name ?? null);
  const rows = await prisma.budgetTransfer.findMany({
    where: { tenantId: user.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) },
    include: { header: { select: { scope: true } } }, orderBy: { id: "desc" }, take: 300,
  });
  const users = await resolveUsers(prisma, rows.flatMap((r) => [r.requestedBy, r.approvedBy]));
  const list: TransferRow[] = rows.map((r) => ({
    id: r.id, transferNo: r.transferNo, transferDate: r.transferDate, fy: r.fy, scope: r.header.scope as "company" | "branch",
    branchName: branchName(r.branchId), fromHeadName: r.fromHeadName ?? "", toHeadName: r.toHeadName ?? "", amount: num(r.amount),
    status: r.status as TransferRow["status"], requestedByName: nameOf(users, r.requestedBy), approvedByName: nameOf(users, r.approvedBy), remarks: r.remarks ?? null,
  }));
  return NextResponse.json({ ok: true, rows: list });
}

// POST /api/finance/budget/transfer — request a budget transfer (Pending).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "BudgetTransfer" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = TransferCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  if (b.fromHeadId === b.toHeadId) return NextResponse.json({ ok: false, message: "Source and destination heads must be different." }, { status: 422 });

  const header = await prisma.budgetHeader.findFirst({ where: { id: b.headerId, tenantId: user.tenantId } });
  if (!header) return NextResponse.json({ ok: false, message: "Budget plan not found." }, { status: 404 });
  if (header.status === "Closed") return NextResponse.json({ ok: false, message: "Cannot transfer within a Closed budget." }, { status: 422 });
  const fromLine = await prisma.budgetLine.findFirst({ where: { headerId: header.id, headId: b.fromHeadId } });
  const toLine = await prisma.budgetLine.findFirst({ where: { headerId: header.id, headId: b.toHeadId } });
  if (!fromLine || !toLine) return NextResponse.json({ ok: false, message: "Both heads must be in this budget plan." }, { status: 422 });

  const [fromSnap, toSnap] = await Promise.all([headSnapshot(prisma, header.id, b.fromHeadId), headSnapshot(prisma, header.id, b.toHeadId)]);
  if (!fromSnap || !toSnap) return NextResponse.json({ ok: false, message: "Could not read head budgets." }, { status: 422 });
  const amount = r2(b.amount);
  if (amount > fromSnap.available) return NextResponse.json({ ok: false, message: `Transfer amount exceeds available budget of the source (${fromSnap.available.toFixed(2)}).` }, { status: 422 });

  const created = await prisma.$transaction(async (tx) => {
    const t = await tx.budgetTransfer.create({
      data: {
        tenantId: user.tenantId, headerId: header.id, transferNo: "TMP", transferDate: b.transferDate.slice(0, 10),
        businessId: header.businessId, branchId: header.branchId, fy: header.fy,
        fromHeadId: b.fromHeadId, fromHeadName: fromLine.headName, toHeadId: b.toHeadId, toHeadName: toLine.headName, amount,
        fromPrevBudget: r2(fromSnap.current), fromNewBudget: r2(fromSnap.current - amount), toPrevBudget: r2(toSnap.current), toNewBudget: r2(toSnap.current + amount),
        reason: b.reason ?? null, effectiveDate: b.effectiveDate ?? null, remarks: b.remarks ?? null,
        attachmentsJson: b.attachments?.length ? JSON.stringify(b.attachments) : null, status: "Pending", requestedBy: user.id,
      },
    });
    const transferNo = `TRF-${String(t.id).padStart(6, "0")}`;
    await tx.budgetTransfer.update({ where: { id: t.id }, data: { transferNo } });
    return { id: t.id, transferNo };
  });

  await writeAudit(prisma, user, {
    action: "budget_transfer.create", entity: "BudgetTransfer", entityId: created.id,
    summary: `Transfer ${created.transferNo} — ${amount.toFixed(2)} from ${fromLine.headName} to ${toLine.headName}`,
    meta: { transferNo: created.transferNo, fromHeadId: b.fromHeadId, toHeadId: b.toHeadId, amount },
    businessId: header.businessId ?? null, branchId: header.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, id: created.id, transferNo: created.transferNo, message: "Budget transfer submitted for approval." }, { status: 201 });
}
