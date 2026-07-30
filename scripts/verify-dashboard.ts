/**
 * Exercises the enterprise dashboard service against LIVE data (read-only).
 * Picks the tenant with the most sales, builds a full-access scope for it, and
 * runs every section builder — proving the real Prisma queries execute with no
 * field/runtime errors and returning real numbers.
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-dashboard.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { ALL_PERMISSION_KEYS } from "../src/lib/auth/permissions";
import { buildAccess } from "../src/lib/dashboard/access";
import { getPeriods } from "../src/lib/dashboard/period";
import * as svc from "../src/lib/dashboard/service";
import type { ActiveScope } from "../src/lib/auth/scope";

async function main() {
  // Pick the busiest tenant.
  const grouped = await prisma.sale.groupBy({ by: ["tenantId"], _count: true, orderBy: { _count: { tenantId: "desc" } }, take: 1 });
  const tenantId = grouped[0]?.tenantId ?? 1;
  const branches = await prisma.branch.findMany({ where: { tenantId }, select: { id: true } });
  const scope: ActiveScope = { tenantId, businessId: null, branchId: branches[0]?.id ?? null, branchIds: null, readBranchIds: branches.map((b) => b.id) };
  const access = buildAccess([...ALL_PERMISSION_KEYS]);
  const gs = await prisma.generalSetting.findFirst({ where: { tenantId }, select: { fiscalYearStart: true, timezone: true } });
  const periods = getPeriods(gs?.fiscalYearStart ?? "April", gs?.timezone ?? "Asia/Kolkata");
  const ctx = { scope, access, periods };

  console.log(`\n=== Dashboard smoke · tenant ${tenantId} · ${periods.fyLabel} · today ${periods.today} ===\n`);

  const header = await svc.getHeader(ctx, { userName: "Verifier", roleName: "Owner" });
  console.log("HEADER:", { biz: header.businessName, branch: header.branchLabel, health: `${header.healthScore} (${header.healthBand})`, plan: header.plan, sub: header.subscriptionStatus, quickActions: header.quickActions.length, reports: header.reports.length });

  const kpis = await svc.getKpis(ctx);
  console.log(`\nKPIs (${kpis.length}):`);
  for (const k of kpis) console.log(`  • ${k.label.padEnd(26)} = ${k.value}${k.format === "pct" ? "%" : ""}${k.delta != null ? `  (Δ ${k.delta}% ${k.deltaLabel ?? ""})` : ""}`);

  const charts = await svc.getCharts(ctx);
  console.log(`\nCHARTS (${charts.length}): ${charts.map((c) => `${c.id}[${c.type}:${c.series ? c.series.length : c.data.length}pts]`).join(", ")}`);

  const health = await svc.getHealth(ctx);
  console.log(`\nHEALTH score=${health.score} band=${health.band} metrics=${health.metrics.map((m) => `${m.label}:${m.value}${m.unit === "pct" ? "%" : m.unit === "x" ? "x" : ""}`).join(" | ")}`);

  const pending = await svc.getPending(ctx);
  console.log(`\nPENDING (${pending.length}): ${pending.map((p) => `${p.label}=${p.count}`).join(", ") || "none"}`);

  const notes = await svc.getNotifications(ctx);
  console.log(`NOTIFICATIONS (${notes.length}): ${notes.map((n) => `${n.title}(${n.count})`).join(", ") || "none"}`);

  const insights = await svc.getInsights(ctx);
  console.log(`\nINSIGHTS (${insights.length}):`);
  for (const i of insights) console.log(`  • [${i.tone}] ${i.title} — ${i.text}`);

  const activity = await svc.getActivity(ctx);
  console.log(`\nACTIVITY (${activity.length} rows): ${activity.slice(0, 4).map((a) => a.summary).join(" | ")}`);

  const search = await svc.getSearch(ctx, "a");
  console.log(`\nSEARCH 'a': ${search.map((g) => `${g.group}(${g.items.length})`).join(", ") || "no matches"}`);

  console.log("\n=== KPI DRILL-DOWN (how values are generated) ===");
  for (const key of ["todaySales", "monthSales", "fyProfit", "salesGrowth", "profitGrowth", "grossMargin", "receivable", "payable", "cashBalance", "inventoryValue", "customers", "collectionEfficiency"]) {
    const det = await svc.getKpiDetail(ctx, key);
    if (!det) { console.log(`  ${key.padEnd(20)} → (no detail)`); continue; }
    console.log(`  ${det.label.padEnd(24)} = ${det.value}${det.format === "pct" ? "%" : ""}  | ${det.formula ?? ""} | components: ${det.components.map((c) => `${c.label}=${c.value}`).join(", ")}${det.breakdown ? ` | breakdown:${det.breakdown.kind}(${det.breakdown.data.length})` : ""}`);
  }

  console.log("\n✅ All sections + drill-downs executed with no runtime errors.\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error("❌", e); process.exit(1); });
