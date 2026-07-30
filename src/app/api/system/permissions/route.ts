import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { permissionsByModule } from "@/lib/auth/permissions";

// GET /api/system/permissions — the permission catalog grouped by module.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  return NextResponse.json({ ok: true, groups: permissionsByModule() });
}
