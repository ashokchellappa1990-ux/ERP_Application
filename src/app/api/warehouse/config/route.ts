import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { listWarehouses } from "@/lib/warehouse/api";

/** GET /api/warehouse/config — warehouse branches + their configuration status. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  return NextResponse.json({ ok: true, rows: await listWarehouses(await getActiveScope(user)) });
}
