import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ensureAccounts } from "@/lib/accounting/accounts";
import type { PettyCashConfigDto, ExpenseHeadDto, ExpenseAccountDto } from "@/lib/contracts/finance";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const PERM = "finance.petty-cash";

async function getConfig(tenantId: number) {
  return (
    (await prisma.pettyCashConfig.findUnique({ where: { tenantId } })) ??
    (await prisma.pettyCashConfig.create({ data: { tenantId } }))
  );
}

// GET /api/finance/petty-cash/config — config + expense heads tree + budgets.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  await ensureAccounts(prisma, user.tenantId); // make sure the base expense accounts exist to map to
  const [cfg, heads, budgets, spent, accts] = await Promise.all([
    getConfig(user.tenantId),
    prisma.expenseHead.findMany({ where: sw, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }] }),
    prisma.expenseBudget.findMany({ where: { ...sw, period: "ALL" } }),
    prisma.pettyCashLine.groupBy({ by: ["headId"], where: { ...sw, headId: { not: null } }, _sum: { amount: true } }),
    // Expense/Asset ledger accounts an expense head can post to (Chart of Accounts is tenant-wide).
    prisma.ledgerAccount.findMany({ where: { tenantId: user.tenantId, type: { in: ["Expense", "Asset"] } }, select: { id: true, code: true, name: true, group: true }, orderBy: [{ type: "asc" }, { code: "asc" }] }),
  ]);
  const budgetMap: Record<number, number> = {};
  for (const b of budgets) budgetMap[b.headId] = num(b.amount);
  const actualMap: Record<number, number> = {};
  for (const s of spent) if (s.headId != null) actualMap[s.headId] = num(s._sum.amount);
  const acctById = new Map(accts.map((a) => [a.id, a]));

  const config: PettyCashConfigDto = {
    budgetEnabled: cfg.budgetEnabled, budgetScope: cfg.budgetScope, partySource: cfg.partySource, gstEnabled: cfg.gstEnabled,
    voucherPrefix: cfg.voucherPrefix, voucherPadding: cfg.voucherPadding, voucherSeparator: cfg.voucherSeparator, voucherSeq: cfg.voucherSeq,
    voucherIncludeYear: cfg.voucherIncludeYear, voucherIncludeMonth: cfg.voucherIncludeMonth, voucherYearFormat: cfg.voucherYearFormat, voucherResetFrequency: cfg.voucherResetFrequency,
  };
  const headRows: ExpenseHeadDto[] = heads.map((h) => {
    const a = h.accountId ? acctById.get(h.accountId) : null;
    return { id: h.id, name: h.name, parentId: h.parentId, active: h.active, accountId: h.accountId ?? null, accountCode: a?.code ?? null, accountName: a?.name ?? null, trackBudget: h.trackBudget, linkedFeature: h.linkedFeature ?? null };
  });
  const accounts: ExpenseAccountDto[] = accts.map((a) => ({ id: a.id, code: a.code, name: a.name, group: a.group ?? null }));
  return NextResponse.json({
    ok: true,
    config,
    heads: headRows,
    accounts,
    budgets: budgetMap,
    actuals: actualMap,
  });
}

// PUT /api/finance/petty-cash/config — save config + per-head budgets.
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "PettyCashConfig" });
  if (denied) return denied;

  let b: { budgetEnabled?: boolean; budgetScope?: string; partySource?: string; gstEnabled?: boolean; voucherPrefix?: string; voucherPadding?: number; voucherSeparator?: string; voucherIncludeYear?: boolean; voucherIncludeMonth?: boolean; voucherYearFormat?: string; voucherResetFrequency?: string; budgets?: { headId: number; amount: number | string }[] };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const cur = await getConfig(user.tenantId);
  await prisma.pettyCashConfig.update({
    where: { id: cur.id },
    data: {
      budgetEnabled: !!b.budgetEnabled,
      budgetScope: b.budgetScope === "head" ? "head" : "all",
      partySource: ["supplier", "expense", "both"].includes(String(b.partySource)) ? String(b.partySource) : "both",
      gstEnabled: !!b.gstEnabled,
      voucherPrefix: b.voucherPrefix ? String(b.voucherPrefix).slice(0, 20) : undefined,
      voucherPadding: Number.isFinite(Number(b.voucherPadding)) ? Math.max(1, Math.min(8, Math.round(Number(b.voucherPadding)))) : undefined,
      voucherSeparator: b.voucherSeparator != null ? String(b.voucherSeparator).slice(0, 3) : undefined,
      voucherIncludeYear: !!b.voucherIncludeYear,
      voucherIncludeMonth: !!b.voucherIncludeMonth,
      voucherYearFormat: ["fy_short", "fy_full", "cal_full", "cal_short"].includes(String(b.voucherYearFormat)) ? String(b.voucherYearFormat) : undefined,
      voucherResetFrequency: ["never", "monthly", "financial_year"].includes(String(b.voucherResetFrequency)) ? String(b.voucherResetFrequency) : undefined,
    },
  });

  // Upsert per-head budgets (period ALL). Stamp the active business so the scoped
  // read returns them on reload (same fix as expense heads).
  const bseg = scopeData(await getActiveScope(user));
  for (const item of b.budgets ?? []) {
    const headId = Number(item.headId); const amount = +(num(item.amount)).toFixed(2);
    if (!headId) continue;
    await prisma.expenseBudget.upsert({
      where: { tenantId_headId_period: { tenantId: user.tenantId, headId, period: "ALL" } },
      create: { tenantId: user.tenantId, ...bseg, headId, period: "ALL", amount },
      update: { amount },
    });
  }

  await writeAudit(prisma, user, {
    action: "petty_cash_config.update", entity: "PettyCashConfig", entityId: cur.id,
    summary: "Petty cash configuration saved",
    meta: { budgetEnabled: !!b.budgetEnabled, gstEnabled: !!b.gstEnabled, voucherPrefix: b.voucherPrefix ?? null, budgetCount: (b.budgets ?? []).length },
    ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Petty cash configuration saved." });
}
