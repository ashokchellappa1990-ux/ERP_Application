import { prisma } from "@/lib/db/prisma";
import { guardDoc, bad, ok } from "../_util";
import { compareDocs } from "@/lib/documents/ai";
import { compareSchema } from "@/lib/documents/contracts";

/** POST /api/documents/compare — diff two documents/versions (Module 7). */
export async function POST(req: Request) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = compareSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
  const { leftId, rightId } = parsed.data;
  const diff = await compareDocs(g.scope, g.actor, leftId, rightId);
  await prisma.docComparison.create({ data: { tenantId: g.scope.tenantId, leftDocId: leftId, rightDocId: rightId, resultJson: JSON.stringify(diff), createdBy: g.actor.id } }).catch(() => {});
  return ok({ diff });
}
