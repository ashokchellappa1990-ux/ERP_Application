import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { categoryInput } from "@/lib/contracts/warehouse";
import { listCategories, saveCategory } from "@/lib/warehouse/api";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  return NextResponse.json({ ok: true, categories: await listCategories(await getActiveScope(user), true) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  try { const input = categoryInput.parse(await req.json()); const id = await saveCategory(await getActiveScope(user), user, input); return NextResponse.json({ ok: true, id }); }
  catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}
