import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, type ActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { fyFromDate } from "@/lib/finance/budgetService";
import {
  targetCreateInput, targetActionInput, revisionCreateInput, revisionActionInput,
  DIMENSIONS, TARGET_TYPES, PERIODS, DISTRIBUTIONS, DEFAULT_TARGET_CONFIG,
} from "@/lib/contracts/salesTarget";
import {
  getConfig, saveConfig, listTargets, createTarget, updateTarget, targetAction,
  createRevision, revisionAction, computeAchievement, performanceAnalysis, buildLineMonths,
} from "./engine";
import { targetInsights } from "./ai";
import { syncTargetNotifications } from "./notify";

/** Thin auth wrapper — every Sales-Target endpoint is scoped + gated by `sales.target`. */
type Ctx = { user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>; scope: ActiveScope };
async function auth(): Promise<Ctx | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.target");
  if (denied) return denied;
  return { user, scope: await getActiveScope(user) };
}
const bad = (e: unknown) => NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 });

/* ------------------------------------------------------------ list/create */
export async function listHandler(req: Request) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  const u = new URL(req.url);
  const rows = await listTargets(c.scope, { fy: u.searchParams.get("fy") || undefined, status: u.searchParams.get("status") || undefined, dimension: u.searchParams.get("dimension") || undefined, targetType: u.searchParams.get("targetType") || undefined, q: u.searchParams.get("q") || undefined });
  return NextResponse.json({ ok: true, rows });
}
export async function createHandler(req: Request) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  try {
    const input = targetCreateInput.parse(await req.json());
    const t = await createTarget(c.scope, c.user, input);
    return NextResponse.json({ ok: true, id: t.id, targetNo: t.targetNo });
  } catch (e) { return bad(e); }
}

/* ------------------------------------------------------------- one target */
export async function getHandler(_req: Request, id: number) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  const t = await prisma.salesTarget.findFirst({ where: { id, tenantId: c.scope.tenantId }, include: { lines: true, revisions: { orderBy: { id: "desc" } }, approvals: { orderBy: { id: "desc" } } } });
  if (!t) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, target: t });
}
export async function updateHandler(req: Request, id: number) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  try { const input = targetCreateInput.parse(await req.json()); const t = await updateTarget(c.scope, c.user, id, input); return NextResponse.json({ ok: true, id: t.id }); } catch (e) { return bad(e); }
}
export async function deleteHandler(_req: Request, id: number) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  const t = await prisma.salesTarget.findFirst({ where: { id, tenantId: c.scope.tenantId } });
  if (!t) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (t.status !== "Draft") return NextResponse.json({ ok: false, message: "Only Draft targets can be deleted." }, { status: 400 });
  await prisma.salesTarget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
export async function actionHandler(req: Request, id: number) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  try {
    const { action, remarks } = targetActionInput.parse(await req.json());
    const t = await targetAction(c.scope, c.user, id, action, remarks);
    syncTargetNotifications(c.scope).catch(() => {});
    return NextResponse.json({ ok: true, status: t.status, approvalStatus: t.approvalStatus });
  } catch (e) { return bad(e); }
}
export async function achievementHandler(_req: Request, id: number) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  try { return NextResponse.json({ ok: true, achievement: await computeAchievement(c.scope, id) }); } catch (e) { return bad(e); }
}

/* -------------------------------------------------------------- revisions */
export async function revisionsHandler(req: Request, id?: number) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  const where: Prisma.SalesTargetRevisionWhereInput = { tenantId: c.scope.tenantId };
  if (id) where.targetId = id;
  const status = new URL(req.url).searchParams.get("status");
  if (status && status !== "All") where.status = status;
  const rows = await prisma.salesTargetRevision.findMany({ where, orderBy: { id: "desc" }, take: 200, include: { target: { select: { targetNo: true, dimension: true, targetType: true, fy: true } } } });
  return NextResponse.json({ ok: true, rows });
}
export async function createRevisionHandler(req: Request, id: number) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  try { const input = revisionCreateInput.parse(await req.json()); const r = await createRevision(c.scope, c.user, id, input); syncTargetNotifications(c.scope).catch(() => {}); return NextResponse.json({ ok: true, id: r.id, revisionNo: r.revisionNo }); } catch (e) { return bad(e); }
}
export async function revisionActionHandler(req: Request, rid: number) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  try { const { action, remarks } = revisionActionInput.parse(await req.json()); const r = await revisionAction(c.scope, c.user, rid, action, remarks); return NextResponse.json({ ok: true, status: r.status }); } catch (e) { return bad(e); }
}

/* ---------------------------------------------------------------- config */
export async function configHandler(req: Request) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  if (req.method === "PUT") { try { const patch = await req.json(); const cfg = await saveConfig(c.scope, patch); return NextResponse.json({ ok: true, config: cfg }); } catch (e) { return bad(e); } }
  return NextResponse.json({ ok: true, config: await getConfig(c.scope), defaults: DEFAULT_TARGET_CONFIG });
}

/* ------------------------------------------------------ performance / ai */
export async function performanceHandler(req: Request) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  const u = new URL(req.url);
  const fy = u.searchParams.get("fy") || fyFromDate(new Date().toISOString().slice(0, 10));
  const persist = u.searchParams.get("persist") === "1";
  return NextResponse.json({ ok: true, ...(await performanceAnalysis(c.scope, fy, { dimension: u.searchParams.get("dimension") || undefined, persist })) });
}
export async function aiHandler(req: Request) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  const fy = new URL(req.url).searchParams.get("fy") || fyFromDate(new Date().toISOString().slice(0, 10));
  return NextResponse.json({ ok: true, insights: await targetInsights(c.scope, fy) });
}

/* --------------------------------------------------- pickers / distribute */
export async function optionsHandler(_req: Request) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  const scope = c.scope;
  const bw = scopeWhere(scope, { branch: true });
  const branchW: Prisma.BranchWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}), ...(scope.readBranchIds?.length ? { id: { in: scope.readBranchIds } } : {}) };
  const [branches, users, customers, prodCats, brands, custCats, costCentres, profitCentres] = await Promise.all([
    prisma.branch.findMany({ where: branchW, select: { id: true, name: true, code: true, parentBranchId: true, hierarchyLevel: true, state: true, city: true }, orderBy: { hierarchyLevel: "asc" }, take: 500 }),
    prisma.user.findMany({ where: { tenantId: scope.tenantId }, select: { id: true, fullName: true }, take: 500 }),
    prisma.customer.findMany({ where: { ...(bw as Prisma.CustomerWhereInput) }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.product.findMany({ where: { tenantId: scope.tenantId, category: { not: null } }, select: { category: true }, distinct: ["category"], take: 300 }),
    prisma.product.findMany({ where: { tenantId: scope.tenantId, brand: { not: null } }, select: { brand: true }, distinct: ["brand"], take: 300 }),
    prisma.customer.findMany({ where: { ...(bw as Prisma.CustomerWhereInput), category: { not: null } }, select: { category: true }, distinct: ["category"], take: 200 }),
    prisma.costCentre.findMany({ where: { tenantId: scope.tenantId, status: "Active" }, select: { id: true, name: true, code: true }, take: 300 }).catch(() => []),
    prisma.profitCentre.findMany({ where: { tenantId: scope.tenantId, status: "Active" }, select: { id: true, name: true, code: true }, take: 300 }).catch(() => []),
  ]);
  const states = [...new Set(branches.map((b) => b.state).filter((x): x is string => !!x))];
  const cities = [...new Set(branches.map((b) => b.city).filter((x): x is string => !!x))];
  const thisFy = fyFromDate(new Date().toISOString().slice(0, 10));
  const cfg = await getConfig(scope);
  return NextResponse.json({
    ok: true,
    dimensions: DIMENSIONS.filter((d) => cfg.dimensionsEnabled.includes(d.key)),
    targetTypes: TARGET_TYPES.filter((t) => cfg.targetTypesEnabled.includes(t.key)),
    periods: PERIODS.filter((p) => cfg.periodsEnabled.includes(p.key)),
    distributions: DISTRIBUTIONS.filter((d) => cfg.distributionsEnabled.includes(d.key)),
    fyList: [shiftFyLabel(thisFy, -1), thisFy, shiftFyLabel(thisFy, 1)],
    options: {
      branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code, level: b.hierarchyLevel ?? 0 })),
      executives: users.map((u) => ({ id: u.id, name: u.fullName || `User ${u.id}` })),
      customers: customers.map((x) => ({ id: x.id, name: x.name })),
      productCategories: [...new Set(prodCats.map((x) => x.category).filter((x): x is string => !!x))],
      brands: [...new Set(brands.map((x) => x.brand).filter((x): x is string => !!x))],
      customerCategories: [...new Set(custCats.map((x) => x.category).filter((x): x is string => !!x))],
      channels: ["POS", "B2B"],
      states, cities,
      costCentres: (costCentres as { id: number; name: string; code: string }[]).map((x) => ({ id: x.id, name: `${x.code} · ${x.name}` })),
      profitCentres: (profitCentres as { id: number; name: string; code: string }[]).map((x) => ({ id: x.id, name: `${x.code} · ${x.name}` })),
    },
  });
}
function shiftFyLabel(fy: string, delta: number): string { const m = /(\d{2})\s*-\s*(\d{2})/.exec(fy); if (!m) return fy; return `FY ${String(Number(m[1]) + delta).padStart(2, "0")}-${String(Number(m[2]) + delta).padStart(2, "0")}`; }

export async function distributeHandler(req: Request) {
  const c = await auth(); if (c instanceof NextResponse) return c;
  try {
    const b = await req.json();
    const months = await buildLineMonths(c.scope, { fy: b.fy, targetType: b.targetType, distribution: b.distribution }, { dimensionType: b.dimensionType, dimensionRefId: b.dimensionRefId, dimensionValue: b.dimensionValue, annual: Number(b.annual) || 0, months: b.months });
    return NextResponse.json({ ok: true, months });
  } catch (e) { return bad(e); }
}
