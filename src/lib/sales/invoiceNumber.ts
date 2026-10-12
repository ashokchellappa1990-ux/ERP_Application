import type { Prisma } from "@prisma/client";
import { DEFAULT_SALES_CONFIG, type SalesConfigData } from "@/lib/settings/salesConfigDefaults";

/**
 * Server-side bill-number generator. The invoice number is composed purely from
 * the tenant's Sales Settings (prefix · branch · year/FY · month · running no.)
 * and a persistent running counter that resets per the configured frequency.
 *
 * This is the single source of truth for sales invoice numbers — the POS sale
 * route and any future B2B billing call it so numbers always obey the config.
 */

/** Period bucket the running counter belongs to (counter resets when this rolls over). */
function periodKey(resetFrequency: string, d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based
  switch (resetFrequency) {
    case "daily": return `${y}-${String(m + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    case "monthly": return `${y}-${String(m + 1).padStart(2, "0")}`;
    case "quarterly": return `${y}-Q${Math.floor(m / 3) + 1}`;
    case "calendar_year": return `CY${y}`;
    case "financial_year": return `FY${m >= 3 ? y : y - 1}`; // FY starts April (month index 3)
    case "never": default: return "ALL";
  }
}

/** Render the year / financial-year segment per the configured format. */
function yearToken(fmt: string, d: Date): string {
  const y = d.getFullYear();
  const fyStart = d.getMonth() >= 3 ? y : y - 1;
  const fyEnd = fyStart + 1;
  switch (fmt) {
    case "fy_full": return `${fyStart}-${fyEnd}`;
    case "cal_full": return `${y}`;
    case "cal_short": return String(y).slice(-2);
    case "fy_short": default: return `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
  }
}

function compose(cfg: SalesConfigData, series: "b2c" | "b2b", n: number, now: Date, branchCode: string | null): string {
  const f = cfg.fields ?? {};
  const fl = cfg.flags ?? {};
  const parts: string[] = [];
  const prefix = (series === "b2b" ? f.b2bSeries : f.b2cSeries)?.replace(/[\s/_-]+$/, "");
  if (prefix) parts.push(prefix);
  // Branch segment comes from the Branch master (the logged-in branch's code),
  // not a configured sample — so each branch's invoices carry its own code.
  if (fl.includeBranchInNumber && branchCode) parts.push(branchCode);
  if (fl.includeFyInNumber) parts.push(yearToken(f.yearFormat || "fy_short", now));
  if (fl.includeMonthInNumber) parts.push(String(now.getMonth() + 1).padStart(2, "0"));
  parts.push(String(n).padStart(Math.max(1, Number(f.seqPadding) || 4), "0"));
  return parts.join(f.seqSeparator ?? "/");
}

/**
 * Reserve and return the next invoice number for this tenant + series, inside the
 * caller's transaction. Uses SELECT … FOR UPDATE so concurrent sales never collide.
 */
export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  tenantId: number,
  series: "b2c" | "b2b" = "b2c",
  scope?: { businessId: number | null; branchId: number | null },
): Promise<string> {
  // Resolve the effective sales setting for the active business/branch (override
  // precedence) so the bill series + counter are per-branch when configured.
  const biz = scope?.businessId ?? null;
  const br = scope?.branchId ?? null;
  const row =
    (br != null ? await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: br } }) : null) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: null } })) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: null, branchId: null } })) ??
    (await tx.salesSetting.create({ data: { tenantId, businessId: biz, branchId: null, config: DEFAULT_SALES_CONFIG as unknown as Prisma.InputJsonValue } }));
  // Lock that exact row for the counter read+write.
  const locked = await tx.$queryRawUnsafe<Array<{ seqB2c: number; seqB2b: number; seqPeriod: string | null }>>(
    "SELECT `seqB2c`, `seqB2b`, `seqPeriod` FROM `sales_settings` WHERE `id` = ? FOR UPDATE",
    row.id,
  );
  const cfg = (row.config ?? DEFAULT_SALES_CONFIG) as unknown as SalesConfigData;
  const f = cfg.fields ?? {};
  const fl = cfg.flags ?? {};

  // The branch code for the number is read from the Branch master for the active
  // branch (falls back to nothing when the sale isn't branch-scoped).
  const branchCode = br != null
    ? ((await tx.branch.findUnique({ where: { id: br }, select: { code: true } }))?.code ?? null)
    : null;

  const now = new Date();
  const start = Math.max(1, Number(f.seqStart) || 1);
  const curPeriod = periodKey(f.resetFrequency || "never", now);
  const cur = locked[0] ?? { seqB2c: 0, seqB2b: 0, seqPeriod: null };

  // Reset counters when the period rolls over.
  let seqB2c = cur.seqPeriod === curPeriod ? cur.seqB2c : 0;
  let seqB2b = cur.seqPeriod === curPeriod ? cur.seqB2b : 0;

  // Separate B2B series only when explicitly enabled; otherwise B2B shares B2C's run.
  const useB2bCounter = !!fl.separateB2bSequence && series === "b2b";
  let n = useB2bCounter ? seqB2b : seqB2c;
  if (n < start) n = start; // 0 / uninitialised → first number is the configured start
  const assigned = n;
  if (useB2bCounter) seqB2b = assigned + 1; else seqB2c = assigned + 1;

  await tx.salesSetting.update({
    where: { id: row.id },
    data: { seqB2c, seqB2b, seqPeriod: curPeriod },
  });

  return compose(cfg, series, assigned, now, branchCode);
}

/** Compose a sales-return number — prefix (config `returnSeries`, default SR) +
 * optional branch / FY / month segments + a zero-padded running number. */
function composeReturn(cfg: SalesConfigData, n: number, now: Date, branchCode: string | null): string {
  const f = cfg.fields ?? {};
  const fl = cfg.flags ?? {};
  const parts: string[] = [];
  const prefix = (f.returnSeries || "SR").replace(/[\s/_-]+$/, "");
  if (prefix) parts.push(prefix);
  if (fl.includeBranchInNumber && branchCode) parts.push(branchCode);
  if (fl.includeFyInNumber) parts.push(yearToken(f.yearFormat || "fy_short", now));
  if (fl.includeMonthInNumber) parts.push(String(now.getMonth() + 1).padStart(2, "0"));
  parts.push(String(n).padStart(Math.max(1, Number(f.seqPadding) || 4), "0"));
  return parts.join(f.seqSeparator ?? "/");
}

/**
 * Reserve and return the next sales-return number for this tenant (per the active
 * business/branch sales settings). Uses its own continuous `seqReturn` counter
 * (decoupled from the invoice period-reset so it never disturbs bill numbering).
 */
export async function nextReturnNumber(
  tx: Prisma.TransactionClient,
  tenantId: number,
  scope?: { businessId: number | null; branchId: number | null },
): Promise<string> {
  const biz = scope?.businessId ?? null;
  const br = scope?.branchId ?? null;
  const row =
    (br != null ? await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: br } }) : null) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: null } })) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: null, branchId: null } })) ??
    (await tx.salesSetting.create({ data: { tenantId, businessId: biz, branchId: null, config: DEFAULT_SALES_CONFIG as unknown as Prisma.InputJsonValue } }));
  const locked = await tx.$queryRawUnsafe<Array<{ seqReturn: number }>>(
    "SELECT `seqReturn` FROM `sales_settings` WHERE `id` = ? FOR UPDATE",
    row.id,
  );
  const cfg = (row.config ?? DEFAULT_SALES_CONFIG) as unknown as SalesConfigData;
  const f = cfg.fields ?? {};
  const branchCode = br != null
    ? ((await tx.branch.findUnique({ where: { id: br }, select: { code: true } }))?.code ?? null)
    : null;

  const now = new Date();
  const start = Math.max(1, Number(f.seqStart) || 1);
  const assigned = Math.max(start, locked[0]?.seqReturn ?? 0);
  await tx.salesSetting.update({ where: { id: row.id }, data: { seqReturn: assigned + 1 } });
  return composeReturn(cfg, assigned, now, branchCode);
}

/** Compose a sales-cancellation number — prefix (config `cancellationSeries`,
 * default SC) + optional branch / FY / month segments + a zero-padded running no. */
function composeCancellation(cfg: SalesConfigData, n: number, now: Date, branchCode: string | null): string {
  const f = cfg.fields ?? {};
  const fl = cfg.flags ?? {};
  const parts: string[] = [];
  const prefix = (f.cancellationSeries || "SC").replace(/[\s/_-]+$/, "");
  if (prefix) parts.push(prefix);
  if (fl.includeBranchInNumber && branchCode) parts.push(branchCode);
  if (fl.includeFyInNumber) parts.push(yearToken(f.yearFormat || "fy_short", now));
  if (fl.includeMonthInNumber) parts.push(String(now.getMonth() + 1).padStart(2, "0"));
  parts.push(String(n).padStart(Math.max(1, Number(f.seqPadding) || 4), "0"));
  return parts.join(f.seqSeparator ?? "/");
}

/**
 * Reserve and return the next sales-cancellation number for this tenant (per the
 * active business/branch sales settings). Uses its own continuous `seqCancellation`
 * counter (decoupled from invoice/return numbering).
 */
export async function nextCancellationNumber(
  tx: Prisma.TransactionClient,
  tenantId: number,
  scope?: { businessId: number | null; branchId: number | null },
): Promise<string> {
  const biz = scope?.businessId ?? null;
  const br = scope?.branchId ?? null;
  const row =
    (br != null ? await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: br } }) : null) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: null } })) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: null, branchId: null } })) ??
    (await tx.salesSetting.create({ data: { tenantId, businessId: biz, branchId: null, config: DEFAULT_SALES_CONFIG as unknown as Prisma.InputJsonValue } }));
  const locked = await tx.$queryRawUnsafe<Array<{ seqCancellation: number }>>(
    "SELECT `seqCancellation` FROM `sales_settings` WHERE `id` = ? FOR UPDATE",
    row.id,
  );
  const cfg = (row.config ?? DEFAULT_SALES_CONFIG) as unknown as SalesConfigData;
  const f = cfg.fields ?? {};
  const branchCode = br != null
    ? ((await tx.branch.findUnique({ where: { id: br }, select: { code: true } }))?.code ?? null)
    : null;
  const now = new Date();
  const start = Math.max(1, Number(f.seqStart) || 1);
  const assigned = Math.max(start, locked[0]?.seqCancellation ?? 0);
  await tx.salesSetting.update({ where: { id: row.id }, data: { seqCancellation: assigned + 1 } });
  return composeCancellation(cfg, assigned, now, branchCode);
}

/** Compose a sales-exchange number — prefix (config `exchangeSeries`, default SE) +
 * optional branch / FY / month segments + a zero-padded running number. */
function composeExchange(cfg: SalesConfigData, n: number, now: Date, branchCode: string | null): string {
  const f = cfg.fields ?? {};
  const fl = cfg.flags ?? {};
  const parts: string[] = [];
  const prefix = (f.exchangeSeries || "SE").replace(/[\s/_-]+$/, "");
  if (prefix) parts.push(prefix);
  if (fl.includeBranchInNumber && branchCode) parts.push(branchCode);
  if (fl.includeFyInNumber) parts.push(yearToken(f.yearFormat || "fy_short", now));
  if (fl.includeMonthInNumber) parts.push(String(now.getMonth() + 1).padStart(2, "0"));
  parts.push(String(n).padStart(Math.max(1, Number(f.seqPadding) || 4), "0"));
  return parts.join(f.seqSeparator ?? "/");
}

/**
 * Reserve and return the next sales-exchange number for this tenant (per the active
 * business/branch sales settings). Uses its own continuous `seqExchange` counter.
 */
export async function nextExchangeNumber(
  tx: Prisma.TransactionClient,
  tenantId: number,
  scope?: { businessId: number | null; branchId: number | null },
): Promise<string> {
  const biz = scope?.businessId ?? null;
  const br = scope?.branchId ?? null;
  const row =
    (br != null ? await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: br } }) : null) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: null } })) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: null, branchId: null } })) ??
    (await tx.salesSetting.create({ data: { tenantId, businessId: biz, branchId: null, config: DEFAULT_SALES_CONFIG as unknown as Prisma.InputJsonValue } }));
  const locked = await tx.$queryRawUnsafe<Array<{ seqExchange: number }>>(
    "SELECT `seqExchange` FROM `sales_settings` WHERE `id` = ? FOR UPDATE",
    row.id,
  );
  const cfg = (row.config ?? DEFAULT_SALES_CONFIG) as unknown as SalesConfigData;
  const f = cfg.fields ?? {};
  const branchCode = br != null
    ? ((await tx.branch.findUnique({ where: { id: br }, select: { code: true } }))?.code ?? null)
    : null;

  const now = new Date();
  const start = Math.max(1, Number(f.seqStart) || 1);
  const assigned = Math.max(start, locked[0]?.seqExchange ?? 0);
  await tx.salesSetting.update({ where: { id: row.id }, data: { seqExchange: assigned + 1 } });
  return composeExchange(cfg, assigned, now, branchCode);
}
