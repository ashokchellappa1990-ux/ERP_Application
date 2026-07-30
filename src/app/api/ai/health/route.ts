import { NextResponse } from "next/server";
import { currentAiActor } from "@/lib/ai/actor";
import { aiHealth } from "@/lib/ai/health";

// GET /api/ai/health?ping=1
export async function GET(req: Request) {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const ping = new URL(req.url).searchParams.get("ping") === "1";
  return NextResponse.json({ ok: true, health: await aiHealth(user.tenantId, ping) });
}
