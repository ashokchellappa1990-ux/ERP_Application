import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { dispatchInput } from "@/lib/contracts/stockDispatch";
import { listDispatches, createDispatch } from "@/lib/warehouse/dispatch";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const u = new URL(req.url);
  const rows = await listDispatches(await getActiveScope(user), { q: u.searchParams.get("q") || undefined, from: u.searchParams.get("from") || undefined, to: u.searchParams.get("to") || undefined, status: u.searchParams.get("status") || undefined, type: u.searchParams.get("type") || undefined, history: u.searchParams.get("history") === "1" });
  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  try { const input = dispatchInput.parse(await req.json()); const res = await createDispatch(await getActiveScope(user), user, input); return NextResponse.json({ ok: true, ...res }); }
  catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}
