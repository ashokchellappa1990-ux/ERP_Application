import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { bankBalances, bankBook, clearMovements } from "@/lib/finance/bank";

/** GET/POST /api/finance/bank/[section] — bank balances, per-bank book (filterable), clearing. */
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance"); if (denied) return denied;
  const scope = await getActiveScope(user);
  const u = new URL(req.url);
  try {
    if (params.section === "balances") { const allowed = await getAllowedScope(user); return NextResponse.json({ ok: true, banks: await bankBalances(scope, allowed, u.searchParams.get("period") || undefined) }); }
    if (params.section === "book") {
      const bankId = Number(u.searchParams.get("bankId")); if (!bankId) return NextResponse.json({ ok: false, message: "bankId required." }, { status: 400 });
      const dir = u.searchParams.get("direction"); const direction = dir === "in" || dir === "out" ? dir : undefined;
      return NextResponse.json({ ok: true, ...(await bankBook(scope, bankId, { direction, from: u.searchParams.get("from") || undefined, to: u.searchParams.get("to") || undefined })) });
    }
    return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
  } catch (e) { console.error("[finance/bank]", params.section, e); return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 500 }); }
}

export async function POST(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance"); if (denied) return denied;
  const scope = await getActiveScope(user);
  if (params.section !== "clear") return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
  try {
    const { ids, status, clearingDate, note } = await req.json();
    if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ ok: false, message: "Select at least one transaction." }, { status: 400 });
    if (!["credited", "bounced", "cancelled", "pending"].includes(status)) return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 400 });
    const n = await clearMovements(scope, ids as number[], status, { clearingDate, note, userId: user.id });
    return NextResponse.json({ ok: true, updated: n });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}
