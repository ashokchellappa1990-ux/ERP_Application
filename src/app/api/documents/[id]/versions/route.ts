import { guardDoc, bad, ok } from "../../_util";
import { listVersions, rollbackVersion } from "@/lib/documents/service";
import { rollbackSchema } from "@/lib/documents/contracts";

/** GET /api/documents/[id]/versions — version history (Module 12). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  const versions = await listVersions(g.scope, Number(params.id));
  return ok({ versions });
}

/** POST /api/documents/[id]/versions — rollback to a version (adding a version is via /upload with documentId). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await guardDoc(req);
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = rollbackSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
  const res = await rollbackVersion(g.scope, g.actor, Number(params.id), parsed.data.versionNo);
  if (!res.ok) return bad(res.message ?? "Rollback failed.", 422);
  return ok({ message: `Rolled back to v${parsed.data.versionNo}.` });
}
