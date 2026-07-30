import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { promoAllowed } from "@/lib/promo/guard";
import * as svc from "@/lib/promo/service";
import { REPORT_TYPES, type ReportType } from "@/lib/contracts/promo";

// GET /api/promo/[section]?campaignId=&status=&q=&channel=&report=&from=&to=
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await promoAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for the promo module." }, { status: 403 });

  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const url = new URL(req.url);
  const campaignId = Number(url.searchParams.get("campaignId")) || undefined;
  const status = url.searchParams.get("status") ?? "All";
  const channel = url.searchParams.get("channel") ?? "All";
  const q = (url.searchParams.get("q") ?? "").trim();

  try {
    switch (params.section) {
      case "config": return NextResponse.json({ ok: true, config: await svc.getConfig(s) });
      case "meta": return NextResponse.json({ ok: true, config: await svc.getConfig(s), accounts: await svc.listAccounts(s) });
      case "campaigns": return NextResponse.json({ ok: true, rows: await svc.listCampaigns(s, { status, q }), config: await svc.getConfig(s), accounts: await svc.listAccounts(s) });
      case "rules": return NextResponse.json({ ok: true, rows: campaignId ? await svc.listRules(s, campaignId) : [] });
      case "codes": return NextResponse.json({ ok: true, rows: await svc.listCodes(s, { campaignId, status, q }) });
      case "distributions": return NextResponse.json({ ok: true, rows: await svc.listDistributions(s, { campaignId, channel }) });
      case "customerGroups": return NextResponse.json({ ok: true, groups: await svc.listCustomerGroups(s) });
      case "audience": {
        const audience = url.searchParams.get("audience") ?? "All";
        const groupValue = url.searchParams.get("groupValue") ?? undefined;
        const highValueMin = Number(url.searchParams.get("highValueMin")) || undefined;
        const customerIds = (url.searchParams.get("customerIds") ?? "").split(",").map(Number).filter((n) => n > 0);
        return NextResponse.json({ ok: true, data: await svc.previewAudience(s, { audience, groupValue, highValueMin, customerIds }) });
      }
      case "dashboard": return NextResponse.json({ ok: true, data: await svc.getDashboard(s) });
      case "report": {
        const rt = (url.searchParams.get("report") ?? "register") as ReportType;
        if (!REPORT_TYPES.includes(rt)) return NextResponse.json({ ok: false, message: "Unknown report." }, { status: 400 });
        const from = (url.searchParams.get("from") ?? "").trim() || undefined;
        const to = (url.searchParams.get("to") ?? "").trim() || undefined;
        return NextResponse.json({ ok: true, data: await svc.getReport(s, rt, { campaignId, from, to }) });
      }
      case "audit": return NextResponse.json({ ok: true, rows: await svc.listAudit(s) });
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error(`[promo] ${params.section} error`, err);
    return NextResponse.json({ ok: false, message: "Could not load this section." }, { status: 500 });
  }
}
