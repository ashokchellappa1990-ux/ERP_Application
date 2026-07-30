import { prisma } from "@/lib/db/prisma";
import { guardDecision, bad, ok } from "../_util";
import { feedbackSchema } from "@/lib/ai/decision/contracts";

/** POST /api/ai/decision/feedback — disposition a risk/opportunity/recommendation
 *  (acknowledge/dismiss/resolve/assign); status "open" clears it. */
export async function POST(req: Request) {
  const g = await guardDecision(req, "AiDecisionFeedback");
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const p = feedbackSchema.safeParse(body);
  if (!p.success) return bad(p.error.issues[0]?.message ?? "Invalid input.");
  const { itemType, itemKey, status, assignedTo, note } = p.data;
  const existing = await prisma.aiDecisionFeedback.findFirst({ where: { tenantId: g.scope.tenantId, itemType, itemKey }, select: { id: true } });
  if (status === "open") { if (existing) await prisma.aiDecisionFeedback.delete({ where: { id: existing.id } }); return ok({ message: "Cleared." }); }
  if (existing) await prisma.aiDecisionFeedback.update({ where: { id: existing.id }, data: { status, assignedTo: assignedTo ?? null, note: note ?? null } });
  else await prisma.aiDecisionFeedback.create({ data: { tenantId: g.scope.tenantId, businessId: g.scope.businessId ?? null, itemType, itemKey, status, assignedTo: assignedTo ?? null, note: note ?? null, createdBy: g.actor.id } });
  return ok({ message: "Saved." });
}

/** GET /api/ai/decision/feedback — current dispositions (to filter dismissed items). */
export async function GET(req: Request) {
  const g = await guardDecision(req, "AiDecisionFeedback");
  if ("error" in g) return g.error;
  const rows = await prisma.aiDecisionFeedback.findMany({ where: { tenantId: g.scope.tenantId }, select: { itemType: true, itemKey: true, status: true, assignedTo: true } });
  return ok({ feedback: rows });
}
