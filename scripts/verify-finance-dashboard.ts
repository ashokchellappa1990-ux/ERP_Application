/**
 * Smoke test the Finance Dashboard builders against live data (tenant 4). Read-only.
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-finance-dashboard.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { executiveDashboard, operationsDashboard, controllerDashboard, dashboardFilters } from "../src/lib/finance/dashboard/service";

const period = new Date().toISOString().slice(0, 7);

async function main() {
  // Realistic scope: all branches for tenant 4 (mirrors getActiveScope "All branches").
  const brs = await prisma.branch.findMany({ where: { tenantId: 4 }, select: { id: true, name: true, businessId: true } });
  const scope = { tenantId: 4, businessId: null, branchId: brs[0]?.id ?? null, branchIds: null, readBranchIds: brs.map((b) => b.id) };
  const branches = brs.map((b) => ({ id: b.id, name: b.name }));
  console.log("Period:", period, "| branches:", brs.length);

  const f = await dashboardFilters(scope);
  console.log("Filters: costCentres", f.costCentres.length, "profitCentres", f.profitCentres.length);

  const exec = await executiveDashboard(scope, { period }, branches);
  console.log("\n== EXECUTIVE ==");
  console.log("summary:", exec.summary);
  console.log("cashFlow:", exec.cashFlow);
  console.log("profitability:", exec.profitability);
  console.log("budget:", { ...exec.budget, topOverBudget: exec.budget.topOverBudget.length });
  console.log("trend points:", exec.revenueExpenseTrend.length, "health:", exec.health.score, exec.health.label);
  console.log("tops.customers:", exec.tops.customers.slice(0, 3));
  console.log("tops.expenseHeads:", exec.tops.expenseHeads.slice(0, 3));
  console.log("insights:", exec.insights.length);

  const ops = await operationsDashboard(scope, { period });
  console.log("\n== OPERATIONS ==");
  console.log("today:", ops.today);
  console.log("ar:", { outstanding: ops.ar.outstanding, overdue: ops.ar.overdue, aging: ops.ar.aging });
  console.log("ap:", { outstanding: ops.ap.outstanding, aging: ops.ap.aging });
  console.log("cashBank:", ops.cashBank);
  console.log("recurring:", ops.recurring);
  console.log("approvals total:", ops.approvals.total, ops.approvals.items.map((i) => `${i.label}:${i.count}`).join(", "));

  const ctrl = await controllerDashboard(scope, { period });
  console.log("\n== CONTROLLER ==");
  console.log("statutory.gst:", ctrl.statutory.gst);
  console.log("statutory.tds:", ctrl.statutory.tds);
  console.log("govPayments:", { gstPaid: ctrl.govPayments.gstPaid, tdsPaid: ctrl.govPayments.tdsPaid, pendingChallans: ctrl.govPayments.pendingChallans, upcoming: ctrl.govPayments.upcoming.length });
  console.log("journals:", ctrl.journals);
  console.log("budgetControl:", ctrl.budgetControl);
  console.log("costCentre:", { total: ctrl.costCentre.total, top: ctrl.costCentre.top.length });
  console.log("profitCentre totals:", ctrl.profitCentre.totals, "rows:", ctrl.profitCentre.rows.length);
  console.log("audit:", { today: ctrl.audit.todayCount, config: ctrl.audit.configChanges, voucher: ctrl.audit.voucherChanges });

  console.log("\nDONE — all three dashboards built without error.");
  await prisma.$disconnect();
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
