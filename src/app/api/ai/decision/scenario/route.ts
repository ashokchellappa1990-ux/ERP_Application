import { prisma } from "@/lib/db/prisma";
import { scopeData } from "@/lib/auth/scope";
import { guardDecision, bad, ok } from "../_util";
import { simulate } from "@/lib/ai/decision/scenario";
import { scenarioSchema } from "@/lib/ai/decision/contracts";

/** GET /api/ai/decision/scenario — saved scenarios. */
export async function GET(req: Request) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  const rows = await prisma.aiScenario.findMany({ where: { tenantId: g.scope.tenantId }, orderBy: { createdAt: "desc" }, take: 50 });
  return ok({ scenarios: rows.map((s) => ({ id: s.id, name: s.name, inputs: JSON.parse(s.inputsJson || "{}"), createdByName: s.createdByName, createdAt: s.createdAt })) });
}

/** POST /api/ai/decision/scenario — run (and optionally save) a what-if simulation. */
export async function POST(req: Request) {
  const g = await guardDecision(req);
  if ("error" in g) return g.error;
  let body: unknown; try { body = await req.json(); } catch { return bad("Invalid body."); }
  const parsed = scenarioSchema.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
  const result = await simulate(g.scope, parsed.data.inputs);
  if (parsed.data.save && parsed.data.name) {
    await prisma.aiScenario.create({ data: { tenantId: g.scope.tenantId, ...scopeData(g.scope, { branch: true }), name: parsed.data.name.slice(0, 160), inputsJson: JSON.stringify(parsed.data.inputs), resultJson: JSON.stringify(result.metrics), createdBy: g.actor.id, createdByName: g.actor.fullName ?? null } }).catch(() => {});
  }
  return ok({ result });
}
