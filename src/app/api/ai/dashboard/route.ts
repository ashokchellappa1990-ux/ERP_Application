import { NextResponse } from "next/server";
import { currentAiActor } from "@/lib/ai/actor";
import { aiDashboard } from "@/lib/ai/dashboard";

// GET /api/ai/dashboard — AI usage analytics for the tenant.
export async function GET() {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  return NextResponse.json({ ok: true, data: await aiDashboard(user.tenantId) });
}
