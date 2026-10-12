import { guardDecision, bad, ok, readParams } from "../_util";
import { registerDecisionModule } from "@/lib/ai/decision/seed";
import { decisionOverview } from "@/lib/ai/decision/engine";
import { businessHealth } from "@/lib/ai/decision/health";
import { detectRisks } from "@/lib/ai/decision/risk";
import { detectOpportunities } from "@/lib/ai/decision/opportunity";
import { recommendations } from "@/lib/ai/decision/recommend";
import { predictionAccuracy } from "@/lib/ai/decision/history";

/** GET /api/ai/decision/[section] — overview|health|risks|opportunities|recommendations|analytics|history|notifications|config. */
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  const { scope } = g;
  await registerDecisionModule().catch(() => {});
  const { period, horizonDays, url } = readParams(req);
  try {
    switch (params.section) {
      case "overview": return ok({ overview: await decisionOverview(scope, { period, horizonDays }) });
      case "health": return ok({ health: await businessHealth(scope, { period }) });
      case "risks": return ok({ risks: await detectRisks(scope, { period }) });
      case "opportunities": return ok({ opportunities: await detectOpportunities(scope, { period }) });
      case "recommendations": return ok({ recommendations: await recommendations(scope, { period }) });
      case "analytics": return ok({ analytics: await predictionAccuracy(scope) });
      default: return bad("Unknown section.", 404);
    }
  } catch (e) {
    console.error(`[decision/${params.section}]`, e);
    return bad(e instanceof Error ? e.message : "Failed.", 500);
  }
}
