import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requestMeta } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { currentAiActor } from "@/lib/ai/actor";
import { listDrafts, getDraft, cancelDraft, markSubmitted, draftCounts } from "@/lib/ai/command/drafts";

// GET /api/ai/drafts?status=&id=  — AI Draft Center
export async function GET(req: Request) {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) { const d = await getDraft(user, Number(id)); if (!d) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 }); return NextResponse.json({ ok: true, draft: d }); }
  const [drafts, counts] = await Promise.all([listDrafts(user, url.searchParams.get("status") || undefined), draftCounts(user)]);
  return NextResponse.json({ ok: true, drafts, counts });
}

// POST /api/ai/drafts — { action: "cancel" | "submit", id }
export async function POST(req: Request) {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  let b: { action?: string; id?: number }; try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const id = Number(b.id);
  if (b.action === "cancel") { await cancelDraft(user, id); return NextResponse.json({ ok: true, message: "Draft cancelled." }); }
  if (b.action === "submit") {
    // "Submit" only marks the AI draft as handed off — the REAL transaction is created by
    // the user on the module screen. The AI never posts to the ledger itself.
    await markSubmitted(user, id);
    await writeAudit(prisma, { id: user.id, tenantId: user.tenantId, fullName: user.fullName }, { action: "ai_command.draft.submit", entity: "AiCommandDraft", entityId: id, summary: `AI draft #${id} marked ready to create`, businessId: user.businessId ?? null, branchId: user.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Marked ready — create it in the module." });
  }
  return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
}
