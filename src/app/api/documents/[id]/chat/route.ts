import { guardDoc, bad, ok } from "../../_util";
import { chatWithDoc } from "@/lib/documents/ai";
import { chatSchema } from "@/lib/documents/contracts";

/** POST /api/documents/[id]/chat — ask a question answered from the document (Module 5). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
  const res = await chatWithDoc(g.scope, g.actor, Number(params.id), parsed.data.question);
  return ok({ answer: res.answer, status: res.status, model: res.model, sources: res.sources });
}
