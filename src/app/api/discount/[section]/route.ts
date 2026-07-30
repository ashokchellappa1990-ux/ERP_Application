import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { discountAllowed } from "@/lib/discount/guard";
import { DISCOUNT_TYPES, DISCOUNT_CATEGORIES, CHANNELS, PAYMENT_MODES, PRIORITY_CHAIN } from "@/lib/contracts/discount";
import * as svc from "@/lib/discount/service";

// GET /api/discount/[section]?id=&status=&q=&type=
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await discountAllowed(user))) return NextResponse.json({ ok: false, message: "No permission." }, { status: 403 });

  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id")) || 0;
  const status = url.searchParams.get("status") ?? "All";
  const type = url.searchParams.get("type") ?? "All";
  const q = (url.searchParams.get("q") ?? "").trim();

  try {
    switch (params.section) {
      case "dashboard": return NextResponse.json({ ok: true, ...(await svc.dashboard(s)) });
      case "list": return NextResponse.json({ ok: true, rows: await svc.listDiscounts(s, { status, q, type }) });
      case "detail": return NextResponse.json({ ok: true, discount: id ? await svc.getDiscount(s, id) : null });
      case "config": return NextResponse.json({ ok: true, config: await svc.getConfig(s), accounts: svc.DISCOUNT_ACCOUNTS });
      case "meta": return NextResponse.json({ ok: true, types: DISCOUNT_TYPES, categories: DISCOUNT_CATEGORIES, channels: CHANNELS, paymentModes: PAYMENT_MODES, priorityChain: PRIORITY_CHAIN, accounts: svc.DISCOUNT_ACCOUNTS });
      case "options": return NextResponse.json({ ok: true, ...(await svc.listMasterOptions(s)) });
      case "usage": return NextResponse.json({ ok: true, rows: await svc.listUsage(s, { q }) });
      case "audit": return NextResponse.json({ ok: true, rows: await svc.listAudit(s) });
      case "analytics": return NextResponse.json({ ok: true, ...(await svc.analytics(s)) });
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error(`[discount] ${params.section} error`, err);
    return NextResponse.json({ ok: false, message: "Could not load." }, { status: 500 });
  }
}
