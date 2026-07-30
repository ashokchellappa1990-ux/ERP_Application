import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { getUserPermissions } from "@/lib/auth/rbac";
import { getActiveScope } from "@/lib/auth/scope";
import { buildAccess } from "@/lib/dashboard/access";
import { getPeriods } from "@/lib/dashboard/period";
import * as svc from "@/lib/dashboard/service";
import type { DashCtx } from "@/lib/dashboard/service";

/**
 * Lazy, independently-refreshable dashboard sections.
 *   GET /api/dashboard/<section>[?q=]
 * Every user with the "dashboard" permission can call these; each builder is
 * itself capability-gated and tenant/business/branch-scoped, so the response
 * only ever contains data the caller is authorised to see.
 */

const SECTIONS = new Set(["header", "kpis", "charts", "health", "pending", "notifications", "insights", "activity", "search", "detail"]);

export async function GET(req: Request, { params }: { params: { section: string } }) {
  const section = params.section;
  if (!SECTIONS.has(section)) return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "dashboard");
  if (denied) return denied;

  try {
    const [scope, perms] = await Promise.all([getActiveScope(user), getUserPermissions(user)]);
    const [tenant, gs] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { moduleLoyalty: true, modulePharmacy: true, moduleEcommerce: true } }),
      prisma.generalSetting.findFirst({ where: { tenantId: user.tenantId, ...(scope.businessId ? { businessId: scope.businessId } : {}) }, select: { fiscalYearStart: true, timezone: true } }),
    ]);
    const access = buildAccess(perms, tenant ?? {});

    // Fiscal-year start + timezone come from the tenant's general settings.
    const periods = getPeriods(gs?.fiscalYearStart ?? "April", gs?.timezone ?? "Asia/Kolkata");
    const ctx: DashCtx = { scope, access, periods };

    switch (section) {
      case "header": {
        const roleName = await resolveRoleName(user);
        return NextResponse.json({ ok: true, data: await svc.getHeader(ctx, { userName: user.fullName ?? "User", roleName }) });
      }
      case "kpis": return NextResponse.json({ ok: true, data: await svc.getKpis(ctx) });
      case "charts": return NextResponse.json({ ok: true, data: await svc.getCharts(ctx) });
      case "health": return NextResponse.json({ ok: true, data: await svc.getHealth(ctx) });
      case "pending": return NextResponse.json({ ok: true, data: await svc.getPending(ctx) });
      case "notifications": return NextResponse.json({ ok: true, data: await svc.getNotifications(ctx) });
      case "insights": return NextResponse.json({ ok: true, data: await svc.getInsights(ctx) });
      case "activity": return NextResponse.json({ ok: true, data: await svc.getActivity(ctx) });
      case "search": {
        const q = new URL(req.url).searchParams.get("q") ?? "";
        return NextResponse.json({ ok: true, data: await svc.getSearch(ctx, q) });
      }
      case "detail": {
        const key = new URL(req.url).searchParams.get("key") ?? "";
        const detail = await svc.getKpiDetail(ctx, key);
        if (!detail) return NextResponse.json({ ok: false, message: "No detail for this metric." }, { status: 404 });
        return NextResponse.json({ ok: true, data: detail });
      }
    }
    return NextResponse.json({ ok: false, message: "Unhandled." }, { status: 500 });
  } catch (err) {
    console.error(`[dashboard/${section}]`, err);
    return NextResponse.json({ ok: false, message: "Failed to load dashboard section." }, { status: 500 });
  }
}

async function resolveRoleName(user: { roleId?: number | null; role?: string | null }): Promise<string> {
  if (user.roleId) {
    const r = await prisma.role.findUnique({ where: { id: user.roleId }, select: { name: true } });
    if (r?.name) return r.name;
  }
  const legacy = (user.role ?? "").replace(/[-_]/g, " ").trim();
  return legacy ? legacy.replace(/\b\w/g, (c) => c.toUpperCase()) : "User";
}
