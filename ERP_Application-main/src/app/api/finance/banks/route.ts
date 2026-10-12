import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { listBanksForScope } from "@/lib/finance/bank";

/** GET /api/finance/banks — branch-scoped bank accounts (setup_banks) for the payment/receipt pickers. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const [scope, allowed] = await Promise.all([getActiveScope(user), getAllowedScope(user)]);
  return NextResponse.json({ ok: true, banks: await listBanksForScope(scope, allowed) });
}
