import { NextResponse } from "next/server";
import { currentAiActor } from "@/lib/ai/actor";
import { METRICS } from "@/lib/ai/bi/metrics";

// GET /api/ai/metrics — the BI KPI catalog (definitions/formulas) for the copilot.
export async function GET() {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  return NextResponse.json({ ok: true, metrics: METRICS.map((m) => ({ key: m.key, label: m.label, module: m.module, unit: m.unit, goodDirection: m.goodDirection, definition: m.definition, formula: m.formula, improve: m.improve, drilldown: m.drilldown })) });
}
