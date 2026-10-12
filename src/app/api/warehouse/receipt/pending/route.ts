import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { listPendingDispatches } from "@/lib/warehouse/receipt";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const rows = await listPendingDispatches(await getActiveScope(user), new URL(req.url).searchParams.get("q") || undefined);
  return NextResponse.json({ ok: true, rows });
}
