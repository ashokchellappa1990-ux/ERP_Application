import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { listAvailableAdvances } from "@/lib/advance/engine";
import { guardAnyAdvanceUse } from "./_guard";

// GET /api/finance/advance/available?partyType=Customer&partyId=123 — open advances
// (with a balance) for a party, for the invoice/expense adjustment popups.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await guardAnyAdvanceUse(user))) return NextResponse.json({ ok: false, message: "Not permitted." }, { status: 403 });
  const url = new URL(req.url);
  const partyType = (url.searchParams.get("partyType") ?? "Customer").trim();
  const partyId = Number(url.searchParams.get("partyId")) || null;
  const scope = await getActiveScope(user);
  const rows = await listAvailableAdvances(user.tenantId, scope.businessId ?? null, partyType, partyId);
  return NextResponse.json({ ok: true, rows: rows.map((a) => ({ id: a.id, advanceNo: a.advanceNo, advanceDate: a.advanceDate, advanceTypeName: a.advanceTypeName ?? "", balance: Number(a.balanceAmount), accountCode: a.accountCode ?? "" })) });
}
