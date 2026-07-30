import { guardDecision, bad, ok } from "../_util";
import { getModelConfig, saveModelConfig } from "@/lib/ai/decision/config";
import { DECISION_METRICS } from "@/lib/ai/decision/catalog";
import { configSchema } from "@/lib/ai/decision/contracts";

/** GET /api/ai/decision/config — Model Manager configuration + the metric list. */
export async function GET(req: Request) {
  const g = await guardDecision(req, "AiModelConfig");
  if ("error" in g) return g.error;
  const config = await getModelConfig(g.scope.tenantId);
  const metrics = DECISION_METRICS.map((m) => ({ key: m.key, label: m.label, module: m.module, unit: m.unit }));
  return ok({ config, metrics });
}

/** PUT /api/ai/decision/config — update Model Manager configuration. */
export async function PUT(req: Request) {
  const g = await guardDecision(req, "AiModelConfig");
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const p = configSchema.safeParse(body);
  if (!p.success) return bad(p.error.issues[0]?.message ?? "Invalid input.");
  const config = await saveModelConfig(g.scope.tenantId, g.actor.id, p.data);
  return ok({ config });
}
