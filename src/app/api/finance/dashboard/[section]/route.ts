import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { executiveDashboard, operationsDashboard, controllerDashboard, dashboardFilters, type DashOpts } from "@/lib/finance/dashboard/service";
import { drillFinance } from "@/lib/finance/dashboard/drill";

const PERM = "finance";
const thisMonth = () => new Date().toISOString().slice(0, 7);

// GET /api/finance/dashboard/<section>?period=&from=&to=&costCenterId=&profitCenterId=
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const url = new URL(req.url);
  const opts: DashOpts = {
    period: url.searchParams.get("period") || thisMonth(),
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    costCenterId: url.searchParams.get("costCenterId") ? Number(url.searchParams.get("costCenterId")) : null,
    profitCenterId: url.searchParams.get("profitCenterId") ? Number(url.searchParams.get("profitCenterId")) : null,
  };

  try {
    const section = params.section;
    if (section === "filters") return NextResponse.json({ ok: true, data: await dashboardFilters(scope) });
    if (section === "executive") {
      const allowed = await getAllowedScope(user);
      const branches = allowed.branches.filter((b) => b.businessId === scope.businessId).map((b) => ({ id: b.id, name: b.name }));
      return NextResponse.json({ ok: true, data: await executiveDashboard(scope, opts, branches) });
    }
    if (section === "operations") return NextResponse.json({ ok: true, data: await operationsDashboard(scope, opts) });
    if (section === "controller") return NextResponse.json({ ok: true, data: await controllerDashboard(scope, opts) });
    if (section === "drill") return NextResponse.json({ ok: true, ...(await drillFinance(scope, opts, url.searchParams.get("widget") || "")) });
    return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
  } catch (err) {
    console.error("[finance-dashboard]", params.section, err);
    return NextResponse.json({ ok: false, message: "Could not load the dashboard." }, { status: 500 });
  }
}
