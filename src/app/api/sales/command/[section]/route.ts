import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { readFilters, filterOptions, roleTabs } from "@/lib/sales/dashboard/filters";
import * as svc from "@/lib/sales/dashboard/service";
import * as ai from "@/lib/sales/dashboard/ai";
import { drillSales } from "@/lib/sales/dashboard/drill";

/** GET /api/sales/command/[section] — lazy per-section data for the Sales Command Center. */
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales");
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const f = readFilters(new URL(req.url));
  try {
    switch (params.section) {
      case "filters": return NextResponse.json({ ok: true, options: await filterOptions(scope), role: user.role ?? null, tabs: roleTabs(user.role) });
      case "kpis": return NextResponse.json({ ok: true, kpis: await svc.executiveKpis(scope, f) });
      case "scorecard": return NextResponse.json({ ok: true, ...(await svc.scorecard(scope, f)) });
      case "trend": return NextResponse.json({ ok: true, ...(await svc.trend(scope, f)) });
      case "top-branches": return NextResponse.json({ ok: true, ...(await svc.topBranches(scope, f)) });
      case "top-executives": return NextResponse.json({ ok: true, ...(await svc.topExecutives(scope, f)) });
      case "recent": return NextResponse.json({ ok: true, ...(await svc.recentActivity(scope, f)) });
      case "products": return NextResponse.json({ ok: true, ...(await svc.productPerformance(scope, f)) });
      case "mix": return NextResponse.json({ ok: true, ...(await svc.mix(scope, f)) });
      case "returns": return NextResponse.json({ ok: true, ...(await svc.returnAnalysis(scope, f)) });
      case "customers": return NextResponse.json({ ok: true, ...(await svc.customerAnalytics(scope, f)) });
      case "analytics": return NextResponse.json({ ok: true, ...(await svc.analytics(scope, f)) });
      case "ai-insights": return NextResponse.json({ ok: true, insights: await ai.salesInsights(scope, f) });
      case "ai-risk": return NextResponse.json({ ok: true, risks: await ai.salesRisks(scope, f) });
      case "ai-recommendations": return NextResponse.json({ ok: true, recommendations: await ai.salesRecommendations(scope, f) });
      case "ai-forecast": return NextResponse.json({ ok: true, forecasts: await ai.salesForecast(scope, f) });
      case "drill": { const u = new URL(req.url); return NextResponse.json({ ok: true, ...(await drillSales(scope, f, u.searchParams.get("widget") || "", u.searchParams.get("key") || undefined)) }); }
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (e) {
    console.error(`[sales/command/${params.section}]`, e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}
