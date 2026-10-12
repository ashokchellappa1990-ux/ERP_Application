import { NextResponse } from "next/server";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";

/**
 * GET /api/pos/client-ip — the IP address the server sees for THIS request, so the
 * Add-Terminal form can pre-fill the IP when registering from the terminal itself.
 * Note: a MAC address cannot be read from a web browser — it requires a native
 * device agent / mobile app, so it stays a manual field.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "pos.terminals");
  if (denied) return denied;
  return NextResponse.json({ ok: true, ip: requestMeta(req).ip });
}
