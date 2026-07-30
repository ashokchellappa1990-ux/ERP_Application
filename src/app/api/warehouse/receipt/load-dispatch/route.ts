import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { loadDispatchForReceipt } from "@/lib/warehouse/receipt";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const dispatchId = Number(new URL(req.url).searchParams.get("dispatchId"));
  if (!dispatchId) return NextResponse.json({ ok: false, message: "dispatchId required." }, { status: 400 });
  try { const res = await loadDispatchForReceipt(await getActiveScope(user), dispatchId); return NextResponse.json({ ok: true, ...res }); }
  catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}
