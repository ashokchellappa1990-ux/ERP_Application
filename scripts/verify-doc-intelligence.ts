import { prisma } from "../src/lib/db/prisma";
import { extractText } from "../src/lib/documents/extract";
import { createDocument, addVersion, rollbackVersion, transitionStatus, listVersions } from "../src/lib/documents/service";
import { searchDocuments, resolveDocs } from "../src/lib/documents/retrieval";
import { chatWithDoc, summarizeDoc, compareDocs, generateFaqs } from "../src/lib/documents/ai";
import { knowledgeAnalytics } from "../src/lib/documents/analytics";
import { ensureKnowledgeSeed } from "../src/lib/documents/seed";
import { ask } from "../src/lib/ai/orchestrator";

const T = 4;
async function main() {
  const brs = await prisma.branch.findMany({ where: { tenantId: T }, select: { id: true } });
  const scope: any = { tenantId: T, businessId: null, branchId: brs[0]?.id ?? null, branchIds: null, readBranchIds: brs.map((b) => b.id) };
  const actor: any = { id: 1, tenantId: T, role: "owner", roleId: null, businessId: null, branchId: scope.branchId, fullName: "Verifier" };
  const created: number[] = []; const convs: number[] = [];
  let pass = true; const chk = (c: boolean, m: string) => { console.log(c ? "  [ok] " + m : "  [FAIL] " + m); if (!c) pass = false; };

  await ensureKnowledgeSeed(scope);

  const policyA = "EMPLOYEE LEAVE POLICY\n\nAll permanent employees are entitled to 24 days of paid annual leave per calendar year. Sick leave is 12 days. Leave must be applied 7 days in advance through the HR portal. Unused leave up to 10 days may be carried forward. The warranty period for company laptops is 36 months. Payment terms for reimbursements are net 30 days. This policy is governed by the Shops and Establishments Act.\n\nContact hr@acme.com for questions.";
  const policyB = "EMPLOYEE LEAVE POLICY\n\nAll permanent employees are entitled to 30 days of paid annual leave per calendar year. Sick leave is 12 days. Leave must be applied 5 days in advance through the HR portal. Unused leave up to 15 days may be carried forward. The warranty period for company laptops is 36 months. Payment terms for reimbursements are net 45 days. This policy is governed by the Shops and Establishments Act.";

  console.log("\n=== A) Upload + extract + index ===");
  const exA = await extractText(Buffer.from(policyA, "utf8"), "leave-policy.txt", "text/plain");
  const docA = await createDocument(scope, actor, { fileName: "leave-policy.txt", fileUrl: "/uploads/documents/4/test-a.txt", fileType: "text/plain", fileExt: "txt", fileSize: policyA.length }, exA, { tags: ["hr", "policy"], department: "HR" });
  created.push(docA.id);
  const chunkCount = await prisma.docChunk.count({ where: { tenantId: T, documentId: docA.id } });
  const full = await prisma.document.findUnique({ where: { id: docA.id } });
  chk(!!full?.extractedText && full.extractedText.toLowerCase().includes("leave"), "extractedText saved");
  chk(chunkCount > 0, "chunks created (" + chunkCount + ")");
  chk(!!full?.keywordsJson && full.keywordsJson.includes("leave"), "keywords indexed");
  chk(!!full?.entitiesJson && full.entitiesJson.includes("hr@acme.com"), "entities extracted (email)");

  console.log("\n=== B) Search finds it ===");
  const hits = await searchDocuments(scope, "employee leave policy carry forward");
  chk(hits.some((h) => h.id === docA.id), "search returns the doc (" + hits.length + " hits, top score " + (hits[0]?.score ?? 0) + ")");

  console.log("\n=== C) Chat answers from the doc ===");
  const chat = await chatWithDoc(scope, actor, docA.id, "How many annual leave days do employees get?");
  chk(/24|leave/i.test(chat.answer), "chat answered (status=" + chat.status + ")");

  console.log("\n=== D) Summary ===");
  const sum = await summarizeDoc(scope, actor, docA.id, "executive");
  chk(sum.keyPoints.length > 0, "summary produced (" + sum.keyPoints.length + " key points, " + sum.importantClauses.length + " clauses, " + sum.importantAmounts.length + " amounts, generatedBy=" + sum.generatedBy + ")");

  console.log("\n=== E) Compare two docs ===");
  const exB = await extractText(Buffer.from(policyB, "utf8"), "leave-policy-v2.txt", "text/plain");
  const docB = await createDocument(scope, actor, { fileName: "leave-policy-v2.txt", fileUrl: "/uploads/documents/4/test-b.txt", fileType: "text/plain", fileExt: "txt", fileSize: policyB.length }, exB, { tags: ["hr"] });
  created.push(docB.id);
  const diff = await compareDocs(scope, actor, docA.id, docB.id);
  chk(diff.stats.added + diff.stats.removed + diff.stats.modified > 0, "diff found changes (added=" + diff.stats.added + " removed=" + diff.stats.removed + " modified=" + diff.stats.modified + " sim=" + diff.stats.similarity + "%)");

  console.log("\n=== F) FAQ generation ===");
  const faq = await generateFaqs(scope, actor, docA.id, 6);
  chk(faq.items.length > 0, "FAQs generated (" + faq.items.length + ", generatedBy=" + faq.generatedBy + ")");

  console.log("\n=== G) Versioning + rollback ===");
  const v2 = await addVersion(scope, actor, docA.id, { fileName: "leave-policy-v2.txt", fileUrl: "/uploads/documents/4/test-a-v2.txt", fileType: "text/plain", fileExt: "txt", fileSize: policyB.length }, exB, "Updated leave to 30 days");
  chk(v2?.versionNo === 2, "version 2 added");
  await rollbackVersion(scope, actor, docA.id, 1);
  const vers = await listVersions(scope, docA.id);
  chk(vers.find((v) => v.versionNo === 1)?.isCurrent === true, "rollback set v1 current");

  console.log("\n=== H) Approval workflow ===");
  for (const to of ["Review", "Approved", "Published"]) { const r = await transitionStatus(scope, actor, docB.id, to as any); chk(r.ok, "-> " + to); }

  console.log("\n=== I) Copilot answers from documents (resolveDocs) ===");
  const rd = await resolveDocs(scope, "what is the employee leave policy?");
  chk(!!rd && rd.sources.length > 0, "resolveDocs returned sources (" + (rd?.sources.length ?? 0) + ")");
  const a = await ask(actor, { message: "what is the leave policy?" }, scope); convs.push(a.conversationId);
  chk(!!a.extras?.docSources && a.extras.docSources.length > 0, "ask() attached docSources (" + (a.extras?.docSources?.length ?? 0) + ")");
  chk(/leave|policy|document/i.test(a.answer), "copilot answer references the document");

  console.log("\n=== J) Analytics ===");
  const an = await knowledgeAnalytics(scope);
  chk(an.totalDocuments >= 2 && an.totalQueries > 0, "analytics (docs=" + an.totalDocuments + ", queries=" + an.totalQueries + ", coverage=" + an.coverage + "%, avgMs=" + an.avgResponseMs + ")");

  console.log(pass ? "\nPASS - full document intelligence pipeline verified." : "\nFAIL");

  for (const id of created) {
    await prisma.docChunk.deleteMany({ where: { tenantId: T, documentId: id } });
    await prisma.docVersion.deleteMany({ where: { tenantId: T, documentId: id } });
    await prisma.docFaq.deleteMany({ where: { tenantId: T, documentId: id } });
    await prisma.docTranslation.deleteMany({ where: { tenantId: T, documentId: id } });
    await prisma.docOcrJob.deleteMany({ where: { tenantId: T, documentId: id } });
    await prisma.docComparison.deleteMany({ where: { tenantId: T, OR: [{ leftDocId: id }, { rightDocId: id }] } });
    await prisma.document.delete({ where: { id } }).catch(() => {});
  }
  await prisma.docAiQuery.deleteMany({ where: { tenantId: T, userId: 1 } });
  await prisma.docCategory.deleteMany({ where: { tenantId: T, systemSeed: true } });
  for (const id of convs) { await prisma.aiMessage.deleteMany({ where: { conversationId: id } }); await prisma.aiConversation.delete({ where: { id } }).catch(() => {}); }
  await prisma.$disconnect();
  if (!pass) process.exit(1);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
