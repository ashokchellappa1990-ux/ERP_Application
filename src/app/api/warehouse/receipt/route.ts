import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { receiptInput } from "@/lib/contracts/stockReceipt";
import { listReceipts, createReceipt } from "@/lib/warehouse/receipt";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const u = new URL(req.url);
  const rows = await listReceipts(await getActiveScope(user), { q: u.searchParams.get("q") || undefined, from: u.searchParams.get("from") || undefined, to: u.searchParams.get("to") || undefined, status: u.searchParams.get("status") || undefined, history: u.searchParams.get("history") === "1" });
  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  try { const input = receiptInput.parse(await req.json()); const res = await createReceipt(await getActiveScope(user), user, input); return NextResponse.json({ ok: true, ...res }); }
  catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}
