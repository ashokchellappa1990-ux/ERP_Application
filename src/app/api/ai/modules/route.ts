import { NextResponse } from "next/server";
import { currentAiActor } from "@/lib/ai/actor";
import { listModules } from "@/lib/ai/moduleRegistry";
import { allowedModules } from "@/lib/ai/permissionEngine";

// GET /api/ai/modules — the AI-enabled modules this user may query (registry, filtered).
export async function GET() {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const all = await listModules(user.tenantId);
  const permitted = await allowedModules(user, all);
  return NextResponse.json({ ok: true, modules: permitted.map((m) => ({ moduleKey: m.moduleKey, name: m.name, description: m.description, menu: m.menu, kpis: m.kpis, questions: m.questions, businessTerms: m.businessTerms })), total: permitted.length });
}
