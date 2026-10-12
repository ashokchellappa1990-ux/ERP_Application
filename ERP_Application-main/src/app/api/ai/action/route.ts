import { NextResponse } from "next/server";
import { currentAiActor } from "@/lib/ai/actor";
import { pinConversation, renameConversation, deleteConversation, saveFeedback } from "@/lib/ai/conversationManager";
import { updatePrompt, deletePrompt, toggleFavourite } from "@/lib/ai/promptLibrary";

// POST /api/ai/action — { action, ...payload }
export async function POST(req: Request) {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  let b: { action?: string } & Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const n = (v: unknown) => Number(v);

  try {
    switch (b.action) {
      case "pin": await pinConversation(user, n(b.id), !!b.pinned); return NextResponse.json({ ok: true });
      case "rename": await renameConversation(user, n(b.id), String(b.title ?? "")); return NextResponse.json({ ok: true });
      case "delete": await deleteConversation(user, n(b.id)); return NextResponse.json({ ok: true, message: "Conversation deleted." });
      case "feedback": await saveFeedback(user, n(b.messageId), b.rating === "up" ? "up" : "down", b.comment ? String(b.comment) : undefined); return NextResponse.json({ ok: true, message: "Thanks for the feedback." });
      case "favourite": { const on = await toggleFavourite(user, n(b.promptId)); return NextResponse.json({ ok: true, favourite: on }); }
      case "updatePrompt": { const ok = await updatePrompt(user, n(b.id), { category: b.category as string, title: b.title as string, promptText: b.promptText as string, description: b.description as string, shared: b.shared as boolean }); return NextResponse.json({ ok, message: ok ? "Prompt updated." : "Not found or not yours." }); }
      case "deletePrompt": { const ok = await deletePrompt(user, n(b.id)); return NextResponse.json({ ok, message: ok ? "Prompt deleted." : "Not found or not yours." }); }
      default: return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    console.error("[ai/action]", b.action, err);
    return NextResponse.json({ ok: false, message: "Action failed." }, { status: 500 });
  }
}
