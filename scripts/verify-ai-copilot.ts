/**
 * E2E for the AI Copilot foundation (fallback mode — no API key). Exercises the full
 * pipeline: permission → semantic → registry → prompt → Claude Client (fallback) →
 * conversation persistence → dashboard/health. Cleans up. Read-mostly.
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-ai-copilot.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { ask } from "../src/lib/ai/orchestrator";
import { resolveTerms } from "../src/lib/ai/semanticLayer";
import { listModules } from "../src/lib/ai/moduleRegistry";
import { aiDashboard } from "../src/lib/ai/dashboard";
import { aiHealth } from "../src/lib/ai/health";
import { getAiSettings } from "../src/lib/ai/config";

const user = { id: 1, tenantId: 4, fullName: "E2E Runner", role: "owner", roleId: null as number | null, businessId: null as number | null, branchId: null as number | null };
const convIds: number[] = [];

async function main() {
  let pass = true;
  const settings = await getAiSettings(4);
  console.log("Settings:", { enabled: settings.enabled, model: settings.model, apiKeyPresent: settings.apiKeyPresent });

  const terms = await resolveTerms(4, "what is today's sales and outstanding receivable?");
  console.log("Semantic resolve:", terms.map((t) => `${t.term}→${t.entity}`));
  if (terms.length < 2) { pass = false; console.log("  FAIL: semantic layer should resolve 'today's sales' + 'outstanding receivable'"); }

  const mods = await listModules(4);
  console.log("Registered modules:", mods.length, "→", mods.slice(0, 4).map((m) => m.moduleKey));
  if (mods.length < 5) { pass = false; console.log("  FAIL: registry should list the seeded modules"); }

  // Full chat pipeline (fallback answer since no key)
  const r1 = await ask(user, { message: "Show today's sales" });
  convIds.push(r1.conversationId);
  console.log("\nAsk#1 status:", r1.status, "category:", r1.category, "conv:", r1.conversationId);
  console.log("Answer:", r1.answer.slice(0, 120).replace(/\n/g, " "));
  const r2 = await ask(user, { message: "And what is my GST liability?", conversationId: r1.conversationId });
  console.log("Ask#2 status:", r2.status, "category:", r2.category, "sameConv:", r2.conversationId === r1.conversationId);
  if (!(r1.status === "fallback" && r1.answer.length > 20 && r2.conversationId === r1.conversationId)) { pass = false; console.log("  FAIL: chat pipeline / conversation continuity"); }

  // Persistence check
  const msgs = await prisma.aiMessage.count({ where: { conversationId: r1.conversationId } });
  console.log("Messages persisted in conv:", msgs, "(expect 4: 2 user + 2 assistant)");
  if (msgs !== 4) { pass = false; console.log("  FAIL: expected 4 persisted messages"); }

  const logs = await prisma.aiApiLog.count({ where: { tenantId: 4 } });
  console.log("API logs written:", logs);

  const dash = await aiDashboard(4);
  console.log("\nDashboard:", { totalConversations: dash.totalConversations, avgMs: dash.avgResponseTimeMs, claude: dash.claudeStatus, tokens: dash.tokenUsage.total });
  const health = await aiHealth(4, false);
  console.log("Health:", { claudeApi: health.claudeApi, successRate: health.successRate, fallback24h: health.fallback24h });

  console.log(pass ? "\nPASS — AI copilot foundation pipeline works end-to-end (fallback mode)." : "\nFAIL — see above.");
  if (!pass) process.exitCode = 1;
}
main().catch((e) => { console.error("ERROR:", e); process.exit(1); }).finally(async () => {
  for (const id of convIds) { await prisma.aiMessage.deleteMany({ where: { conversationId: id } }); await prisma.aiConversation.delete({ where: { id } }).catch(() => {}); }
  await prisma.aiApiLog.deleteMany({ where: { tenantId: 4, userId: 1 } });
  console.log("Cleaned up.");
  await prisma.$disconnect();
});
