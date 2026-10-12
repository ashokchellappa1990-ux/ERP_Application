import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { headSnapshot } from "@/lib/finance/budgetService";
import { PERIOD_LABEL, type BudgetPeriod } from "@/lib/contracts/budget";

const PERM = "finance.budget";

// GET /api/finance/budget/txn-context[?headerId=] — the plans that can be revised/
// transferred (not Closed) and, for a selected plan, its heads + budget snapshots.
// Used by the Budget Revision & Budget Transfer Add screens.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const businessId = scope.businessId;
  const branches = allowed.branches.filter((b) => b.businessId === businessId);
  const branchName = (id: number | null) => (id == null ? null : branches.find((b) => b.id === id)?.name ?? null);

  const headers = await prisma.budgetHeader.findMany({
    where: { tenantId: user.tenantId, status: { not: "Closed" }, ...(businessId != null ? { businessId } : {}) },
    include: { lines: { select: { headId: true, headName: true } } }, orderBy: [{ fy: "desc" }, { id: "desc" }],
  });
  const plans = headers.map((h) => ({
    id: h.id, fy: h.fy, scope: h.scope as "company" | "branch", branchName: branchName(h.branchId),
    period: PERIOD_LABEL[(h.period as BudgetPeriod) ?? "quarterly"], status: h.status,
    label: `${h.fy} · ${h.scope === "branch" ? branchName(h.branchId) ?? "Branch" : "Company"}`,
    heads: h.lines.map((l) => ({ headId: l.headId, headName: l.headName ?? "" })),
  }));

  let heads: { headId: number; headName: string; snapshot: Awaited<ReturnType<typeof headSnapshot>> }[] | undefined;
  const headerId = Number(url.searchParams.get("headerId")) || 0;
  if (headerId) {
    const plan = headers.find((h) => h.id === headerId);
    if (plan) heads = await Promise.all(plan.lines.map(async (l) => ({ headId: l.headId, headName: l.headName ?? "", snapshot: await headSnapshot(prisma, headerId, l.headId) })));
  }

  return NextResponse.json({ ok: true, plans, heads });
}
