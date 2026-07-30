import { prisma } from "@/lib/db/prisma";
import { guardDoc, bad, ok } from "../../_util";
import { generateFaqs } from "@/lib/documents/ai";
import { promoteFaqsToKnowledge } from "@/lib/documents/knowledge";
import { faqSchema } from "@/lib/documents/contracts";

/** GET /api/documents/[id]/faqs — stored FAQs. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  const faqs = await prisma.docFaq.findMany({ where: { tenantId: g.scope.tenantId, documentId: Number(params.id) }, orderBy: { sortOrder: "asc" } });
  return ok({ faqs });
}

/** POST /api/documents/[id]/faqs — generate FAQs (Module 10); optionally promote to KB. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  let body: unknown = {}; try { body = await req.json(); } catch { /* optional */ }
  const parsed = faqSchema.safeParse(body ?? {});
  const count = parsed.success ? (parsed.data.count ?? 10) : 10;
  const id = Number(params.id);
  const { items, generatedBy } = await generateFaqs(g.scope, g.actor, id, count);
  if (!items.length) return bad("No text available to generate FAQs. Run OCR first if this is a scan.", 422);
  await prisma.docFaq.deleteMany({ where: { tenantId: g.scope.tenantId, documentId: id, generatedBy: "ai" } }).catch(() => {});
  await prisma.docFaq.createMany({ data: items.map((f, i) => ({ tenantId: g.scope.tenantId, documentId: id, question: f.question.slice(0, 500), answer: f.answer, sortOrder: i, generatedBy: "ai", createdBy: g.actor.id })) });
  let promoted = 0;
  if (parsed.success && parsed.data.promote) promoted = await promoteFaqsToKnowledge(g.scope, g.actor, id, parsed.data.categoryId ?? null);
  return ok({ count: items.length, items, generatedBy, promoted });
}
