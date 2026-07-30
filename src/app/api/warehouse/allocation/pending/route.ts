import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { listPendingRequests } from "@/lib/warehouse/allocation";

// GET /api/warehouse/allocation/pending — Approved transfer requests awaiting allocation.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const rows = await listPendingRequests(await getActiveScope(user));
  return NextResponse.json({ ok: true, rows });
}
