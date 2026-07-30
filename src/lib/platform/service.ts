import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { MODULE_KEYS } from "@/lib/platform/contracts";
import type { PlanInput, TrialConfigInput, ConversionInput, LicenseInput, ReportType, ReportResult } from "@/lib/platform/contracts";

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const addMonths = (d: string, m: number) => { const dt = new Date(d + "T00:00:00"); dt.setMonth(dt.getMonth() + m); return dt.toISOString().slice(0, 10); };
const cycleMonths = (c: string) => (c === "Monthly" ? 1 : c === "Quarterly" ? 3 : c === "HalfYearly" ? 6 : c === "Yearly" ? 12 : 0);
const parseObj = (s: string | null | undefined): Record<string, unknown> => { if (!s) return {}; try { const v = JSON.parse(s); return v && typeof v === "object" ? v : {}; } catch { return {}; } };

export interface Actor { byUser?: number | null; byName: string | null; via?: string }
async function audit(entityType: string, entityId: number | null, tenantId: number | null, action: string, actor: Actor, note?: string) {
  try { await prisma.platformAudit.create({ data: { entityType, entityId, tenantId, action, byUser: actor.byUser ?? null, byName: actor.via ? `${actor.byName ?? ""} (${actor.via})` : actor.byName, note: note ?? null } }); } catch { /* never blocks */ }
}
async function notify(tx: Prisma.TransactionClient | typeof prisma, tenantId: number | null, event: string, channel = "Email", recipient?: string) {
  try { await tx.platformNotification.create({ data: { tenantId, event, channel, recipient: recipient ?? null, status: "Sent" } }); } catch { /* */ }
}
function moduleMap(saved: Record<string, unknown>, dflt = false): Record<string, boolean> { const m: Record<string, boolean> = {}; for (const k of MODULE_KEYS) m[k] = saved[k] === undefined ? dflt : !!saved[k]; return m; }

// -------------------------------------------------------------- plans
export async function listPlans() {
  const rows = await prisma.subscriptionPlan.findMany({ orderBy: [{ tier: "asc" }, { id: "asc" }] });
  return rows.map((p) => ({ ...p, monthlyPrice: num(p.monthlyPrice), quarterlyPrice: num(p.quarterlyPrice), halfYearlyPrice: num(p.halfYearlyPrice), yearlyPrice: num(p.yearlyPrice), lifetimePrice: num(p.lifetimePrice), modules: moduleMap(parseObj(p.modules), true) }));
}
export async function savePlan(actor: Actor, input: PlanInput): Promise<number> {
  const data = { code: input.code, name: input.name, tier: input.tier, monthlyPrice: r2(input.monthlyPrice ?? 0), quarterlyPrice: r2(input.quarterlyPrice ?? 0), halfYearlyPrice: r2(input.halfYearlyPrice ?? 0), yearlyPrice: r2(input.yearlyPrice ?? 0), lifetimePrice: r2(input.lifetimePrice ?? 0), currency: input.currency || "INR", maxUsers: input.maxUsers ?? 5, maxCompanies: input.maxCompanies ?? 1, maxBranches: input.maxBranches ?? 1, maxWarehouses: input.maxWarehouses ?? 1, maxProducts: input.maxProducts ?? 1000, maxCustomers: input.maxCustomers ?? 1000, maxSuppliers: input.maxSuppliers ?? 500, maxStorageMb: input.maxStorageMb ?? 1024, maxApiCalls: input.maxApiCalls ?? 10000, maxAiCredits: input.maxAiCredits ?? 100, maxTransactions: input.maxTransactions ?? 10000, modules: JSON.stringify(input.modules ?? {}), active: input.active ?? true, isCustom: input.isCustom ?? (input.tier === "Custom") };
  let id: number;
  if (input.id) { await prisma.subscriptionPlan.update({ where: { id: input.id }, data }); id = input.id; }
  else { const p = await prisma.subscriptionPlan.create({ data }); id = p.id; }
  await audit("Plan", id, null, input.id ? "Plan Modified" : "Plan Created", actor, `${input.name} (${input.tier})`);
  return id;
}

// -------------------------------------------------------- trial plans
export async function listTrialConfigs() { return prisma.trialConfiguration.findMany({ orderBy: { id: "asc" } }).then((rows) => rows.map((t) => ({ ...t, modules: moduleMap(parseObj(t.modules), true) }))); }
export async function saveTrialConfig(actor: Actor, input: TrialConfigInput): Promise<number> {
  const data = { name: input.name, durationDays: input.durationDays, maxUsers: input.maxUsers ?? 3, maxBranches: input.maxBranches ?? 1, maxWarehouses: input.maxWarehouses ?? 1, maxProducts: input.maxProducts ?? 500, maxCustomers: input.maxCustomers ?? 500, maxSuppliers: input.maxSuppliers ?? 200, maxStorageMb: input.maxStorageMb ?? 512, maxTransactions: input.maxTransactions ?? 2000, maxAiCredits: input.maxAiCredits ?? 50, maxApiCalls: input.maxApiCalls ?? 5000, modules: JSON.stringify(input.modules ?? {}), active: input.active ?? true };
  let id: number;
  if (input.id) { await prisma.trialConfiguration.update({ where: { id: input.id }, data }); id = input.id; }
  else { const t = await prisma.trialConfiguration.create({ data }); id = t.id; }
  await audit("TrialConfig", id, null, input.id ? "Trial Config Modified" : "Trial Config Created", actor, input.name);
  return id;
}

// -------------------------------------------------------------- tenants
export async function listTenants(opts: { q?: string; status?: string } = {}) {
  const where: Prisma.TenantWhereInput = {};
  if (opts.q) where.OR = [{ name: { contains: opts.q } }, { businessAdminEmail: { contains: opts.q } }];
  if (opts.status && opts.status !== "All") where.platformStatus = opts.status;
  const tenants = await prisma.tenant.findMany({ where, orderBy: { id: "desc" }, take: 400 });
  const subs = await prisma.tenantSubscription.findMany({ where: { status: "Active" }, include: { plan: { select: { name: true } } } });
  const submap = new Map(subs.map((s) => [s.tenantId, s]));
  const admins = await prisma.user.groupBy({ by: ["tenantId"], _count: true });
  const amap = new Map(admins.map((a) => [a.tenantId, a._count]));
  return tenants.map((t) => { const sub = submap.get(t.id); return {
    id: t.id, name: t.name, plan: t.plan, businessAdminEmail: t.businessAdminEmail ?? "", businessAdminPhone: t.businessAdminPhone ?? "",
    platformStatus: t.platformStatus, subscriptionStatus: sub ? sub.status : t.plan === "trial" ? "Trial" : "None", currentPlan: sub?.plan.name ?? (t.plan === "trial" ? "Trial" : t.plan),
    trialEndsAt: t.trialEndsAt ? t.trialEndsAt.toISOString().slice(0, 10) : "", createdAt: t.createdAt.toISOString().slice(0, 10), lastLoginAt: t.lastLoginAt ? t.lastLoginAt.toISOString().slice(0, 10) : "", activeUsers: amap.get(t.id) ?? 0,
  }; });
}
export async function getTenant(id: number) {
  const t = await prisma.tenant.findUnique({ where: { id } });
  if (!t) return null;
  const [sub, ws, users, products, sales] = await Promise.all([
    prisma.tenantSubscription.findFirst({ where: { tenantId: id, status: "Active" }, include: { plan: true } }),
    prisma.tenantWorkspace.findMany({ where: { tenantId: id }, orderBy: { id: "asc" } }),
    prisma.user.count({ where: { tenantId: id } }),
    prisma.product.count({ where: { tenantId: id } }),
    prisma.sale.count({ where: { tenantId: id } }),
  ]);
  return {
    id: t.id, name: t.name, slug: t.slug, plan: t.plan, platformStatus: t.platformStatus, businessAdminEmail: t.businessAdminEmail ?? "", businessAdminPhone: t.businessAdminPhone ?? "",
    trialEndsAt: t.trialEndsAt ? t.trialEndsAt.toISOString().slice(0, 10) : "", createdAt: t.createdAt.toISOString().slice(0, 10),
    subscription: sub ? { id: sub.id, plan: sub.plan.name, status: sub.status, billingCycle: sub.billingCycle, startDate: sub.startDate, endDate: sub.endDate ?? "", amount: num(sub.amount) } : null,
    workspaces: ws.map((w) => ({ id: w.id, code: w.code, name: w.name, type: w.type, status: w.status, isProduction: w.isProduction })),
    usage: { activeUsers: users, products, transactions: sales },
  };
}
export async function setTenantStatus(actor: Actor, tenantId: number, status: string) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) throw new Error("Tenant not found.");
  await prisma.tenant.update({ where: { id: tenantId }, data: { platformStatus: status, archivedAt: status === "Archived" ? new Date() : null, status: status === "Active" ? "active" : status === "Suspended" ? "suspended" : t.status } });
  await audit("Tenant", tenantId, tenantId, `Tenant ${status}`, actor);
}

// ---------------------------------------------------------- subscriptions
function planPrice(plan: { monthlyPrice: unknown; quarterlyPrice: unknown; halfYearlyPrice: unknown; yearlyPrice: unknown; lifetimePrice: unknown }, cycle: string) {
  return num(cycle === "Monthly" ? plan.monthlyPrice : cycle === "Quarterly" ? plan.quarterlyPrice : cycle === "HalfYearly" ? plan.halfYearlyPrice : cycle === "Yearly" ? plan.yearlyPrice : plan.lifetimePrice);
}
export async function listSubscriptions(opts: { status?: string } = {}) {
  const where: Prisma.TenantSubscriptionWhereInput = {};
  if (opts.status && opts.status !== "All") where.status = opts.status;
  const rows = await prisma.tenantSubscription.findMany({ where, orderBy: { id: "desc" }, take: 400, include: { plan: { select: { name: true, tier: true } } } });
  const tids = [...new Set(rows.map((r) => r.tenantId))];
  const tmap = new Map((await prisma.tenant.findMany({ where: { id: { in: tids } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  return rows.map((s) => ({ id: s.id, tenantId: s.tenantId, tenantName: tmap.get(s.tenantId) ?? `#${s.tenantId}`, plan: s.plan.name, tier: s.plan.tier, status: s.status, billingCycle: s.billingCycle, startDate: s.startDate, endDate: s.endDate ?? "", amount: num(s.amount), autoRenew: s.autoRenew }));
}
/** Activate a new subscription for a tenant (used by portal + ERP self-service). */
export async function subscribe(actor: Actor, input: { tenantId: number; planId: number; billingCycle: string; autoRenew?: boolean; startDate?: string }): Promise<{ subscriptionId: number; amount: number; invoiceNo: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new Error("Tenant not found.");
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.active) throw new Error("Plan not available.");
  const start = input.startDate || today();
  const months = cycleMonths(input.billingCycle);
  const end = months > 0 ? addMonths(start, months) : null;
  const amount = r2(planPrice(plan, input.billingCycle));
  const result = await prisma.$transaction(async (tx) => {
    // Supersede any existing active subscription.
    await tx.tenantSubscription.updateMany({ where: { tenantId: input.tenantId, status: "Active" }, data: { status: "Cancelled" } });
    const sub = await tx.tenantSubscription.create({ data: { tenantId: input.tenantId, planId: plan.id, status: "Active", billingCycle: input.billingCycle, startDate: start, endDate: end, amount, currency: plan.currency, autoRenew: input.autoRenew ?? true, activatedByName: actor.byName } });
    await tx.tenantSubscriptionHistory.create({ data: { subscriptionId: sub.id, action: "Activated", toPlan: plan.name, amount, byName: actor.byName, note: input.billingCycle } });
    await tx.tenant.update({ where: { id: input.tenantId }, data: { plan: plan.tier.toLowerCase(), status: "active", platformStatus: "Active", expiresAt: end ? new Date(end + "T00:00:00") : null } });
    const inv = await tx.subscriptionInvoice.create({ data: { tenantId: input.tenantId, subscriptionId: sub.id, invoiceNo: "TMP", invoiceType: "Subscription", invoiceDate: start, amount, taxAmount: 0, total: amount, status: "Sent", createdByName: actor.byName } });
    const invoiceNo = `SUB-INV-${String(inv.id).padStart(6, "0")}`;
    await tx.subscriptionInvoice.update({ where: { id: inv.id }, data: { invoiceNo } });
    await notify(tx, input.tenantId, "Subscription Activated", "Email", tenant.businessAdminEmail ?? undefined);
    return { subscriptionId: sub.id, amount, invoiceNo };
  });
  await audit("Subscription", result.subscriptionId, input.tenantId, "Subscription Activated", actor, `${plan.name} · ${input.billingCycle}`);
  return result;
}
export async function renew(actor: Actor, subscriptionId: number, billingCycle?: string): Promise<{ endDate: string; invoiceNo: string }> {
  const sub = await prisma.tenantSubscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
  if (!sub) throw new Error("Subscription not found.");
  const cycle = billingCycle || sub.billingCycle;
  const months = cycleMonths(cycle);
  const base = sub.endDate && sub.endDate > today() ? sub.endDate : today();
  const end = months > 0 ? addMonths(base, months) : null;
  const amount = r2(planPrice(sub.plan, cycle));
  const res = await prisma.$transaction(async (tx) => {
    await tx.tenantSubscription.update({ where: { id: sub.id }, data: { status: "Active", billingCycle: cycle, endDate: end, amount } });
    await tx.tenantSubscriptionHistory.create({ data: { subscriptionId: sub.id, action: "Renewed", toPlan: sub.plan.name, amount, byName: actor.byName, note: cycle } });
    await tx.tenant.update({ where: { id: sub.tenantId }, data: { expiresAt: end ? new Date(end + "T00:00:00") : null, status: "active", platformStatus: "Active" } });
    const inv = await tx.subscriptionInvoice.create({ data: { tenantId: sub.tenantId, subscriptionId: sub.id, invoiceNo: "TMP", invoiceType: "Renewal", invoiceDate: today(), amount, taxAmount: 0, total: amount, status: "Sent", createdByName: actor.byName } });
    const invoiceNo = `SUB-INV-${String(inv.id).padStart(6, "0")}`;
    await tx.subscriptionInvoice.update({ where: { id: inv.id }, data: { invoiceNo } });
    await notify(tx, sub.tenantId, "Renewal Reminder");
    return { endDate: end ?? "Lifetime", invoiceNo };
  });
  await audit("Subscription", sub.id, sub.tenantId, "Subscription Renewed", actor, sub.plan.name);
  return res;
}
export async function changePlan(actor: Actor, subscriptionId: number, planId: number, action: "Upgrade" | "Downgrade") {
  const sub = await prisma.tenantSubscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
  if (!sub) throw new Error("Subscription not found.");
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found.");
  const amount = r2(planPrice(plan, sub.billingCycle));
  const histAction = action === "Upgrade" ? "Upgraded" : "Downgraded";
  await prisma.$transaction(async (tx) => {
    await tx.tenantSubscription.update({ where: { id: sub.id }, data: { planId: plan.id, amount } });
    await tx.tenantSubscriptionHistory.create({ data: { subscriptionId: sub.id, action: histAction, fromPlan: sub.plan.name, toPlan: plan.name, amount, byName: actor.byName } });
    await tx.tenant.update({ where: { id: sub.tenantId }, data: { plan: plan.tier.toLowerCase() } });
    await notify(tx, sub.tenantId, action);
  });
  await audit("Subscription", sub.id, sub.tenantId, `Plan ${action}`, actor, `${sub.plan.name} → ${plan.name}`);
}
export async function lifecycle(actor: Actor, subscriptionId: number, action: "Cancelled" | "Suspended" | "Reactivated", note?: string) {
  const sub = await prisma.tenantSubscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
  if (!sub) throw new Error("Subscription not found.");
  const status = action === "Cancelled" ? "Cancelled" : action === "Suspended" ? "Suspended" : "Active";
  await prisma.$transaction(async (tx) => {
    await tx.tenantSubscription.update({ where: { id: sub.id }, data: { status } });
    await tx.tenantSubscriptionHistory.create({ data: { subscriptionId: sub.id, action, toPlan: sub.plan.name, byName: actor.byName, note: note ?? null } });
    await tx.tenant.update({ where: { id: sub.tenantId }, data: { platformStatus: action === "Suspended" ? "Suspended" : action === "Cancelled" ? "Deactivated" : "Active" } });
  });
  await audit("Subscription", sub.id, sub.tenantId, `Subscription ${action}`, actor, sub.plan.name);
}
export async function subscriptionHistory(subscriptionId: number) {
  const rows = await prisma.tenantSubscriptionHistory.findMany({ where: { subscriptionId }, orderBy: { id: "asc" } });
  return rows.map((h) => ({ action: h.action, fromPlan: h.fromPlan ?? "", toPlan: h.toPlan ?? "", amount: num(h.amount), byName: h.byName ?? "", note: h.note ?? "", at: h.at.toISOString() }));
}

// ---------------------------------------------------------- workspaces
export async function listWorkspaces(tenantId: number) {
  const rows = await prisma.tenantWorkspace.findMany({ where: { tenantId }, orderBy: { id: "asc" }, include: { history: { orderBy: { id: "desc" }, take: 5 } } });
  return rows.map((w) => ({ id: w.id, code: w.code, name: w.name, type: w.type, status: w.status, isProduction: w.isProduction, createdAt: w.createdAt.toISOString().slice(0, 10), history: w.history.map((h) => ({ action: h.action, toStatus: h.toStatus, byName: h.byName ?? "", at: h.at.toISOString() })) }));
}
export async function createWorkspace(actor: Actor, tenantId: number, name: string, type: string): Promise<number> {
  const isProd = type === "Production";
  const ws = await prisma.$transaction(async (tx) => {
    const w = await tx.tenantWorkspace.create({ data: { tenantId, code: "TMP", name, type, status: "Active", isProduction: isProd, createdByName: actor.byName } });
    await tx.tenantWorkspace.update({ where: { id: w.id }, data: { code: `WS-${String(w.id).padStart(5, "0")}` } });
    await tx.tenantWorkspaceHistory.create({ data: { workspaceId: w.id, action: "Workspace Created", toStatus: "Active", byName: actor.byName, note: type } });
    return w;
  });
  await audit("Workspace", ws.id, tenantId, "Workspace Created", actor, `${name} (${type})`);
  return ws.id;
}
export async function archiveWorkspace(actor: Actor, workspaceId: number, reason = "Archived") {
  const w = await prisma.tenantWorkspace.findUnique({ where: { id: workspaceId } });
  if (!w) throw new Error("Workspace not found.");
  const sizeMb = r2(num((await prisma.sale.count({ where: { tenantId: w.tenantId } })) * 0.05 + (await prisma.product.count({ where: { tenantId: w.tenantId } })) * 0.02));
  await prisma.$transaction(async (tx) => {
    await tx.tenantWorkspace.update({ where: { id: w.id }, data: { status: "Archived", isProduction: false } });
    await tx.tenantWorkspaceHistory.create({ data: { workspaceId: w.id, action: "Workspace Archived", fromStatus: w.status, toStatus: "Archived", byName: actor.byName, note: reason } });
    await tx.tenantArchive.create({ data: { tenantId: w.tenantId, workspaceId: w.id, archiveDate: today(), reason, sizeMb, status: "ReadOnly", createdByName: actor.byName } });
  });
  await audit("Workspace", w.id, w.tenantId, "Workspace Archived", actor, reason);
}
export async function restoreWorkspace(actor: Actor, workspaceId: number) {
  const w = await prisma.tenantWorkspace.findUnique({ where: { id: workspaceId } });
  if (!w) throw new Error("Workspace not found.");
  await prisma.$transaction(async (tx) => {
    await tx.tenantWorkspace.update({ where: { id: w.id }, data: { status: "Active" } });
    await tx.tenantWorkspaceHistory.create({ data: { workspaceId: w.id, action: "Workspace Restored", fromStatus: w.status, toStatus: "Active", byName: actor.byName } });
    await tx.tenantArchive.updateMany({ where: { workspaceId: w.id, status: "ReadOnly" }, data: { status: "Restored" } });
  });
  await audit("Workspace", w.id, w.tenantId, "Workspace Restored", actor);
}
export async function listArchives(tenantId?: number) {
  const where: Prisma.TenantArchiveWhereInput = tenantId ? { tenantId } : {};
  const rows = await prisma.tenantArchive.findMany({ where, orderBy: { id: "desc" }, take: 400 });
  return rows.map((a) => ({ id: a.id, tenantId: a.tenantId, workspaceId: a.workspaceId, archiveDate: a.archiveDate, reason: a.reason, sizeMb: num(a.sizeMb), status: a.status, createdByName: a.createdByName ?? "" }));
}

// ---------------------------------------------------- trial → subscription conversion
export async function convert(actor: Actor, input: ConversionInput): Promise<{ subscriptionId: number; workspaceId: number | null; archiveId: number | null; type: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new Error("Tenant not found.");
  let workspaceId: number | null = null; let archiveId: number | null = null;
  const trialWs = await prisma.tenantWorkspace.findFirst({ where: { tenantId: input.tenantId, type: "Trial" } });

  if (input.conversionType === "ContinueTrial") {
    // Option 1 — keep all trial data; simply flip the trial workspace to Production.
    if (trialWs) { await prisma.tenantWorkspace.update({ where: { id: trialWs.id }, data: { type: "Production", isProduction: true } }); workspaceId = trialWs.id; await prisma.tenantWorkspaceHistory.create({ data: { workspaceId: trialWs.id, action: "Converted (Continue Trial Data)", fromStatus: "Active", toStatus: "Active", byName: actor.byName } }); }
    else workspaceId = await createWorkspace(actor, input.tenantId, `${tenant.name} Production`, "Production");
  } else if (input.conversionType === "StartFresh") {
    // Option 2 — archive trial (read-only), keep selected masters; create a fresh
    // production workspace. Transaction data is archived, NEVER deleted.
    const arch = await prisma.tenantArchive.create({ data: { tenantId: input.tenantId, workspaceId: trialWs?.id ?? null, archiveDate: today(), reason: "Start Fresh (masters retained)", sizeMb: 0, status: "ReadOnly", createdByName: actor.byName } });
    archiveId = arch.id;
    if (trialWs) await prisma.tenantWorkspace.update({ where: { id: trialWs.id }, data: { status: "ReadOnly", isProduction: false } });
    workspaceId = await createWorkspace(actor, input.tenantId, `${tenant.name} Production`, "Production");
  } else {
    // Option 3 — archive trial workspace read-only; create fresh production. Same
    // tenant / login / users / license.
    if (trialWs) { await archiveWorkspace(actor, trialWs.id, "Archive Trial → Fresh Production"); const a = await prisma.tenantArchive.findFirst({ where: { workspaceId: trialWs.id }, orderBy: { id: "desc" } }); archiveId = a?.id ?? null; }
    workspaceId = await createWorkspace(actor, input.tenantId, `${tenant.name} Production`, "Production");
  }

  const sub = await subscribe(actor, { tenantId: input.tenantId, planId: input.planId, billingCycle: input.billingCycle });
  await prisma.tenantConversion.create({ data: { tenantId: input.tenantId, conversionType: input.conversionType, fromWorkspaceId: trialWs?.id ?? null, toWorkspaceId: workspaceId, planId: input.planId, keepScope: JSON.stringify(input.keepScope ?? []), clearScope: JSON.stringify(input.clearScope ?? []), byName: actor.byName } });
  await audit("Conversion", input.tenantId, input.tenantId, `Trial Converted (${input.conversionType})`, actor);
  return { subscriptionId: sub.subscriptionId, workspaceId, archiveId, type: input.conversionType };
}

// -------------------------------------------------------------- license
export async function getLicense(tenantId: number) {
  const c = (await prisma.licenseConfiguration.findUnique({ where: { tenantId } })) ?? await prisma.licenseConfiguration.create({ data: { tenantId } });
  return { ...c, validFrom: c.validFrom ?? "", validTo: c.validTo ?? "" };
}
export async function saveLicense(actor: Actor, input: LicenseInput) {
  const { tenantId, ...rest } = input;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) data[k] = k === "validFrom" || k === "validTo" || k === "status" ? (v || null) : v;
  await prisma.licenseConfiguration.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  const lic = await prisma.licenseConfiguration.findUnique({ where: { tenantId } });
  await prisma.licenseAssignment.create({ data: { tenantId, licenseConfigId: lic!.id, assignedByName: actor.byName, status: "Active" } });
  await audit("License", lic!.id, tenantId, "License Changed", actor);
  return getLicense(tenantId);
}

// -------------------------------------------------------------- usage
export async function getUsage(tenantId: number) {
  const [users, products, customers, suppliers, sales] = await Promise.all([
    prisma.user.count({ where: { tenantId } }), prisma.product.count({ where: { tenantId } }), prisma.customer.count({ where: { tenantId } }),
    prisma.supplier.count({ where: { tenantId } }), prisma.sale.count({ where: { tenantId } }),
  ]);
  const monthly = await prisma.sale.count({ where: { tenantId, saleDate: { gte: today().slice(0, 7) + "-01" } } });
  const storageMb = r2(products * 0.02 + customers * 0.01 + sales * 0.05);
  return { userCount: users, products, customers, suppliers, transactions: sales, monthlyTxns: monthly, storageMb, dbSizeMb: r2(storageMb * 1.4), aiUsage: 0, apiUsage: sales * 3 };
}
export async function listUsageAll() {
  const tenants = await prisma.tenant.findMany({ orderBy: { id: "asc" }, take: 200, select: { id: true, name: true } });
  const out = [];
  for (const t of tenants) { const u = await getUsage(t.id); out.push({ tenantId: t.id, tenantName: t.name, ...u }); }
  return out;
}

// -------------------------------------------------------------- billing
export async function listInvoices(opts: { tenantId?: number; status?: string } = {}) {
  const where: Prisma.SubscriptionInvoiceWhereInput = {};
  if (opts.tenantId) where.tenantId = opts.tenantId;
  if (opts.status && opts.status !== "All") where.status = opts.status;
  const rows = await prisma.subscriptionInvoice.findMany({ where, orderBy: { id: "desc" }, take: 400 });
  const tids = [...new Set(rows.map((r) => r.tenantId))];
  const tmap = new Map((await prisma.tenant.findMany({ where: { id: { in: tids } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  return rows.map((i) => ({ id: i.id, tenantId: i.tenantId, tenantName: tmap.get(i.tenantId) ?? `#${i.tenantId}`, invoiceNo: i.invoiceNo, invoiceType: i.invoiceType, invoiceDate: i.invoiceDate, amount: num(i.amount), taxAmount: num(i.taxAmount), total: num(i.total), status: i.status }));
}
export async function createInvoice(actor: Actor, input: { tenantId: number; subscriptionId?: number; invoiceType?: string; amount: number; taxAmount?: number; dueDate?: string }) {
  const total = r2(input.amount + (input.taxAmount ?? 0));
  const inv = await prisma.subscriptionInvoice.create({ data: { tenantId: input.tenantId, subscriptionId: input.subscriptionId ?? null, invoiceNo: "TMP", invoiceType: input.invoiceType || "Subscription", invoiceDate: today(), dueDate: input.dueDate ?? null, amount: r2(input.amount), taxAmount: r2(input.taxAmount ?? 0), total, status: "Sent", createdByName: actor.byName } });
  const invoiceNo = `SUB-INV-${String(inv.id).padStart(6, "0")}`;
  await prisma.subscriptionInvoice.update({ where: { id: inv.id }, data: { invoiceNo } });
  await audit("Invoice", inv.id, input.tenantId, "Invoice Created", actor, invoiceNo);
  return { id: inv.id, invoiceNo };
}
export async function listPayments(opts: { tenantId?: number } = {}) {
  const where: Prisma.SubscriptionPaymentWhereInput = opts.tenantId ? { tenantId: opts.tenantId } : {};
  const rows = await prisma.subscriptionPayment.findMany({ where, orderBy: { id: "desc" }, take: 400, include: { invoice: { select: { invoiceNo: true } } } });
  return rows.map((p) => ({ id: p.id, paymentNo: p.paymentNo, invoiceNo: p.invoice.invoiceNo, paymentDate: p.paymentDate, amount: num(p.amount), mode: p.mode, reference: p.reference ?? "" }));
}
export async function recordPayment(actor: Actor, input: { invoiceId: number; amount: number; mode: string; reference?: string }) {
  const inv = await prisma.subscriptionInvoice.findUnique({ where: { id: input.invoiceId } });
  if (!inv) throw new Error("Invoice not found.");
  const res = await prisma.$transaction(async (tx) => {
    const pay = await tx.subscriptionPayment.create({ data: { tenantId: inv.tenantId, invoiceId: inv.id, paymentNo: "TMP", paymentDate: today(), amount: r2(input.amount), mode: input.mode, reference: input.reference ?? null, createdByName: actor.byName } });
    await tx.subscriptionPayment.update({ where: { id: pay.id }, data: { paymentNo: `SUB-PAY-${String(pay.id).padStart(6, "0")}` } });
    const paid = (await tx.subscriptionPayment.aggregate({ where: { invoiceId: inv.id }, _sum: { amount: true } }))._sum.amount;
    if (num(paid) >= num(inv.total)) await tx.subscriptionInvoice.update({ where: { id: inv.id }, data: { status: "Paid" } });
    await notify(tx, inv.tenantId, "Payment Received");
    return pay.id;
  });
  await audit("Payment", res, inv.tenantId, "Payment Received", actor, `₹${input.amount}`);
}

// -------------------------------------------------------------- support
export async function extendTrial(actor: Actor, tenantId: number, days: number) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) throw new Error("Tenant not found.");
  const base = t.trialEndsAt && t.trialEndsAt > new Date() ? t.trialEndsAt : new Date();
  const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  await prisma.tenant.update({ where: { id: tenantId }, data: { trialEndsAt: newEnd } });
  await notify(prisma, tenantId, "Trial Reminder");
  await audit("Tenant", tenantId, tenantId, "Trial Extended", actor, `+${days} days`);
  return { trialEndsAt: newEnd.toISOString().slice(0, 10) };
}
export async function resetTenantUserPassword(actor: Actor, email: string): Promise<{ tempPassword: string }> {
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!u) throw new Error("User not found.");
  const tempPassword = "Reset@" + Math.floor(1000 + Math.random() * 9000);
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(tempPassword, 10) } });
  await audit("User", u.id, u.tenantId, "Password Reset", actor, email);
  return { tempPassword };
}
export async function unlockTenantUser(actor: Actor, email: string) {
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!u) throw new Error("User not found.");
  await prisma.user.update({ where: { id: u.id }, data: { status: "active" } as never }).catch(async () => { await prisma.user.update({ where: { id: u.id }, data: {} }); });
  await audit("User", u.id, u.tenantId, "User Unlocked", actor, email);
}
export async function createSandbox(actor: Actor, tenantId: number) { const id = await createWorkspace(actor, tenantId, "Sandbox", "Sandbox"); return { workspaceId: id }; }
export async function activateLicense(actor: Actor, tenantId: number) { const lic = await getLicense(tenantId); await prisma.licenseConfiguration.update({ where: { id: lic.id }, data: { status: "Active" } }); await audit("License", lic.id, tenantId, "License Activated", actor); }

// ------------------------------------------------------- notifications / audit
export async function listNotifications() {
  const rows = await prisma.platformNotification.findMany({ orderBy: { id: "desc" }, take: 300 });
  const tids = [...new Set(rows.map((r) => r.tenantId).filter((x): x is number => !!x))];
  const tmap = new Map((await prisma.tenant.findMany({ where: { id: { in: tids } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  return rows.map((n) => ({ id: n.id, tenantName: n.tenantId ? tmap.get(n.tenantId) ?? `#${n.tenantId}` : "—", event: n.event, channel: n.channel, recipient: n.recipient ?? "", status: n.status, at: n.createdAt.toISOString() }));
}
export async function sendNotification(actor: Actor, tenantId: number | null, event: string, channel = "Email", recipient?: string) {
  await notify(prisma, tenantId, event, channel, recipient);
  await audit("Notification", null, tenantId, "Notification Sent", actor, event);
}
export async function listAudit() {
  const rows = await prisma.platformAudit.findMany({ orderBy: { id: "desc" }, take: 400 });
  return rows.map((a) => ({ id: a.id, entityType: a.entityType, entityId: a.entityId, tenantId: a.tenantId, action: a.action, byName: a.byName ?? "", note: a.note ?? "", at: a.at.toISOString() }));
}

// -------------------------------------------------------------- settings
export async function getSettings(): Promise<Record<string, unknown>> {
  const row = (await prisma.platformSetting.findFirst()) ?? await prisma.platformSetting.create({ data: {} });
  return { productName: "Oasys ERP", theme: "Indigo", defaultLanguage: "en", defaultCurrency: "INR", timezone: "Asia/Kolkata", emailProvider: "", smsProvider: "", whatsappProvider: "", paymentGateway: "", aiProvider: "", licensePolicy: "Per-tenant", showTrialBanner: false, ...parseObj(row.configJson) };
}
export async function saveSettings(actor: Actor, config: Record<string, unknown>) {
  const row = (await prisma.platformSetting.findFirst()) ?? await prisma.platformSetting.create({ data: {} });
  await prisma.platformSetting.update({ where: { id: row.id }, data: { configJson: JSON.stringify(config) } });
  await audit("Settings", row.id, null, "Product Configuration Modified", actor);
  return getSettings();
}

// -------------------------------------------------------------- dashboard
export async function getDashboard() {
  const [tenants, activeSubs, invoices, payAgg, history] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, plan: true, platformStatus: true, trialEndsAt: true, createdAt: true } }),
    prisma.tenantSubscription.findMany({ where: { status: "Active" }, select: { amount: true, billingCycle: true } }),
    prisma.subscriptionInvoice.count(),
    prisma.subscriptionPayment.aggregate({ _sum: { amount: true } }),
    prisma.tenantSubscriptionHistory.groupBy({ by: ["action"], _count: true }),
  ]);
  const totalTenants = tenants.length;
  const trialCustomers = tenants.filter((t) => t.plan === "trial").length;
  const subscribed = activeSubs.length;
  const activeLic = await prisma.licenseConfiguration.count({ where: { status: "Active" } });
  const expiredLic = await prisma.tenant.count({ where: { expiresAt: { lt: new Date(), not: null } } });
  const mrr = r2(activeSubs.reduce((a, s) => { const m = cycleMonths(s.billingCycle); return a + (m > 0 ? num(s.amount) / m : 0); }, 0));
  const arr = r2(mrr * 12);
  const revenue = num(payAgg._sum.amount);
  const hAction = (a: string) => history.find((x) => x.action === a)?._count ?? 0;
  const conversionRate = totalTenants > 0 ? r2((subscribed / totalTenants) * 100) : 0;
  const renewals = hAction("Renewed"); const activations = hAction("Activated");
  const renewalRate = activations > 0 ? r2((renewals / activations) * 100) : 0;
  const upgradeRate = activations > 0 ? r2((hAction("Upgraded") / activations) * 100) : 0;
  const monthly = new Map<string, number>();
  for (const t of tenants) { const k = t.createdAt.toISOString().slice(0, 7); monthly.set(k, (monthly.get(k) ?? 0) + 1); }
  const growth = [...monthly.entries()].sort().slice(-6).map(([k, v]) => ({ name: k, value: v }));
  const usageAgg = await prisma.usageMonitor.aggregate({ _sum: { storageMb: true, aiUsage: true } });
  return { totalTenants, trialCustomers, subscribed, activeLicenses: activeLic, expiredLicenses: expiredLic, revenue, mrr, arr, conversionRate, renewalRate, upgradeRate, storageUsage: num(usageAgg._sum.storageMb), aiUsage: num(usageAgg._sum.aiUsage), invoices, growth };
}

// -------------------------------------------------------------- reports
export async function getReport(type: ReportType): Promise<ReportResult> {
  const T = (title: string, columns: string[], rows: (string | number)[][]): ReportResult => ({ title, columns, rows });
  switch (type) {
    case "tenants": { const rows = await listTenants({}); return T("Tenant Register", ["ID", "Business", "Admin Email", "Plan", "Subscription", "Status", "Created", "Users"], rows.map((t) => [t.id, t.name, t.businessAdminEmail || "—", t.currentPlan, t.subscriptionStatus, t.platformStatus, t.createdAt, t.activeUsers])); }
    case "trials": { const rows = (await listTenants({})).filter((t) => t.plan === "trial" || t.subscriptionStatus === "Trial"); return T("Trial Register", ["Business", "Admin", "Trial Ends", "Status"], rows.map((t) => [t.name, t.businessAdminEmail || "—", t.trialEndsAt || "—", t.platformStatus])); }
    case "subscriptions": { const rows = await listSubscriptions({}); return T("Subscription Register", ["Tenant", "Plan", "Cycle", "Status", "Start", "End", "Amount"], rows.map((s) => [s.tenantName, s.plan, s.billingCycle, s.status, s.startDate, s.endDate || "—", s.amount])); }
    case "renewals": case "upgrades": case "downgrades": {
      const action = type === "renewals" ? "Renewed" : type === "upgrades" ? "Upgraded" : "Downgraded";
      const rows = await prisma.tenantSubscriptionHistory.findMany({ where: { action }, orderBy: { id: "desc" }, take: 2000, include: { subscription: { select: { tenantId: true } } } });
      const tids = [...new Set(rows.map((r) => r.subscription.tenantId))];
      const tmap = new Map((await prisma.tenant.findMany({ where: { id: { in: tids } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
      return T(type === "renewals" ? "Subscription Renewal Report" : type === "upgrades" ? "Plan Upgrade Report" : "Plan Downgrade Report", ["Date", "Tenant", "From", "To", "Amount", "By"], rows.map((h) => [h.at.toISOString().slice(0, 10), tmap.get(h.subscription.tenantId) ?? "—", h.fromPlan ?? "", h.toPlan ?? "", num(h.amount), h.byName ?? ""]));
    }
    case "workspaces": { const rows = await prisma.tenantWorkspace.findMany({ orderBy: { id: "desc" }, take: 2000 }); const tids = [...new Set(rows.map((r) => r.tenantId))]; const tmap = new Map((await prisma.tenant.findMany({ where: { id: { in: tids } }, select: { id: true, name: true } })).map((t) => [t.id, t.name])); return T("Workspace Report", ["Code", "Tenant", "Name", "Type", "Status"], rows.map((w) => [w.code, tmap.get(w.tenantId) ?? "—", w.name, w.type, w.status])); }
    case "licenses": { const rows = await prisma.licenseConfiguration.findMany({ orderBy: { tenantId: "asc" }, take: 2000 }); const tmap = new Map((await prisma.tenant.findMany({ where: { id: { in: rows.map((r) => r.tenantId) } }, select: { id: true, name: true } })).map((t) => [t.id, t.name])); return T("License Report", ["Tenant", "Max Users", "Max Storage", "Status", "Valid To"], rows.map((l) => [tmap.get(l.tenantId) ?? "—", l.maxUsers, `${l.maxStorageMb} MB`, l.status, l.validTo ?? "—"])); }
    case "revenue": { const rows = await prisma.subscriptionPayment.findMany({ orderBy: { id: "desc" }, take: 5000 }); const tmap = new Map((await prisma.tenant.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.tenantId))] } }, select: { id: true, name: true } })).map((t) => [t.id, t.name])); const total = rows.reduce((a, r) => a + num(r.amount), 0); return T("Revenue Report", ["Payment No", "Date", "Tenant", "Mode", "Amount"], [...rows.map((p) => [p.paymentNo, p.paymentDate, tmap.get(p.tenantId) ?? "—", p.mode, num(p.amount)]), ["", "", "", "TOTAL", r2(total)]]); }
    case "growth": { const d = await getDashboard(); return T("Customer Growth Report", ["Month", "New Tenants"], d.growth.map((g) => [g.name, g.value])); }
    case "usage": { const rows = await listUsageAll(); return T("Usage Report", ["Tenant", "Users", "Products", "Transactions", "Storage (MB)", "API Usage"], rows.map((u) => [u.tenantName, u.userCount, u.products, u.transactions, u.storageMb, u.apiUsage])); }
    default: return T("Report", [], []);
  }
}
