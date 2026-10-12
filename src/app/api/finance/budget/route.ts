import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { listPlans } from "@/lib/finance/budgetApi";
import { BudgetSaveSchema, sumMonths, deriveMonthsFromAnnual, type Months, type MonthKey } from "@/lib/contracts/budget";

const PERM = "finance.budget";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

// GET /api/finance/budget — list of budget plans (with live utilisation).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const plans = await listPlans(user);
  return NextResponse.json({ ok: true, plans });
}

// POST /api/finance/budget — create/update a budget plan (header + all head lines).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "BudgetHeader" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = BudgetSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const businessId = scope.businessId;
  const branchId = body.scope === "branch"
    ? (allowed.branches.some((b) => b.id === Number(body.branchId) && b.businessId === businessId) ? Number(body.branchId) : null)
    : null;
  if (body.scope === "branch" && branchId == null) return NextResponse.json({ ok: false, message: "Select a valid branch for a branch-scope budget." }, { status: 422 });

  const heads = await prisma.expenseHead.findMany({ where: { tenantId: user.tenantId, parentId: { not: null } }, select: { id: true, name: true, parentId: true, accountId: true } });
  const headMap = new Map(heads.map((h) => [h.id, h]));
  const cats = await prisma.expenseHead.findMany({ where: { tenantId: user.tenantId, parentId: null }, select: { id: true, name: true } });
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const accts = await prisma.ledgerAccount.findMany({ where: { tenantId: user.tenantId }, select: { id: true, code: true } });
  const acctCode = new Map(accts.map((a) => [a.id, a.code]));

  const result = await prisma.$transaction(async (tx) => {
    let header = body.id
      ? await tx.budgetHeader.findFirst({ where: { id: body.id, tenantId: user.tenantId } })
      : await tx.budgetHeader.findFirst({ where: { tenantId: user.tenantId, fy: body.fy, businessId: businessId ?? null, branchId: branchId ?? null } });
    if (header && header.status === "Closed") throw new Error("This budget is Closed and cannot be edited.");

    if (!header) {
      header = await tx.budgetHeader.create({ data: { tenantId: user.tenantId, businessId, branchId, fy: body.fy, scope: body.scope, period: body.period, status: "Draft", remarks: body.remarks ?? null, createdBy: user.id } });
    } else {
      header = await tx.budgetHeader.update({ where: { id: header.id }, data: { scope: body.scope, period: body.period, branchId, remarks: body.remarks ?? null } });
    }

    for (const l of body.lines) {
      const h = headMap.get(l.headId);
      if (!h) continue;
      // Normalise so annual === Σ months always (Annual = Half-Yearly = Quarterly = Monthly).
      let months = { ...l.months } as Months;
      let mSum = r2(sumMonths(months));
      let annual = r2(l.annual);
      if (mSum > 0) annual = mSum;
      else if (annual > 0) { months = deriveMonthsFromAnnual(annual); mSum = annual; }
      const acctId = h.accountId ?? null;
      const monthData: Record<MonthKey, number> = months;
      await tx.budgetLine.upsert({
        where: { headerId_headId: { headerId: header.id, headId: l.headId } },
        create: {
          tenantId: user.tenantId, headerId: header.id, headId: l.headId, headName: h.name,
          categoryName: h.parentId != null ? catName.get(h.parentId) ?? null : null,
          accountId: acctId, accountCode: acctId ? acctCode.get(acctId) ?? null : null,
          budgetType: l.budgetType, budgetRequired: l.budgetRequired, trackBudget: l.trackBudget,
          allowExceed: l.allowExceed, approvalRequired: l.approvalRequired, budgetControl: l.budgetControl,
          annual, ...monthData, businessId, branchId,
        },
        update: {
          budgetType: l.budgetType, budgetRequired: l.budgetRequired, trackBudget: l.trackBudget,
          allowExceed: l.allowExceed, approvalRequired: l.approvalRequired, budgetControl: l.budgetControl,
          annual, ...monthData, accountId: acctId, accountCode: acctId ? acctCode.get(acctId) ?? null : null,
          headName: h.name, categoryName: h.parentId != null ? catName.get(h.parentId) ?? null : null, businessId, branchId,
        },
      });
    }
    const keep = body.lines.map((l) => l.headId);
    await tx.budgetLine.deleteMany({ where: { headerId: header.id, headId: { notIn: keep.length ? keep : [-1] } } });
    return header;
  });

  await writeAudit(prisma, user, {
    action: "budget.save", entity: "BudgetHeader", entityId: result.id,
    summary: `Budget plan ${result.fy} (${result.scope} · ${result.period}) saved`,
    meta: { fy: result.fy, scope: result.scope, period: result.period, branchId, lineCount: body.lines.length },
    businessId: businessId ?? null, branchId: branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, id: result.id, message: "Budget plan saved." });
}
