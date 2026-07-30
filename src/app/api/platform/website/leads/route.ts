import { NextResponse } from "next/server";
import { platformAuth, isResponse } from "@/lib/platform/apiGuard";
import { listLeads, setLeadStatus } from "@/lib/website/service";

/** GET — website leads for the Product Admin CMS. */
export async function GET(req: Request) {
  const auth = await platformAuth("settings");
  if (isResponse(auth)) return auth;
  const url = new URL(req.url);
  const rows = await listLeads({ type: url.searchParams.get("type") || undefined, status: url.searchParams.get("status") || undefined });
  return NextResponse.json({ ok: true, rows });
}

/** POST — update a lead's status. */
export async function POST(req: Request) {
  const auth = await platformAuth("settings");
  if (isResponse(auth)) return auth;
  let body: { id?: number; status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  if (!body.id || !body.status) return NextResponse.json({ ok: false, message: "id and status required." }, { status: 422 });
  try { await setLeadStatus(Number(body.id), String(body.status)); return NextResponse.json({ ok: true, message: "Lead updated." }); }
  catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 422 }); }
}
