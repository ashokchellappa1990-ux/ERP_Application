import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { readFilters, filterOptions, roleTabs } from "@/lib/purchase/dashboard/filters";
import * as svc from "@/lib/purchase/dashboard/service";
import * as ai from "@/lib/purchase/dashboard/ai";
import { listNotifications, unreadCount } from "@/lib/ai/decision/notify";
import { drillPurchase } from "@/lib/purchase/dashboard/drill";

/** GET /api/purchase/command/[section] — lazy per-section data for the Procurement Command Center. */
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "purchase");
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const f = readFilters(new URL(req.url));
  try {
    switch (params.section) {
      case "filters": return NextResponse.json({ ok: true, options: await filterOptions(scope), role: user.role ?? null, tabs: roleTabs(user.role) });
      case "kpis": return NextResponse.json({ ok: true, kpis: await svc.executiveKpis(scope, f) });
      case "pipeline": return NextResponse.json({ ok: true, ...(await svc.pipeline(scope, f)) });
      case "trend": return NextResponse.json({ ok: true, ...(await svc.trend(scope, f)) });
      case "suppliers": return NextResponse.json({ ok: true, suppliers: await svc.supplierPerformance(scope, f) });
      case "analytics": return NextResponse.json({ ok: true, ...(await svc.analytics(scope, f)) });
      case "delivery": return NextResponse.json({ ok: true, ...(await svc.deliveryMonitor(scope, f)) });
      case "reorder": return NextResponse.json({ ok: true, ...(await svc.reorder(scope, f)) });
      case "budget": return NextResponse.json({ ok: true, ...(await svc.budgetMonitor(scope, f)) });
      case "financial": return NextResponse.json({ ok: true, ...(await svc.financialSummary(scope, f)) });
      case "approvals": return NextResponse.json({ ok: true, ...(await svc.approvals(scope, f)) });
      case "calendar": return NextResponse.json({ ok: true, ...(await svc.calendar(scope, f)) });
      case "scorecard": return NextResponse.json({ ok: true, ...(await svc.scorecard(scope, f)) });
      case "ai-insights": return NextResponse.json({ ok: true, insights: await ai.purchaseInsights(scope, f) });
      case "ai-risk": return NextResponse.json({ ok: true, risks: await ai.purchaseRisks(scope, f) });
      case "ai-recommendations": return NextResponse.json({ ok: true, recommendations: await ai.purchaseRecommendations(scope, f) });
      case "ai-forecast": return NextResponse.json({ ok: true, forecasts: await ai.purchaseForecast(scope, f) });
      case "notifications": return NextResponse.json({ ok: true, notifications: await listNotifications(scope), unread: await unreadCount(scope) });
      case "drill": { const u = new URL(req.url); return NextResponse.json({ ok: true, ...(await drillPurchase(scope, f, u.searchParams.get("widget") || "", u.searchParams.get("key") || undefined)) }); }
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (e) {
    console.error(`[purchase/command/${params.section}]`, e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}
