import { guardDoc, bad, ok } from "../../_util";
import { transitionStatus } from "@/lib/documents/service";
import { transitionSchema } from "@/lib/documents/contracts";

/** POST /api/documents/[id]/approve — workflow transition Draft→Review→Approved→Published→Archived (Module 13). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid status.");
  const res = await transitionStatus(g.scope, g.actor, Number(params.id), parsed.data.to);
  if (!res.ok) return bad(res.message ?? "Transition not allowed.", 422);
  return ok({ document: res.doc });
}
