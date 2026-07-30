import { guardDoc, bad, ok } from "../_util";
import { listCategories, createCategory, updateCategory } from "@/lib/documents/categories";
import { ensureKnowledgeSeed } from "@/lib/documents/seed";
import { categorySchema } from "@/lib/documents/contracts";

/** GET /api/documents/categories — category master with document counts (Module 2). */
export async function GET(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "DocCategory");
  if ("error" in g) return g.error;
  await ensureKnowledgeSeed(g.scope).catch(() => {});
  const categories = await listCategories(g.scope, { withCounts: true });
  return ok({ categories });
}

/** POST /api/documents/categories — create a category. */
export async function POST(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "DocCategory");
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
  const cat = await createCategory(g.scope, g.actor, parsed.data);
  return ok({ category: cat });
}

/** PATCH /api/documents/categories — update a category (id in body). */
export async function PATCH(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "DocCategory");
  if ("error" in g) return g.error;
  let body: { id?: number } & Record<string, unknown>; try { body = await req.json(); } catch { return bad("Invalid body."); }
  if (!body.id) return bad("id is required.");
  const updated = await updateCategory(g.scope, Number(body.id), body as never);
  if (!updated) return bad("Category not found.", 404);
  return ok({ category: updated });
}
