import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requestMeta } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { currentAiContext } from "@/lib/ai/actor";
import { ask } from "@/lib/ai/orchestrator";
import { bumpUsage } from "@/lib/ai/promptLibrary";

// POST /api/ai/chat — { message, conversationId?, promptId? }
export async function POST(req: Request) {
  const ctx = await currentAiContext();
  if (!ctx) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const { actor: user, scope } = ctx;
  let body: { message?: string; conversationId?: number; promptId?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ ok: false, message: "Enter a question." }, { status: 422 });

  try {
    if (body.promptId) await bumpUsage(Number(body.promptId));
    const res = await ask(user, { message, conversationId: body.conversationId ? Number(body.conversationId) : undefined }, scope);
    await writeAudit(prisma, { id: user.id, tenantId: user.tenantId, fullName: user.fullName }, {
      action: "ai_copilot.chat", entity: "AiMessage", entityId: res.assistantMessageId,
      summary: `AI ${res.category} — ${message.slice(0, 60)}`, meta: { conversationId: res.conversationId, status: res.status, model: res.model, latencyMs: res.latencyMs, tokensOut: res.tokensOut },
      businessId: user.businessId ?? null, branchId: user.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    console.error("[ai/chat]", err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Could not process the request." }, { status: 500 });
  }
}
