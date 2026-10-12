import { prisma } from "@/lib/db/prisma";
import { scopeWhere, type ActiveScope } from "@/lib/auth/scope";
import type { GstHeader } from "@/lib/contracts/gstCompliance";

/** GST compliance shared helpers — periods, scope, money, header, lock state. */

export const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
export const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A tenant + business (GSTIN-level) where fragment. GST is filed per GSTIN, so
 *  reads are business-scoped across all branches (branch is not applied). */
export function bizWhere(scope: ActiveScope): { tenantId: number; businessId?: number } {
  return scope.businessId != null ? { tenantId: scope.tenantId, businessId: scope.businessId } : { tenantId: scope.tenantId };
}

/** Branch-aware where for TRANSACTIONAL reads (sales / purchases / returns). Unlike
 *  bizWhere (whole GSTIN), this respects the login user's branch hierarchy — a
 *  branch-locked user (e.g. a store manager) sees only their branch's contribution,
 *  while a business-level user (all branches in readBranchIds) still sees the whole
 *  GSTIN. Artifact tables (returns / recon / closing) stay business-scoped via bizWhere. */
export function txnWhere(scope: ActiveScope) {
  return scopeWhere(scope, { branch: true });
}

/** The YYYY-MM of the current calendar month. */
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "Jun 2026" for a YYYY-MM period. */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return `${MON[m - 1]} ${y}`;
}

/** First + last calendar day (YYYY-MM-DD) of a YYYY-MM period. */
export function monthRange(period: string): { from: string; to: string } {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` };
}

/** N most-recent periods ending at (and including) `period`, oldest first. */
export function recentPeriods(period: string, count: number): string[] {
  const [y, m] = period.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** A due date in the month AFTER the period, on the given day (YYYY-MM-DD). */
export function dueDate(period: string, day: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m, day); // month index m == next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Basic GSTIN format check (15 chars: 2 state digits + 10 PAN + 3). */
export function isValidGstin(g: string | null | undefined): boolean {
  if (!g) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g.trim().toUpperCase());
}

/** The closing/lock row for a period (or null). */
export async function getClosing(scope: ActiveScope, period: string) {
  return prisma.gstPeriodClosing.findFirst({ where: { ...bizWhere(scope), period }, orderBy: { id: "desc" } });
}

export async function isPeriodLocked(scope: ActiveScope, period: string): Promise<boolean> {
  const c = await getClosing(scope, period);
  return c?.closingStatus === "Locked";
}

/** GSTIN / legal-name / reg-type header, resolved from CompanySetup → Business. */
export async function getGstHeader(scope: ActiveScope, period: string): Promise<GstHeader> {
  const setup = await prisma.companySetup.findFirst({
    where: bizWhere(scope),
    orderBy: { id: "desc" },
    select: { gstNumber: true, gstStateCode: true, gstRegType: true, gstFrequency: true, legalName: true },
  });
  let gstin = setup?.gstNumber ?? "";
  let legalName = setup?.legalName || "";
  if (!gstin && scope.businessId != null) {
    const biz = await prisma.business.findFirst({ where: { id: scope.businessId, tenantId: scope.tenantId }, select: { gstNumber: true, name: true } });
    gstin = biz?.gstNumber ?? "";
    legalName = legalName || biz?.name || "";
  }
  const { from, to } = monthRange(period);
  const closing = await getClosing(scope, period);
  return {
    gstin,
    legalName,
    stateCode: setup?.gstStateCode ?? (gstin ? gstin.slice(0, 2) : ""),
    regType: setup?.gstRegType ?? "Regular",
    filingFrequency: setup?.gstFrequency ?? "Monthly",
    period,
    periodLabel: periodLabel(period),
    fromDate: from,
    toDate: to,
    returnDueDate: dueDate(period, 20),
    gstr1DueDate: dueDate(period, 11),
    periodLocked: closing?.closingStatus === "Locked",
    closingStatus: closing?.closingStatus ?? "Open",
  };
}
