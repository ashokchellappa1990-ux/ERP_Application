import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { loadRequestForDispatch } from "@/lib/warehouse/dispatch";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const requestId = Number(new URL(req.url).searchParams.get("requestId"));
  if (!requestId) return NextResponse.json({ ok: false, message: "requestId required." }, { status: 400 });
  try { const res = await loadRequestForDispatch(await getActiveScope(user), requestId); return NextResponse.json({ ok: true, ...res }); }
  catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}
