import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { validateDispatch } from "@/lib/warehouse/dispatch";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  try { const res = await validateDispatch(await getActiveScope(user), Number(params.id)); return NextResponse.json({ ok: true, valid: res.ok, errors: res.errors }); }
  catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}
