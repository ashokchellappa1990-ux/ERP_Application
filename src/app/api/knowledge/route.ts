import { guardDoc, bad, ok } from "../documents/_util";
import { listKnowledge, searchKnowledge, createKnowledge, updateKnowledge, deleteKnowledge } from "@/lib/documents/knowledge";
import { knowledgeSchema } from "@/lib/documents/contracts";

/** GET /api/knowledge — list or search Knowledge Base entries (Module 8). */
export async function GET(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "KnowledgeBase");
  if ("error" in g) return g.error;
  const u = new URL(req.url);
  const q = u.searchParams.get("q") || undefined;
  const search = u.searchParams.get("search") === "1";
  if (search && q) return ok({ entries: await searchKnowledge(g.scope, q) });
  const entries = await listKnowledge(g.scope, {
    q, categoryId: u.searchParams.get("categoryId") ? Number(u.searchParams.get("categoryId")) : undefined,
    source: u.searchParams.get("source") || undefined, status: u.searchParams.get("status") || undefined,
  });
  return ok({ entries });
}

/** POST /api/knowledge — create a KB entry. */
export async function POST(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "KnowledgeBase");
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = knowledgeSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
  const kb = await createKnowledge(g.scope, g.actor, parsed.data);
  return ok({ entry: kb });
}

/** PATCH /api/knowledge — update a KB entry (id in body). */
export async function PATCH(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "KnowledgeBase");
  if ("error" in g) return g.error;
  let body: { id?: number } & Record<string, unknown>; try { body = await req.json(); } catch { return bad("Invalid body."); }
  if (!body.id) return bad("id is required.");
  const updated = await updateKnowledge(g.scope, Number(body.id), body as never);
  if (!updated) return bad("Entry not found.", 404);
  return ok({ entry: updated });
}

/** DELETE /api/knowledge?id= — archive a KB entry. */
export async function DELETE(req: Request) {
  const g = await guardDoc(req, "ai.knowledge", "KnowledgeBase");
  if ("error" in g) return g.error;
  const id = Number(new URL(req.url).searchParams.get("id") || 0);
  if (!id) return bad("id is required.");
  const done = await deleteKnowledge(g.scope, id);
  if (!done) return bad("Entry not found.", 404);
  return ok({ message: "Archived." });
}
