import { guardDoc, ok } from "../../_util";
import { ocrDocument } from "@/lib/documents/ai";

export const runtime = "nodejs";

/** POST /api/documents/[id]/ocr — extract text + fields from a scanned image (Module 3). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  const result = await ocrDocument(g.scope, g.actor, Number(params.id));
  return ok({ result });
}
