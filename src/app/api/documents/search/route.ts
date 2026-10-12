import { guardDoc, ok } from "../_util";
import { searchDocuments } from "@/lib/documents/retrieval";

/** GET /api/documents/search?q= — natural-language / keyword document search (Module 9). */
export async function GET(req: Request) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  const u = new URL(req.url);
  const q = u.searchParams.get("q") || "";
  if (q.trim().length < 2) return ok({ hits: [] });
  const categoryId = u.searchParams.get("categoryId") ? Number(u.searchParams.get("categoryId")) : undefined;
  const hits = await searchDocuments(g.scope, q, { limit: 20, categoryId });
  return ok({ hits });
}
