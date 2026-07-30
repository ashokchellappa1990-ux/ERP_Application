import { guardDecision, bad, ok } from "../_util";
import { listDecisions, logDecision, updateDecision, recordActual } from "@/lib/ai/decision/history";
import { decisionLogSchema, decisionUpdateSchema, actualSchema } from "@/lib/ai/decision/contracts";

/** GET /api/ai/decision/history — decision log. */
export async function GET(req: Request) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  const source = new URL(req.url).searchParams.get("source") || undefined;
  return ok({ decisions: await listDecisions(g.scope, { source }) });
}

/** POST /api/ai/decision/history — { action: "log"|"update"|"actual", ... }. */
export async function POST(req: Request) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  let body: { action?: string } & Record<string, unknown>; try { body = await req.json(); } catch { return bad("Invalid body."); }
  if (body.action === "update") {
    const p = decisionUpdateSchema.safeParse(body); if (!p.success) return bad(p.error.issues[0]?.message ?? "Invalid.");
    const done = await updateDecision(g.scope, p.data.id, p.data); return done ? ok({ message: "Updated." }) : bad("Not found.", 404);
  }
  if (body.action === "actual") {
    const p = actualSchema.safeParse(body); if (!p.success) return bad(p.error.issues[0]?.message ?? "Invalid.");
    const r = await recordActual(g.scope, p.data.predictionId, p.data.actualValue); return r.ok ? ok({ accuracyPct: r.accuracyPct }) : bad("Prediction not found.", 404);
  }
  const p = decisionLogSchema.safeParse(body); if (!p.success) return bad(p.error.issues[0]?.message ?? "Invalid.");
  const id = await logDecision(g.scope, g.actor, p.data);
  return ok({ id });
}
