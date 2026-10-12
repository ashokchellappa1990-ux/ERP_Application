import { NextResponse } from "next/server";
import { currentAiActor } from "@/lib/ai/actor";
import { listActions } from "@/lib/ai/command/actions";

// GET /api/ai/actions — AI Action History (audit of the command center).
export async function GET() {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  return NextResponse.json({ ok: true, actions: await listActions(user) });
}
