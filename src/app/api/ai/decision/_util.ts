import { NextResponse } from "next/server";
import { currentAiContext } from "@/lib/ai/actor";
import { requirePermission } from "@/lib/auth/guard";
import type { AiActor } from "@/lib/ai/types";
import type { ActiveScope } from "@/lib/auth/scope";

/** Shared auth + RBAC gate for the Decision Intelligence APIs (one permission key). */
export async function guardDecision(req: Request, entity = "AiDecision"): Promise<{ actor: AiActor; scope: ActiveScope } | { error: NextResponse }> {
  const ctx = await currentAiContext();
  if (!ctx) return { error: NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 }) };
  const denied = await requirePermission(ctx.actor, "intelligence.decision", { req, entity });
  if (denied) return { error: denied };
  return ctx;
}
export const bad = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });
export const ok = (data: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...data });

/** Parse period + horizon query params shared across GET routes. */
export function readParams(req: Request) {
  const u = new URL(req.url);
  const period = u.searchParams.get("period") || undefined;
  const horizonDays = u.searchParams.get("horizon") ? Number(u.searchParams.get("horizon")) : undefined;
  return { period, horizonDays, url: u };
}
