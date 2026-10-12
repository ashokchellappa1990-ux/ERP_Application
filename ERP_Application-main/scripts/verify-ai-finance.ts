/**
 * Smoke test the AI Finance Intelligence engine against live data (tenant 4). Read-only.
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-ai-finance.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { analyze, pulse, search } from "../src/lib/finance/ai/engine";

async function main() {
  const brs = await prisma.branch.findMany({ where: { tenantId: 4 }, select: { id: true } });
  const scope = { tenantId: 4, businessId: null, branchId: brs[0]?.id ?? null, branchIds: null, readBranchIds: brs.map((b) => b.id) };
  const period = new Date().toISOString().slice(0, 7);
  const fb = new Map<string, { status: string; assignedTo: string | null }>();

  const a = await analyze(scope, { period }, fb);
  console.log("Period:", a.period, "| Priority:", a.priorityScore);
  console.log("Health:", a.health.score, a.health.status, `(${a.health.color})`, "| factors:", a.health.factors.length);
  console.log("Insights:", a.insights.length, "→", a.insights.slice(0, 3).map((i) => `[${i.severity}] ${i.title}`));
  console.log("Alerts:", a.alerts.length, "→", a.alerts.slice(0, 3).map((x) => `[${x.level}] ${x.type}`));
  console.log("Actions:", a.actions.map((x) => `${x.label}:${x.count}`).join(", ") || "(none)");
  console.log("Forecast horizons:", a.forecast.map((f) => `${f.days}d cash=${f.cashBalance}`).join(" | "));
  console.log("Recommendations:", a.recommendations.length, "→", a.recommendations.slice(0, 2).map((r) => `${r.title} (P${r.priority})`));
  console.log("Compliance GST net:", a.compliance.gst.net, "| TDS pending:", a.compliance.tds.pending);
  console.log("Recent:", a.recent.length, "| Upcoming:", a.upcoming.length);
  console.log("System:", a.system.map((s) => `${s.name}:${s.ok ? "ok" : "down"}`).join(", "));

  const p1 = await pulse(scope);
  console.log("\nPulse signature:", p1);

  const s = await search(scope, "INV");
  console.log("Search 'INV':", s.results.length, "results");

  const ok = a.health.factors.length === 10 && a.forecast.length === 3 && a.insights.length > 0 && a.system.length >= 5 && !!p1;
  console.log(ok ? "\nPASS — AI engine produced a complete analysis." : "\nFAIL — incomplete analysis.");
  if (!ok) process.exitCode = 1;
  await prisma.$disconnect();
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
