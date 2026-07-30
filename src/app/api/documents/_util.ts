import { NextResponse } from "next/server";
import { currentAiContext } from "@/lib/ai/actor";
import { requirePermission } from "@/lib/auth/guard";
import type { AiActor } from "@/lib/ai/types";
import type { ActiveScope } from "@/lib/auth/scope";

/**
 * Shared auth + RBAC gate for the Document Intelligence APIs. Resolves the signed-in
 * user + active scope, then enforces the permission key. Returns either a ready 401/403
 * response or the {actor, scope} context. Every document route funnels through this.
 */
export async function guardDoc(req: Request, key = "ai.knowledge", entity = "Document"): Promise<{ actor: AiActor; scope: ActiveScope } | { error: NextResponse }> {
  const ctx = await currentAiContext();
  if (!ctx) return { error: NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 }) };
  const denied = await requirePermission(ctx.actor, key, { req, entity });
  if (denied) return { error: denied };
  return ctx;
}

export const bad = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });
export const ok = (data: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...data });
