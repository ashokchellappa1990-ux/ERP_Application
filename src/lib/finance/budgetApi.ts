import { prisma } from "@/lib/db/prisma";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { computeUsage, fyFromDate, fyStartYear } from "@/lib/finance/budgetService";
import {
  MONTHS, emptyMonths, type BudgetHeaderDto, type BudgetLineDto, type BudgetPlanSummary,
  type BudgetPeriod, type LastYearRef, type Months,
} from "@/lib/contracts/budget";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

interface SessionUser { id: number; tenantId: number }

function monthsOf(row: Record<string, unknown>): Months {
  const m = emptyMonths();
  for (const k of MONTHS) m[k.key] = num(row[k.key]);
  return m;
}
function prevFy(fy: string): string { const sy = fyStartYear(fy) - 1; return `FY ${String(sy).slice(-2)}-${String(sy + 1).slice(-2)}`; }
export function fyOptions(): string[] {
  const sy = fyStartYear(fyFromDate(new Date().toISOString().slice(0, 10)));
  return [-1, 0, 1].map((d) => `FY ${String(sy + d).slice(-2)}-${String(sy + d + 1).slice(-2)}`);
}

async function scopeCtx(user: SessionUser) {
  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const businessId = scope.businessId;
  const branches = allowed.branches.filter((b) => b.businessId === businessId).map((b) => ({ id: b.id, name: b.name }));
  return { businessId, branches, branchName: (id: number | null) => (id == null ? null : branches.find((b) => b.id === id)?.name ?? null) };
}

/** All budget plans for the active business, with live utilisation — the list page. */
export async function listPlans(user: SessionUser): Promise<BudgetPlanSummary[]> {
  const { businessId, branchName } = await scopeCtx(user);
  const headers = await prisma.budgetHeader.findMany({
    where: { tenantId: user.tenantId, ...(businessId != null ? { businessId } : {}) },
    include: { lines: true }, orderBy: [{ fy: "desc" }, { id: "desc" }],
  });
  const out: BudgetPlanSummary[] = [];
  for (const h of headers) {
    const usage = await computeUsage(prisma, { tenantId: user.tenantId, businessId: h.businessId, branchId: h.branchId }, h.fy);
    const totalBudget = r2(h.lines.reduce((s, l) => s + num(l.annual), 0));
    const actual = r2(h.lines.reduce((s, l) => s + (usage.actual[l.headId] ?? 0), 0));
    const committed = r2(h.lines.reduce((s, l) => s + (usage.committed[l.headId] ?? 0), 0));
    out.push({
      id: h.id, fy: h.fy, scope: h.scope as "company" | "branch", period: (h.period as BudgetPeriod) ?? "quarterly",
      branchId: h.branchId, branchName: branchName(h.branchId), status: h.status as BudgetPlanSummary["status"],
      lineCount: h.lines.length, totalBudget, actual, committed, available: r2(totalBudget - actual - committed),
      utilization: totalBudget > 0 ? Math.round((actual / totalBudget) * 100) : 0, updatedAt: h.updatedAt.toISOString(),
    });
  }
  return out;
}

export interface EditorData { current: BudgetHeaderDto; lastYear: LastYearRef; branches: { id: number; name: string }[]; fyOptions: string[] }

/**
 * Editor payload for the add/view/edit page. Either loads an existing plan
 * (`headerId`) or resolves a new one for (fy, scope, branchId) — auto-loading the
 * tracked expense heads and merging live monitoring + the previous-year reference.
 */
export async function buildEditorData(
  user: SessionUser,
  opts: { headerId?: number; fy?: string; scope?: "company" | "branch"; branchId?: number | null },
): Promise<EditorData | null> {
  const { businessId, branches, branchName } = await scopeCtx(user);

  let header = opts.headerId
    ? await prisma.budgetHeader.findFirst({ where: { id: opts.headerId, tenantId: user.tenantId }, include: { lines: true } })
    : null;
  if (opts.headerId && !header) return null;

  const fy = header?.fy ?? (opts.fy || fyFromDate(new Date().toISOString().slice(0, 10))).trim();
  const wantScope = (header?.scope as "company" | "branch") ?? (opts.scope === "branch" ? "branch" : "company");
  const branchId = header ? header.branchId
    : wantScope === "branch" ? (branches.some((b) => b.id === Number(opts.branchId)) ? Number(opts.branchId) : (branches[0]?.id ?? null)) : null;
  const period = (header?.period as BudgetPeriod) ?? "quarterly";

  if (!header && !opts.headerId) {
    header = await prisma.budgetHeader.findFirst({ where: { tenantId: user.tenantId, fy, businessId: businessId ?? null, branchId: branchId ?? null }, include: { lines: true } });
  }

  // All active expense heads (leaf heads under a category) + category + mapped
  // account. Every head is listed so the plan is never an empty dead-end; the
  // per-line "Track" flag (defaulted from the head's Expense-Config toggle)
  // decides which heads are actually enforced by checkBudget at posting time.
  const heads = await prisma.expenseHead.findMany({
    where: { tenantId: user.tenantId, active: true, parentId: { not: null }, ...(businessId != null ? { businessId } : {}) },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  const cats = await prisma.expenseHead.findMany({ where: { tenantId: user.tenantId, parentId: null }, select: { id: true, name: true } });
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const accts = await prisma.ledgerAccount.findMany({ where: { tenantId: user.tenantId }, select: { id: true, code: true } });
  const acctCode = new Map(accts.map((a) => [a.id, a.code]));

  const usage = await computeUsage(prisma, { tenantId: user.tenantId, businessId, branchId }, fy);
  const existingLine = new Map((header?.lines ?? []).map((l) => [l.headId, l]));
  const lines: BudgetLineDto[] = heads.map((h) => {
    const el = existingLine.get(h.id);
    const months = el ? monthsOf(el as unknown as Record<string, unknown>) : emptyMonths();
    const annual = el ? num(el.annual) : 0;
    const actual = r2(usage.actual[h.id] ?? 0);
    const committed = r2(usage.committed[h.id] ?? 0);
    return {
      headId: h.id, headName: h.name, categoryName: h.parentId != null ? catName.get(h.parentId) ?? null : null,
      accountId: h.accountId ?? null, accountCode: h.accountId ? acctCode.get(h.accountId) ?? null : null,
      budgetType: (el?.budgetType as "annual" | "monthly") ?? "annual",
      budgetRequired: el ? el.budgetRequired : true, trackBudget: el ? el.trackBudget : h.trackBudget,
      allowExceed: el ? el.allowExceed : false, approvalRequired: el ? el.approvalRequired : false,
      budgetControl: (el?.budgetControl as BudgetLineDto["budgetControl"]) ?? "warning",
      annual, months, actual, committed, available: r2(annual - actual - committed),
      utilization: annual > 0 ? Math.round((actual / annual) * 100) : 0,
    };
  });

  // Previous-year reference: last year's plan (budget) + last year's actual spend.
  const lastFy = prevFy(fy);
  const [lastHeader, lastUsage] = await Promise.all([
    prisma.budgetHeader.findFirst({ where: { tenantId: user.tenantId, fy: lastFy, businessId: businessId ?? null, branchId: branchId ?? null }, include: { lines: true } }),
    computeUsage(prisma, { tenantId: user.tenantId, businessId, branchId }, lastFy),
  ]);
  const lastLineMap = new Map((lastHeader?.lines ?? []).map((l) => [l.headId, l]));
  const lastLines = heads.map((h) => ({ headId: h.id, headName: h.name, annual: r2(num(lastLineMap.get(h.id)?.annual ?? 0)), actual: r2(lastUsage.actual[h.id] ?? 0) }));
  const lastYear: LastYearRef = {
    fy: lastFy, exists: !!lastHeader,
    totalBudget: r2(lastLines.reduce((s, l) => s + l.annual, 0)), totalActual: r2(lastLines.reduce((s, l) => s + l.actual, 0)), lines: lastLines,
  };

  const current: BudgetHeaderDto = {
    id: header?.id ?? 0, businessId, branchId, branchName: branchName(branchId), fy, scope: wantScope, period,
    status: (header?.status as BudgetHeaderDto["status"]) ?? "Draft", remarks: header?.remarks ?? null,
    createdBy: header?.createdBy ?? null, approvedBy: header?.approvedBy ?? null,
    approvedAt: header?.approvedAt ? header.approvedAt.toISOString() : null,
    updatedAt: header?.updatedAt ? header.updatedAt.toISOString() : "", lines,
  };
  return { current, lastYear, branches, fyOptions: fyOptions() };
}
