import { guardDoc, ok } from "../_util";
import { knowledgeAnalytics } from "@/lib/documents/analytics";

/** GET /api/documents/analytics — knowledge platform dashboard metrics (Module 16). */
export async function GET(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "Document");
  if ("error" in g) return g.error;
  const analytics = await knowledgeAnalytics(g.scope);
  return ok({ analytics });
}
