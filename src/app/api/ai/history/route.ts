import { NextResponse } from "next/server";
import { currentAiActor } from "@/lib/ai/actor";
import { listConversations, getConversation } from "@/lib/ai/conversationManager";

// GET /api/ai/history?id= | ?q=&pinned=&category=
export async function GET(req: Request) {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const conv = await getConversation(user, Number(id));
    if (!conv) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, conversation: conv });
  }
  const conversations = await listConversations(user, {
    q: url.searchParams.get("q") || undefined,
    pinned: url.searchParams.get("pinned") === "1",
    category: url.searchParams.get("category") || undefined,
  });
  return NextResponse.json({ ok: true, conversations });
}
