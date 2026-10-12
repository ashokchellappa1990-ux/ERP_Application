import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { buildEditorData } from "@/lib/finance/budgetApi";
import { BudgetStatusSchema, MONTHS, sumMonths, emptyMonths } from "@/lib/contracts/budget";

const PERM = "finance.budget";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/finance/budget/:id — editor data for an existing plan (view/edit).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const data = await buildEditorData(user, { headerId: Number(params.id) });
  if (!data) return NextResponse.json({ ok: false, message: "Budget plan not found." }, { status: 404 });
  return NextResponse.json({ ok: true, ...data });
}

// PATCH /api/finance/budget/:id — status workflow (Draft → Approved → Active → Closed).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "BudgetHeader" });
  if (denied) return denied;

  const id = Number(params.id);
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = BudgetStatusSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 422 });
  const status = parsed.data.status;

  const header = await prisma.budgetHeader.findFirst({ where: { id, tenantId: user.tenantId }, include: { lines: true } });
  if (!header) return NextResponse.json({ ok: false, message: "Budget plan not found." }, { status: 404 });

  // Approval/activation requires every line to balance: Annual = Σ Monthly (= Σ Quarterly).
  if (status === "Approved" || status === "Active") {
    for (const l of header.lines) {
      const m = emptyMonths();
      for (const k of MONTHS) m[k.key] = num((l as unknown as Record<string, unknown>)[k.key]);
      if (Math.abs(sumMonths(m) - num(l.annual)) > 0.01) {
        return NextResponse.json({ ok: false, message: `"${l.headName}": Annual (${num(l.annual).toFixed(2)}) must equal the sum of monthly budgets (${sumMonths(m).toFixed(2)}).` }, { status: 422 });
      }
    }
  }

  const approving = status === "Approved" || status === "Active";
  const updated = await prisma.budgetHeader.update({
    where: { id },
    data: { status, ...(approving ? { approvedBy: user.id, approvedAt: new Date() } : {}) },
  });

  await writeAudit(prisma, user, {
    action: "budget.status", entity: "BudgetHeader", entityId: id,
    summary: `Budget plan ${header.fy} (${header.scope}) → ${status}`,
    meta: { fy: header.fy, scope: header.scope, from: header.status, to: status },
    businessId: header.businessId ?? null, branchId: header.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, status: updated.status, message: `Budget ${status}.` });
}

// DELETE /api/finance/budget/:id — remove a Draft plan (lines cascade).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "BudgetHeader" });
  if (denied) return denied;

  const id = Number(params.id);
  const header = await prisma.budgetHeader.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!header) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (header.status === "Active") return NextResponse.json({ ok: false, message: "Close the budget before deleting an active plan." }, { status: 422 });
  await prisma.budgetHeader.delete({ where: { id } });
  await writeAudit(prisma, user, {
    action: "budget.delete", entity: "BudgetHeader", entityId: id, summary: `Budget plan ${header.fy} (${header.scope}) deleted`,
    meta: { fy: header.fy, scope: header.scope }, businessId: header.businessId ?? null, branchId: header.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Budget plan deleted." });
}
