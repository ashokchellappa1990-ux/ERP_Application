import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { getTransitPassWalletLedger } from "@/lib/transport/transitPassWallet";

// GET /api/transport/transit-pass-wallet — running statement of Transit Pass
// paid to suppliers (GRN) vs. recovered from customers (Load & Dispatch).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "transport.transit-pass-wallet");
  if (denied) return denied;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const data = await getTransitPassWalletLedger(user, { from, to });
  return NextResponse.json({ ok: true, data });
}
