import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { writeAudit, type AuditActor } from "@/lib/audit/log";
import { fyDateRange, fyMonthRange } from "@/lib/finance/budgetService";
import {
  MONTH_KEYS, DEFAULT_TARGET_CONFIG, type TargetConfig, type TargetStatus, TARGET_NEXT, isEditable, isLocked,
  needsTargetApproval, trafficLight, targetTypeDef, dimensionDef, type AchievementResult, type AchievementLine,
} from "@/lib/contracts/salesTarget";
import { distribute, sumMonths, type DistMethod } from "./distribution";
import { measure, type MeasureSpec } from "./measure";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthCols = (m: number[]) => Object.fromEntries(MONTH_KEYS.map((k, i) => [k, r2(m[i] ?? 0)]));
const monthsOf = (l: Record<string, unknown>) => MONTH_KEYS.map((k) => num(l[k]));

/* -------------------------------------------------------------- config -- */
export async function getConfig(scope: ActiveScope): Promise<TargetConfig> {
  const row = (await prisma.salesTargetConfig.findFirst({ where: { tenantId: scope.tenantId, businessId: scope.businessId, branchId: null } }))
    ?? (await prisma.salesTargetConfig.findFirst({ where: { tenantId: scope.tenantId, businessId: null, branchId: null } }));
  return { ...DEFAULT_TARGET_CONFIG, ...((row?.config as Partial<TargetConfig>) ?? {}) };
}
export async function saveConfig(scope: ActiveScope, patch: Partial<TargetConfig>): Promise<TargetConfig> {
  const cur = await getConfig(scope);
  const merged = { ...cur, ...patch };
  const existing = await prisma.salesTargetConfig.findFirst({ where: { tenantId: scope.tenantId, businessId: scope.businessId, branchId: null } });
  if (existing) await prisma.salesTargetConfig.update({ where: { id: existing.id }, data: { config: merged as unknown as Prisma.InputJsonValue } });
  else await prisma.salesTargetConfig.create({ data: { tenantId: scope.tenantId, businessId: scope.businessId, branchId: null, config: merged as unknown as Prisma.InputJsonValue } });
  return merged;
}

/* ------------------------------------------------------------- numbering -- */
async function nextTargetNumber(tx: Prisma.TransactionClient, scope: ActiveScope, cfg: TargetConfig, fy: string): Promise<string> {
  const scopeKey = String(scope.businessId ?? 0);
  await tx.$executeRawUnsafe(`INSERT INTO sales_target_counters (tenantId, scopeKey, seq) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE seq = seq`, scope.tenantId, scopeKey);
  const locked = await tx.$queryRawUnsafe<Array<{ seq: number }>>(`SELECT seq FROM sales_target_counters WHERE tenantId = ? AND scopeKey = ? FOR UPDATE`, scope.tenantId, scopeKey);
  const n = Number(locked[0]?.seq || 0) + 1;
  await tx.$executeRawUnsafe(`UPDATE sales_target_counters SET seq = ? WHERE tenantId = ? AND scopeKey = ?`, n, scope.tenantId, scopeKey);
  const fyTok = (fy.match(/\d{2}\s*-\s*\d{2}/)?.[0] || fy).replace(/\s/g, "");
  return `${cfg.numberPrefix}/${fyTok}/${String(n).padStart(cfg.numberPadding, "0")}`;
}

/* ---------------------------------------------------- distribution helper -- */
/** Prior-FY monthly actuals for a line (used by the "historical" distribution method). */
async function historicalMonthly(scope: ActiveScope, spec: MeasureSpec, fy: string): Promise<number[]> {
  const priorFy = shiftFy(fy, -1);
  const out: number[] = [];
  for (const k of MONTH_KEYS) { const { start, end } = fyMonthRange(priorFy, k as never); const m = await measure(scope, spec, start, end); out.push(m.actual ?? 0); }
  return out;
}
function shiftFy(fy: string, delta: number): string {
  const m = /(\d{2})\s*-\s*(\d{2})/.exec(fy); if (!m) return fy;
  const a = Number(m[1]) + delta, b = Number(m[2]) + delta;
  return `FY ${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
}

export async function buildLineMonths(scope: ActiveScope, header: { targetType: string; distribution: string; fy: string }, line: { dimensionType: string; dimensionRefId?: number | null; dimensionValue?: string | null; annual: number; months?: number[] }): Promise<number[]> {
  const spec: MeasureSpec = { dimensionType: line.dimensionType, dimensionRefId: line.dimensionRefId, dimensionValue: line.dimensionValue, targetType: header.targetType };
  const opts: Parameters<typeof distribute>[2] = {};
  if (header.distribution === "manual" && line.months) opts.manual = line.months;
  if (header.distribution === "seasonal") { const cfg = await getConfig(scope); opts.seasonalWeights = cfg.seasonalWeights; }
  if (header.distribution === "historical") opts.historicalMonthly = await historicalMonthly(scope, spec, header.fy).catch(() => []);
  if (header.distribution === "percentage" && line.months) opts.percentages = line.months; // months carry the % weights
  return distribute(line.annual, header.distribution as DistMethod, opts);
}

/* --------------------------------------------------------------- create -- */
export interface CreateInput {
  fy: string; businessId?: number | null; branchId?: number | null; title?: string;
  dimension: string; targetType: string; period: string; distribution: string; currency?: string;
  fromDate?: string | null; toDate?: string | null; remarks?: string;
  lines: { dimensionType: string; dimensionRefId?: number | null; dimensionValue?: string | null; dimensionLabel?: string | null; parentRefId?: number | null; annual: number; months?: number[] }[];
}

export async function createTarget(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, input: CreateInput) {
  const cfg = await getConfig(scope);
  const lineMonths = await Promise.all(input.lines.map((l) => buildLineMonths(scope, input, l)));
  const total = r2(input.lines.reduce((s, l) => s + num(l.annual), 0));
  return prisma.$transaction(async (tx) => {
    const targetNo = await nextTargetNumber(tx, scope, cfg, input.fy);
    const t = await tx.salesTarget.create({
      data: {
        tenantId: scope.tenantId, businessId: input.businessId ?? scope.businessId, branchId: input.branchId ?? null,
        targetNo, fy: input.fy, title: input.title, dimension: input.dimension, targetType: input.targetType, period: input.period,
        distribution: input.distribution, currency: input.currency ?? "INR", fromDate: input.fromDate ?? null, toDate: input.toDate ?? null,
        totalTarget: total, status: "Draft", approvalStatus: "NotRequired", remarks: input.remarks,
        createdBy: user?.id ?? null, createdByName: user?.fullName ?? null,
        lines: { create: input.lines.map((l, i) => ({ tenantId: scope.tenantId, dimensionType: l.dimensionType, dimensionRefId: l.dimensionRefId ?? null, dimensionValue: l.dimensionValue ?? null, dimensionLabel: l.dimensionLabel ?? null, parentRefId: l.parentRefId ?? null, annual: r2(l.annual), ...monthCols(lineMonths[i]) })) },
      },
      include: { lines: true },
    });
    await writeAudit(tx, user, { action: "sales_target.create", entity: "SalesTarget", entityId: t.id, summary: `Created target ${targetNo} (${input.dimension}/${input.targetType}) = ${total}`, businessId: t.businessId, branchId: t.branchId, meta: { total, lines: input.lines.length } });
    return t;
  });
}

export async function updateTarget(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, id: number, input: CreateInput) {
  const existing = await prisma.salesTarget.findFirst({ where: { id, tenantId: scope.tenantId } });
  if (!existing) throw new Error("Target not found.");
  if (!isEditable(existing.status)) throw new Error(`A ${existing.status} target cannot be edited — use Revision.`);
  const header = { fy: input.fy || existing.fy, targetType: input.targetType || existing.targetType, distribution: input.distribution || existing.distribution };
  const lineMonths = await Promise.all(input.lines.map((l) => buildLineMonths(scope, header, l)));
  const total = r2(input.lines.reduce((s, l) => s + num(l.annual), 0));
  return prisma.$transaction(async (tx) => {
    await tx.salesTargetLine.deleteMany({ where: { targetId: id } });
    const t = await tx.salesTarget.update({
      where: { id }, include: { lines: true },
      data: {
        fy: header.fy, title: input.title, dimension: input.dimension, targetType: header.targetType, period: input.period,
        distribution: header.distribution, currency: input.currency ?? existing.currency, fromDate: input.fromDate ?? null, toDate: input.toDate ?? null,
        totalTarget: total, remarks: input.remarks,
        lines: { create: input.lines.map((l, i) => ({ tenantId: scope.tenantId, dimensionType: l.dimensionType, dimensionRefId: l.dimensionRefId ?? null, dimensionValue: l.dimensionValue ?? null, dimensionLabel: l.dimensionLabel ?? null, parentRefId: l.parentRefId ?? null, annual: r2(l.annual), ...monthCols(lineMonths[i]) })) },
      },
    });
    await writeAudit(tx, user, { action: "sales_target.update", entity: "SalesTarget", entityId: id, summary: `Updated target ${existing.targetNo} = ${total}`, businessId: t.businessId, branchId: t.branchId });
    return t;
  });
}

/* -------------------------------------------------------- status actions -- */
export async function targetAction(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, id: number, action: string, remarks?: string) {
  const t = await prisma.salesTarget.findFirst({ where: { id, tenantId: scope.tenantId } });
  if (!t) throw new Error("Target not found.");
  const cfg = await getConfig(scope);
  let next = TARGET_NEXT[t.status as TargetStatus]?.[action];
  if (!next) throw new Error(`Action "${action}" not allowed from ${t.status}.`);
  const data: Prisma.SalesTargetUpdateInput = { status: next };

  if (action === "submit") {
    const need = needsTargetApproval(num(t.totalTarget), cfg);
    if (!need) { next = "Approved"; data.status = "Approved"; data.approvalStatus = "Approved"; data.approvedAt = new Date(); data.approvedBy = user?.id ?? null; data.approvedByName = user?.fullName ?? null; }
    else { data.approvalStatus = "Pending"; data.submittedAt = new Date(); data.submittedBy = user?.id ?? null; }
  } else if (action === "approve") { data.approvalStatus = "Approved"; data.approvedAt = new Date(); data.approvedBy = user?.id ?? null; data.approvedByName = user?.fullName ?? null; }
  else if (action === "reject") { data.approvalStatus = "Rejected"; data.rejectedBy = user?.id ?? null; data.rejectReason = remarks ?? null; }
  else if (action === "return") { data.returnedAt = new Date(); }
  else if (action === "reopen") { data.approvalStatus = "NotRequired"; }
  else if (action === "lock") { data.lockedAt = new Date(); }
  else if (action === "cancel") { data.cancelledAt = new Date(); }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.salesTarget.update({ where: { id }, data });
    await tx.salesTargetApproval.create({ data: { tenantId: scope.tenantId, targetId: id, action: cap(action), actorId: user?.id ?? null, actorName: user?.fullName ?? null, remarks: remarks ?? null } });
    await writeAudit(tx, user, { action: `sales_target.${action}`, entity: "SalesTarget", entityId: id, summary: `${cap(action)} target ${t.targetNo} → ${u.status}`, businessId: t.businessId, branchId: t.branchId, meta: { remarks } });
    return u;
  });
  return updated;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------- revision -- */
export async function createRevision(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, targetId: number, input: { lineId?: number | null; revisionType: "increase" | "decrease"; revisedTarget: number; reason?: string; effectiveDate?: string | null; remarks?: string }) {
  const t = await prisma.salesTarget.findFirst({ where: { id: targetId, tenantId: scope.tenantId }, include: { lines: true } });
  if (!t) throw new Error("Target not found.");
  if (!isLocked(t.status)) throw new Error("Only approved/locked targets can be revised.");
  const line = input.lineId ? t.lines.find((l) => l.id === input.lineId) : null;
  const previous = line ? num(line.annual) : num(t.totalTarget);
  const revised = r2(input.revisedTarget);
  const count = await prisma.salesTargetRevision.count({ where: { tenantId: scope.tenantId, targetId } });
  const revisionNo = `${t.targetNo}-R${count + 1}`;
  return prisma.$transaction(async (tx) => {
    const rev = await tx.salesTargetRevision.create({
      data: {
        tenantId: scope.tenantId, targetId, lineId: input.lineId ?? null, revisionNo, revisionDate: todayIso(),
        dimensionLabel: line?.dimensionLabel ?? "Overall", revisionType: input.revisionType, previousTarget: previous, revisedTarget: revised, difference: r2(revised - previous),
        reason: input.reason ?? null, effectiveDate: input.effectiveDate ?? null, remarks: input.remarks ?? null, status: "Pending",
        requestedBy: user?.id ?? null, requestedByName: user?.fullName ?? null,
      },
    });
    await writeAudit(tx, user, { action: "sales_target.revision.create", entity: "SalesTargetRevision", entityId: rev.id, summary: `Revision ${revisionNo}: ${previous} → ${revised}`, businessId: t.businessId, branchId: t.branchId });
    return rev;
  });
}

export async function revisionAction(scope: ActiveScope, user: AuditActor & { fullName?: string | null }, revisionId: number, action: "approve" | "reject", remarks?: string) {
  const rev = await prisma.salesTargetRevision.findFirst({ where: { id: revisionId, tenantId: scope.tenantId }, include: { target: { include: { lines: true } } } });
  if (!rev) throw new Error("Revision not found.");
  if (rev.status !== "Pending") throw new Error("Revision already processed.");
  return prisma.$transaction(async (tx) => {
    if (action === "reject") {
      const u = await tx.salesTargetRevision.update({ where: { id: revisionId }, data: { status: "Rejected", rejectedBy: user?.id ?? null, rejectReason: remarks ?? null } });
      await writeAudit(tx, user, { action: "sales_target.revision.reject", entity: "SalesTargetRevision", entityId: revisionId, summary: `Rejected revision ${rev.revisionNo}` });
      return u;
    }
    // approve → apply the revised value to the line (or the whole target's single-line/total) + re-distribute + bump header total
    const revised = num(rev.revisedTarget);
    if (rev.lineId) {
      const line = rev.target.lines.find((l) => l.id === rev.lineId);
      if (line) {
        const months = await buildLineMonths(scope, { fy: rev.target.fy, targetType: rev.target.targetType, distribution: rev.target.distribution }, { dimensionType: line.dimensionType, dimensionRefId: line.dimensionRefId, dimensionValue: line.dimensionValue, annual: revised });
        await tx.salesTargetLine.update({ where: { id: line.id }, data: { annual: r2(revised), ...monthCols(months) } });
      }
    } else if (rev.target.lines.length === 1) {
      const line = rev.target.lines[0];
      const months = await buildLineMonths(scope, { fy: rev.target.fy, targetType: rev.target.targetType, distribution: rev.target.distribution }, { dimensionType: line.dimensionType, dimensionRefId: line.dimensionRefId, dimensionValue: line.dimensionValue, annual: revised });
      await tx.salesTargetLine.update({ where: { id: line.id }, data: { annual: r2(revised), ...monthCols(months) } });
    }
    const lines = await tx.salesTargetLine.findMany({ where: { targetId: rev.targetId } });
    const newTotal = r2(lines.reduce((s, l) => s + num(l.annual), 0));
    await tx.salesTarget.update({ where: { id: rev.targetId }, data: { totalTarget: newTotal } });
    const u = await tx.salesTargetRevision.update({ where: { id: revisionId }, data: { status: "Approved", approvedBy: user?.id ?? null, approvedAt: new Date() } });
    await writeAudit(tx, user, { action: "sales_target.revision.approve", entity: "SalesTargetRevision", entityId: revisionId, summary: `Approved revision ${rev.revisionNo}; target total → ${newTotal}`, businessId: rev.target.businessId, branchId: rev.target.branchId });
    return u;
  });
}

/* ---------------------------------------------------------- achievement -- */
export async function computeAchievement(scope: ActiveScope, id: number): Promise<AchievementResult> {
  const t = await prisma.salesTarget.findFirst({ where: { id, tenantId: scope.tenantId }, include: { lines: true } });
  if (!t) throw new Error("Target not found.");
  const tdef = targetTypeDef(t.targetType);
  const unit = tdef?.unit ?? "money";
  const { start, end } = t.period === "custom" && t.fromDate && t.toDate ? { start: t.fromDate, end: t.toDate } : fyDateRange(t.fy);
  const td = todayIso();
  const asOf = td < start ? start : td > end ? end : td;
  const daysTotal = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1);
  const daysElapsed = Math.max(0, Math.min(daysTotal, Math.round((Date.parse(asOf) - Date.parse(start)) / 864e5) + 1));
  const timePct = r2((daysElapsed / daysTotal) * 100);
  const cfg = await getConfig(scope);
  const isRate = unit === "percent" || t.targetType === "avgInvoiceValue" || t.targetType === "avgOrderValue";

  const lines: AchievementLine[] = await Promise.all(t.lines.map(async (l) => {
    const spec: MeasureSpec = { dimensionType: l.dimensionType, dimensionRefId: l.dimensionRefId, dimensionValue: l.dimensionValue, targetType: t.targetType };
    const def = dimensionDef(l.dimensionType);
    const annual = num(l.annual);
    const m = await measure(scope, spec, start, asOf);
    const computable = m.computable && def?.computable !== false;
    const actual = m.actual ?? 0;
    // elapsed (pro-rated) target for pace-based achievement; rate types compare directly to the annual figure
    const elapsedTarget = isRate ? annual : r2(monthsOf(l as never).reduce((s, v, i) => { const mr = fyMonthRange(t.fy, MONTH_KEYS[i] as never); if (mr.end <= asOf) return s + v; if (mr.start <= asOf) { const frac = (Date.parse(asOf) - Date.parse(mr.start)) / (Date.parse(mr.end) - Date.parse(mr.start) || 1); return s + v * Math.max(0, Math.min(1, frac)); } return s; }, 0));
    const denom = isRate ? annual : elapsedTarget;
    const achievementPct = denom > 0 ? r2((actual / denom) * 100) : 0;
    const remaining = r2(Math.max(0, annual - actual));
    const remainingDays = Math.max(1, daysTotal - daysElapsed);
    const forecast = isRate ? actual : r2(timePct > 0 ? (actual / timePct) * 100 : 0);
    return {
      lineId: l.id, dimensionType: l.dimensionType, label: l.dimensionLabel || def?.label || l.dimensionType, computable,
      target: r2(annual), actual: r2(actual), achievementPct, variance: r2(actual - denom), remaining,
      requiredDaily: isRate ? 0 : r2(remaining / remainingDays), requiredWeekly: isRate ? 0 : r2((remaining / remainingDays) * 7), requiredMonthly: isRate ? 0 : r2((remaining / remainingDays) * 30),
      forecast, forecastPct: annual > 0 ? r2((forecast / annual) * 100) : 0, growthPct: 0, band: trafficLight(achievementPct, cfg.trafficLight).band,
    };
  }));

  const totalTarget = r2(t.lines.reduce((s, l) => s + num(l.annual), 0));
  const totalActual = r2(lines.reduce((s, l) => s + l.actual, 0));
  const achPct = isRate ? (lines.length ? r2(lines.reduce((s, l) => s + l.achievementPct, 0) / lines.length) : 0) : totalTarget > 0 ? r2((totalActual / totalTarget) * 100) : 0;
  return { targetId: t.id, targetNo: t.targetNo, targetType: t.targetType, unit, period: t.period, fy: t.fy, totalTarget, totalActual, achievementPct: achPct, band: trafficLight(achPct, cfg.trafficLight).band, daysElapsed, daysTotal, timePct, lines };
}

/* --------------------------------------------------- performance scoring -- */
export interface PerfRow { subjectType: string; subjectRefId: number | null; subjectLabel: string; target: number; actual: number; achievementPct: number; band: string; achievementScore: number; growthScore: number; profitScore: number; consistencyScore: number; completionScore: number; overallScore: number }

export async function performanceAnalysis(scope: ActiveScope, fy: string, opts?: { dimension?: string; persist?: boolean }): Promise<{ fy: string; rows: PerfRow[] }> {
  const where: Prisma.SalesTargetWhereInput = { tenantId: scope.tenantId, fy, status: { in: ["Approved", "Locked", "Completed"] }, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  if (opts?.dimension) where.dimension = opts.dimension;
  const targets = await prisma.salesTarget.findMany({ where, select: { id: true } });
  const agg = new Map<string, PerfRow>();
  for (const { id } of targets) {
    const ach = await computeAchievement(scope, id);
    for (const l of ach.lines) {
      const key = `${l.dimensionType}:${l.lineId}`;
      const forecastGap = Math.abs(l.forecastPct - 100);
      const row: PerfRow = {
        subjectType: l.dimensionType, subjectRefId: l.lineId, subjectLabel: l.label,
        target: l.target, actual: l.actual, achievementPct: l.achievementPct, band: l.band,
        achievementScore: clamp(l.achievementPct), growthScore: clamp(50 + l.growthPct), profitScore: clamp(l.achievementPct),
        consistencyScore: clamp(100 - forecastGap), completionScore: clamp(l.achievementPct),
        overallScore: 0,
      };
      row.overallScore = clamp((row.achievementScore + row.growthScore + row.profitScore + row.consistencyScore + row.completionScore) / 5);
      agg.set(key, row);
    }
  }
  const rows = [...agg.values()].sort((a, b) => b.overallScore - a.overallScore);
  if (opts?.persist) {
    for (const r of rows) {
      await prisma.salesPerformanceScore.upsert({
        where: { tenantId_fy_period_subjectType_subjectRefId_subjectLabel: { tenantId: scope.tenantId, fy, period: "annual", subjectType: r.subjectType, subjectRefId: r.subjectRefId ?? 0, subjectLabel: r.subjectLabel } },
        create: { tenantId: scope.tenantId, businessId: scope.businessId, fy, period: "annual", subjectType: r.subjectType, subjectRefId: r.subjectRefId, subjectLabel: r.subjectLabel, targetValue: r.target, actualValue: r.actual, achievementScore: r.achievementScore, growthScore: r.growthScore, profitScore: r.profitScore, consistencyScore: r.consistencyScore, completionScore: r.completionScore, overallScore: r.overallScore },
        update: { targetValue: r.target, actualValue: r.actual, achievementScore: r.achievementScore, growthScore: r.growthScore, profitScore: r.profitScore, consistencyScore: r.consistencyScore, completionScore: r.completionScore, overallScore: r.overallScore, computedAt: new Date() },
      }).catch(() => {});
    }
  }
  return { fy, rows };
}

/* ---------------------------------------------------------------- lists -- */
export async function listTargets(scope: ActiveScope, f: { fy?: string; status?: string; dimension?: string; targetType?: string; q?: string }) {
  const where: Prisma.SalesTargetWhereInput = { tenantId: scope.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) };
  if (f.fy) where.fy = f.fy;
  if (f.status && f.status !== "All") where.status = f.status;
  if (f.dimension) where.dimension = f.dimension;
  if (f.targetType) where.targetType = f.targetType;
  if (f.q) where.OR = [{ targetNo: { contains: f.q } }, { title: { contains: f.q } }];
  const rows = await prisma.salesTarget.findMany({ where, orderBy: { id: "desc" }, take: 200, include: { _count: { select: { lines: true } } } });
  return rows.map((t) => ({ id: t.id, targetNo: t.targetNo, fy: t.fy, title: t.title, dimension: t.dimension, targetType: t.targetType, period: t.period, distribution: t.distribution, totalTarget: num(t.totalTarget), status: t.status, approvalStatus: t.approvalStatus, lineCount: t._count.lines, createdAt: t.createdAt }));
}
export const sumMonthsExport = sumMonths;
