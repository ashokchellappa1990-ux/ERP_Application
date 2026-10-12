import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import * as svc from "@/lib/inventory/dashboard/service";
import { inventoryInsights } from "@/lib/inventory/dashboard/ai";
import { drillInventory } from "@/lib/inventory/dashboard/drill";

/** GET /api/inventory/dashboard/[section] — lazy per-section data for the Inventory Dashboard. */
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "inventory");
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const url = new URL(req.url);
  const f = svc.readInvFilters(url);
  try {
    switch (params.section) {
      case "filters": return NextResponse.json({ ok: true, options: await svc.filterOptions(scope) });
      case "kpis": return NextResponse.json({ ok: true, kpis: await svc.executiveKpis(scope, f) });
      case "health": return NextResponse.json({ ok: true, ...(await svc.stockHealth(scope, f)) });
      case "operational": return NextResponse.json({ ok: true, ...(await svc.operational(scope, f)) });
      case "movement": return NextResponse.json({ ok: true, ...(await svc.movement(scope, f)) });
      case "analytics": return NextResponse.json({ ok: true, ...(await svc.analytics(scope, f)) });
      case "ai-insights": return NextResponse.json({ ok: true, insights: await inventoryInsights(scope, f) });
      case "drill": return NextResponse.json({ ok: true, ...(await drillInventory(scope, f, url.searchParams.get("widget") || "")) });
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (e) {
    console.error(`[inventory/dashboard/${params.section}]`, e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}
