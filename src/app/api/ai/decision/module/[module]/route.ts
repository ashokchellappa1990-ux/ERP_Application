import { guardDecision, bad, ok, readParams } from "../../_util";
import { predictModule } from "@/lib/ai/decision/predict";
import { detectRisks } from "@/lib/ai/decision/risk";
import { detectOpportunities } from "@/lib/ai/decision/opportunity";
import { recommendations } from "@/lib/ai/decision/recommend";
import { DECISION_MODULES, type DecisionModule } from "@/lib/ai/decision/catalog";

/** GET /api/ai/decision/module/[module] — predictions + risks + opps + recs for one module. */
export async function GET(req: Request, { params }: { params: { module: string } }) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  const mod = params.module as DecisionModule;
  if (!DECISION_MODULES.some((m) => m.key === mod)) return bad("Unknown module.", 404);
  const { period, horizonDays } = readParams(req);
  const predictions = await predictModule(g.scope, mod, { horizonDays: horizonDays ?? 30, period });
  const [risks, opportunities, recs] = await Promise.all([
    detectRisks(g.scope, { period }).then((r) => r.filter((x) => x.module === mod)),
    detectOpportunities(g.scope, { period }).then((o) => o.filter((x) => x.module === mod)),
    recommendations(g.scope, { period }).then((rc) => rc.filter((x) => x.module === mod)),
  ]);
  return ok({ module: mod, predictions, risks, opportunities, recommendations: recs });
}
