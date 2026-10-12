import { NextResponse } from "next/server";
import { z } from "zod";
import { currentAiActor } from "@/lib/ai/actor";
import { listPrompts, listCategories, createPrompt } from "@/lib/ai/promptLibrary";

// GET /api/ai/prompts?category=&q=&fav=1  — list prompts + categories
export async function GET(req: Request) {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const url = new URL(req.url);
  const [prompts, categories] = await Promise.all([
    listPrompts(user, { category: url.searchParams.get("category") || undefined, q: url.searchParams.get("q") || undefined, favouritesOnly: url.searchParams.get("fav") === "1" }),
    listCategories(user.tenantId),
  ]);
  return NextResponse.json({ ok: true, prompts, categories });
}

const CreateSchema = z.object({ category: z.string().min(1), title: z.string().min(1).max(200), promptText: z.string().min(1).max(4000), description: z.string().max(300).optional(), shared: z.boolean().optional() });

// POST /api/ai/prompts — create a user prompt
export async function POST(req: Request) {
  const user = await currentAiActor();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid." }, { status: 422 });
  const p = await createPrompt(user, parsed.data);
  return NextResponse.json({ ok: true, id: p.id, message: "Prompt saved." }, { status: 201 });
}
