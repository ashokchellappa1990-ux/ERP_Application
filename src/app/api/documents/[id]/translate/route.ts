import { guardDoc, bad, ok } from "../../_util";
import { translateDoc } from "@/lib/documents/ai";
import { translateSchema } from "@/lib/documents/contracts";
import { SUPPORTED_LANGS } from "@/lib/documents/types";

/** POST /api/documents/[id]/translate — translate document text (Module 11). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = translateSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
  const lang = parsed.data.lang;
  const label = SUPPORTED_LANGS.find((l) => l.code === lang)?.label ?? lang;
  const res = await translateDoc(g.scope, g.actor, Number(params.id), lang, label);
  return ok({ text: res.text, status: res.status, model: res.model, lang, label });
}
