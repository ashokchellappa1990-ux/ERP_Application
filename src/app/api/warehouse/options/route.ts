import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { listCategories } from "@/lib/warehouse/api";

/** GET /api/warehouse/options — warehouse categories (for the Branch Setup form + config).
 *  Signed-in only (categories aren't sensitive), so branch editors can load it. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  return NextResponse.json({ ok: true, categories: await listCategories(await getActiveScope(user)) });
}
