import { prisma } from "@/lib/db/prisma";
import { guardDoc, bad, ok } from "../../_util";
import { summarizeDoc } from "@/lib/documents/ai";
import { summarySchema } from "@/lib/documents/contracts";

/** POST /api/documents/[id]/summary — generate a structured summary (Module 6). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  let body: unknown = {}; try { body = await req.json(); } catch { /* optional body */ }
  const parsed = summarySchema.safeParse(body ?? {});
  const kind = parsed.success ? (parsed.data.kind ?? "executive") : "executive";
  const id = Number(params.id);
  const summary = await summarizeDoc(g.scope, g.actor, id, kind);
  await prisma.document.update({ where: { id }, data: { summaryJson: JSON.stringify(summary) } }).catch(() => {});
  return ok({ summary });
}
