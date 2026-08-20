import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { syncTyreNotifications } from "@/lib/transport/tyreAlerts";

const PERM = "transport.tyre";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const count = await syncTyreNotifications(scope);
  return NextResponse.json({ ok: true, count });
}
