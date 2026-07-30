import { guardDoc, bad, ok } from "../_util";
import { getDocument, updateDocument, softDeleteDocument } from "@/lib/documents/service";
import { updateDocSchema } from "@/lib/documents/contracts";

/** GET /api/documents/[id] — full document (increments view). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  const doc = await getDocument(g.scope, Number(params.id), { incView: true, actor: g.actor });
  if (!doc) return bad("Document not found.", 404);
  const safe = (s: string | null) => { if (!s) return null; try { return JSON.parse(s); } catch { return null; } };
  return ok({ document: { ...doc, tags: safe(doc.tagsJson) ?? [], entities: safe(doc.entitiesJson), keywords: safe(doc.keywordsJson) ?? [], summary: safe(doc.summaryJson) } });
}

/** PATCH /api/documents/[id] — update metadata. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = updateDocSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
  const updated = await updateDocument(g.scope, g.actor, Number(params.id), parsed.data);
  if (!updated) return bad("Document not found.", 404);
  return ok({ document: { id: updated.id, title: updated.title } });
}

/** DELETE /api/documents/[id] — soft delete. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  const done = await softDeleteDocument(g.scope, g.actor, Number(params.id));
  if (!done) return bad("Document not found.", 404);
  return ok({ message: "Document moved to Deleted." });
}
