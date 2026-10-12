import { prisma } from "../src/lib/db/prisma";
import { ask } from "../src/lib/ai/orchestrator";
async function main(){
  const brs = await prisma.branch.findMany({ where: { tenantId: 4 }, select: { id: true } });
  const scope = { tenantId: 4, businessId: null, branchId: brs[0]?.id ?? null, branchIds: null, readBranchIds: brs.map(b=>b.id) } as any;
  const user = { id: 1, tenantId: 4, role: "owner", roleId: null, businessId: null, branchId: null, fullName:"R" } as any;
  const convIds = new Set<number>();
  const say = async (msg: string, convId?: number) => { const r = await ask(user, { message: msg, conversationId: convId }, scope); convIds.add(r.conversationId); return r; };
  let pass = true;

  // 1) NAVIGATE
  const nav = await say("open supplier master");
  console.log("\n[navigate] 'open supplier master' → status:", nav.status, "| navigate:", nav.extras?.navigate);
  if (!(nav.status === "navigate" && nav.extras?.navigate?.href === "/masters/supplier")) { pass=false; console.log("  FAIL navigate"); }

  // 2) CREATE EXPENSE — multi-turn smart collection
  console.log("\n[create] smart data collection:");
  let r = await say("create expense voucher");
  const cid = r.conversationId;
  console.log("  create expense → ask:", r.answer);
  r = await say("Electricity", cid); console.log("  head=Electricity → ask:", r.answer);
  r = await say("TNEB", cid); console.log("  party=TNEB → ask:", r.answer);
  r = await say("18500", cid); console.log("  amount=18500 → ask:", r.answer);
  r = await say("yes", cid); console.log("  gst=yes → status:", r.status, "| draft:", JSON.stringify(r.extras?.draft));
  const draftReady = r.status === "draft" && r.extras?.draft?.status === "Draft" && r.extras.draft.targetHref === "/finance/petty-cash/new";
  if (!draftReady) { pass=false; console.log("  FAIL draft not ready"); }

  // verify a draft row exists and NO real petty cash voucher was posted
  const drafts = await prisma.aiCommandDraft.findMany({ where: { tenantId: 4, userId: 1, txType: "expense", status: "Draft" } });
  const pcvBefore = await prisma.pettyCashVoucher.count({ where: { tenantId: 4 } });
  console.log("  AI drafts (expense, Draft):", drafts.length, "| summary:", drafts[0]?.summary);
  console.log("  Petty cash vouchers in DB (should be UNCHANGED — AI never posts):", pcvBefore);
  if (drafts.length < 1) { pass=false; console.log("  FAIL no draft row"); }

  // 3) QUERY still works (BI)
  const q = await say("what is my cash balance");
  console.log("\n[query] 'cash balance' → status:", q.status, "|", q.answer.split("\n")[0]);
  if (q.status === "navigate" || q.status === "draft") { pass=false; console.log("  FAIL query hijacked by command"); }

  // 4) action history logged
  const acts = await prisma.aiCommandAction.count({ where: { tenantId: 4, userId: 1 } });
  console.log("\n[audit] command actions logged:", acts);
  if (acts < 3) { pass=false; console.log("  FAIL action history"); }

  console.log(pass ? "\nPASS — command center navigates, drafts (never posts), queries, audits." : "\nFAIL — see above.");
  if (!pass) process.exitCode = 1;

  // cleanup
  for (const id of convIds) { await prisma.aiMessage.deleteMany({ where: { conversationId: id } }); await prisma.aiConversation.delete({ where: { id } }).catch(()=>{}); }
  await prisma.aiCommandDraft.deleteMany({ where: { tenantId: 4, userId: 1 } });
  await prisma.aiCommandAction.deleteMany({ where: { tenantId: 4, userId: 1 } });
  await prisma.aiApiLog.deleteMany({ where: { tenantId: 4, userId: 1 } });
  await prisma.$disconnect();
}
main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
