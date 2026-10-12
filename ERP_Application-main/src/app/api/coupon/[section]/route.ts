import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { couponAllowed } from "@/lib/coupon/guard";
import * as svc from "@/lib/coupon/service";

// GET /api/coupon/[section]?campaignId=&status=&q=
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await couponAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for the coupon module." }, { status: 403 });

  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const url = new URL(req.url);
  const campaignId = Number(url.searchParams.get("campaignId")) || undefined;
  const status = url.searchParams.get("status") ?? "All";
  const q = (url.searchParams.get("q") ?? "").trim();

  try {
    switch (params.section) {
      case "config": return NextResponse.json({ ok: true, config: await svc.getConfig(s) });
      case "meta": return NextResponse.json({ ok: true, config: await svc.getConfig(s), accounts: await svc.listAccounts(s) });
      case "campaigns": return NextResponse.json({ ok: true, rows: await svc.listCampaigns(s, { status, q }), config: await svc.getConfig(s), accounts: await svc.listAccounts(s) });
      case "rules": return NextResponse.json({ ok: true, rows: campaignId ? await svc.listRules(s, campaignId) : [] });
      case "coupons": return NextResponse.json({ ok: true, rows: await svc.listCoupons(s, { campaignId, status, q }) });
      case "templates": return NextResponse.json({ ok: true, rows: await svc.listTemplates(s) });
      case "dashboard": return NextResponse.json({ ok: true, data: await svc.getDashboard(s) });
      case "audit": return NextResponse.json({ ok: true, rows: await svc.listAudit(s) });
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error(`[coupon] ${params.section} error`, err);
    return NextResponse.json({ ok: false, message: "Could not load this section." }, { status: 500 });
  }
}
