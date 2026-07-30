import type { Prisma } from "@prisma/client";
import { DEFAULT_SALES_CONFIG, type SalesConfigData } from "@/lib/settings/salesConfigDefaults";
import type { SalesDocType } from "@/lib/contracts/salesDoc";

/** Year / FY segment (matches invoiceNumber.ts formats). */
function yearToken(fmt: string, d: Date): string {
  const y = d.getFullYear();
  const fyStart = d.getMonth() >= 3 ? y : y - 1;
  switch (fmt) {
    case "fy_full": return `${fyStart}-${fyStart + 1}`;
    case "cal_full": return `${y}`;
    case "cal_short": return String(y).slice(-2);
    case "fy_short": default: return `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;
  }
}

function compose(cfg: SalesConfigData, docType: SalesDocType, n: number, now: Date, branchCode: string | null): string {
  const f = cfg.fields ?? {};
  const fl = cfg.flags ?? {};
  const parts: string[] = [];
  const configuredPrefix = docType === "order" ? (f as Record<string, string>).orderSeries : (f as Record<string, string>).quotationSeries;
  const prefix = (configuredPrefix || (docType === "order" ? "SO" : "SQ")).replace(/[\s/_-]+$/, "");
  if (prefix) parts.push(prefix);
  if (fl.includeBranchInNumber && branchCode) parts.push(branchCode);
  if (fl.includeFyInNumber) parts.push(yearToken(f.yearFormat || "fy_short", now));
  if (fl.includeMonthInNumber) parts.push(String(now.getMonth() + 1).padStart(2, "0"));
  parts.push(String(n).padStart(Math.max(1, Number(f.seqPadding) || 4), "0"));
  return parts.join(f.seqSeparator ?? "/");
}

/**
 * Reserve + return the next document number for a Sales Quotation / Order, in the
 * caller's transaction (SELECT … FOR UPDATE so concurrent creates never collide).
 * Uses its own `seqQuotation` / `seqOrder` counter (decoupled from invoice numbers).
 */
export async function nextSalesDocNumber(
  tx: Prisma.TransactionClient,
  tenantId: number,
  docType: SalesDocType,
  scope?: { businessId: number | null; branchId: number | null },
): Promise<string> {
  const biz = scope?.businessId ?? null;
  const br = scope?.branchId ?? null;
  const row =
    (br != null ? await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: br } }) : null) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: biz, branchId: null } })) ??
    (await tx.salesSetting.findFirst({ where: { tenantId, businessId: null, branchId: null } })) ??
    (await tx.salesSetting.create({ data: { tenantId, businessId: biz, branchId: null, config: DEFAULT_SALES_CONFIG as unknown as Prisma.InputJsonValue } }));

  const col = docType === "order" ? "seqOrder" : "seqQuotation";
  const locked = await tx.$queryRawUnsafe<Array<Record<string, number>>>(
    `SELECT \`${col}\` AS seq FROM \`sales_settings\` WHERE \`id\` = ? FOR UPDATE`,
    row.id,
  );
  const cfg = (row.config ?? DEFAULT_SALES_CONFIG) as unknown as SalesConfigData;
  const f = cfg.fields ?? {};
  const branchCode = br != null
    ? ((await tx.branch.findUnique({ where: { id: br }, select: { code: true } }))?.code ?? null)
    : null;

  const now = new Date();
  const start = Math.max(1, Number(f.seqStart) || 1);
  const assigned = Math.max(start, Number(locked[0]?.seq) || 0);
  await tx.salesSetting.update({ where: { id: row.id }, data: { [col]: assigned + 1 } });
  return compose(cfg, docType, assigned, now, branchCode);
}
