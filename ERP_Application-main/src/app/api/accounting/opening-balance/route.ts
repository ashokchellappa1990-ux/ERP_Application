import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope, type ScopeUser } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { postJournal } from "@/lib/accounting/post";
import { ACC } from "@/lib/accounting/accounts";
import type { OpeningBalanceBankRow, OpeningBalanceResponse, OpeningBalanceSaveResponse } from "@/lib/contracts/accounting";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const PERM = "accounting.opening-balance";
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
const OPENING_SRC = "OPENING_BALANCE";
const OPENING_ID = 1; // opening voucher key (one per business + branch)

// Active business + branch the opening balance is entered for. Opening balances
// are a per-branch figure (cash in hand / bank balances at a location), so every
// saved row and the posted journal are stamped with this scope — which is what
// makes them show up in that branch's finance reports.
async function writeScope(user: ScopeUser): Promise<{ businessId: number | null; branchId: number | null }> {
  const s = await getActiveScope(user);
  return { businessId: s.businessId ?? null, branchId: s.branchId ?? null };
}

interface BankIn { bankId?: number | null; bankName?: string; branch?: string; accountNo?: string; ifsc?: string; amount?: number | string }

// Bank accounts in the active scope:
//   • Branch user  → ONLY their own branch's banks (Branch Setup). Business-level
//                    banks (branchId null) belong to the business, not the branch,
//                    so they are not shown to a branch-locked user.
//   • Business / owner → every bank of their business: business-level banks
//                    (branchId null) + all branch banks, narrowing to a single
//                    branch's banks when a branch is selected in the filter.
async function businessBanks(user: ScopeUser) {
  const [scope, allowed] = await Promise.all([getActiveScope(user), getAllowedScope(user)]);
  // Branch-pinned user: strictly branch-specific banks (no shared business-level
  // banks). Everyone else also gets the business-level (branchId null) banks.
  const branchOr = allowed.lockBranch
    ? [{ branchId: { in: scope.readBranchIds } }]
    : [{ branchId: null }, { branchId: { in: scope.readBranchIds } }];
  return prisma.setupBank.findMany({
    where: {
      setup: { tenantId: user.tenantId },
      ...(scope.businessId ? { businessId: scope.businessId } : {}),
      OR: branchOr,
    },
    orderBy: { id: "asc" },
  });
}

// GET /api/accounting/opening-balance — saved opening balances merged with the
// business's bank accounts (so every configured bank shows a row to fill).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await writeScope(user);
  const [saved, banks] = await Promise.all([
    prisma.openingBalance.findMany({ where: { tenantId: user.tenantId, businessId: scope.businessId, branchId: scope.branchId } }),
    businessBanks(user),
  ]);
  const cashRow = saved.find((s) => s.kind === "CASH");
  const savedBanks = saved.filter((s) => s.kind === "BANK");
  const asOfDate = saved[0]?.asOfDate || new Date().toISOString().slice(0, 10);

  // One row per business bank, pre-filling any saved amount (match by bankId).
  const bankRows: OpeningBalanceBankRow[] = banks.map((b) => {
    const sb = savedBanks.find((s) => s.bankId === b.id);
    return { bankId: b.id, bankName: b.bankName ?? "", branch: b.branch ?? "", accountNo: b.account ?? "", ifsc: b.ifsc ?? "", amount: sb ? num(sb.amount) : 0 };
  });
  // Saved banks that no longer match a business bank (kept so data isn't lost).
  for (const s of savedBanks) if (!banks.some((b) => b.id === s.bankId)) bankRows.push({ bankId: s.bankId ?? 0, bankName: s.bankName ?? "", branch: s.branch ?? "", accountNo: s.accountNo ?? "", ifsc: s.ifsc ?? "", amount: num(s.amount) });

  return NextResponse.json({
    ok: true, asOfDate,
    cash: { amount: cashRow ? num(cashRow.amount) : 0 },
    banks: bankRows,
    hasBusinessBanks: banks.length > 0,
  } satisfies OpeningBalanceResponse);
}

// PUT /api/accounting/opening-balance — save opening balances + (re)post the
// opening journal (Dr Cash/Bank, Cr Opening Balance Equity).
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "OpeningBalance" });
  if (denied) return denied;

  let body: { asOfDate?: string; cash?: number | string; banks?: BankIn[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const asOfDate = (body.asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cash = r2(num(body.cash));
  const banks = (body.banks ?? []).map((b) => ({
    bankId: b.bankId ?? null, bankName: b.bankName || null, branch: b.branch || null, accountNo: b.accountNo || null, ifsc: b.ifsc || null, amount: r2(num(b.amount)),
  }));
  const bankTotal = r2(banks.reduce((s, b) => s + b.amount, 0));
  const total = r2(cash + bankTotal);
  const scope = await writeScope(user);
  const ob = { tenantId: user.tenantId, businessId: scope.businessId, branchId: scope.branchId };

  try {
    await prisma.$transaction(async (tx) => {
      // Persist the entered rows for THIS business + branch (replace just this scope).
      await tx.openingBalance.deleteMany({ where: ob });
      await tx.openingBalance.create({ data: { ...ob, kind: "CASH", label: "Cash in Hand", amount: cash, asOfDate } });
      for (const b of banks) await tx.openingBalance.create({ data: { ...ob, kind: "BANK", label: b.bankName, bankId: b.bankId, bankName: b.bankName, branch: b.branch, accountNo: b.accountNo, ifsc: b.ifsc, amount: b.amount, asOfDate } });

      // Replace the prior opening voucher for this scope (and clean up any legacy
      // un-scoped voucher) by removing it, then post a fresh voucher stamped with
      // the active business + branch so it appears in this branch's ledger,
      // trial balance, balance sheet, etc.
      const prior = await tx.journalEntry.findMany({
        where: {
          tenantId: user.tenantId, sourceType: OPENING_SRC,
          OR: [{ businessId: scope.businessId, branchId: scope.branchId }, { businessId: null, branchId: null }],
        },
        select: { id: true },
      });
      if (prior.length) {
        const ids = prior.map((p) => p.id);
        await tx.journalLine.deleteMany({ where: { journalId: { in: ids } } });
        await tx.journalEntry.deleteMany({ where: { id: { in: ids } } });
      }
      await postJournal(tx, {
        tenantId: user.tenantId, businessId: scope.businessId, branchId: scope.branchId,
        voucherType: "JOURNAL", prefix: "OB", date: asOfDate,
        narration: "Opening Balances — Cash in Hand & Cash at Bank",
        sourceType: OPENING_SRC, sourceId: OPENING_ID, createdBy: user.id,
        lines: [
          { code: ACC.CASH, debit: cash, narration: "Opening cash in hand" },
          { code: ACC.BANK, debit: bankTotal, narration: "Opening cash at bank" },
          { code: ACC.OPENING_EQUITY, credit: total, narration: "Opening balance equity" },
        ],
      });
    });
    await writeAudit(prisma, user, {
      action: "opening_balance.save", entity: "OpeningBalance", entityId: OPENING_ID,
      summary: `Saved opening balances — total ${total.toFixed(2)} as on ${asOfDate}`,
      meta: { asOfDate, cash, bankTotal, total, bankCount: banks.length },
      businessId: scope.businessId, branchId: scope.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Opening balances saved & posted.", total } satisfies OpeningBalanceSaveResponse);
  } catch (err) {
    console.error("[opening-balance] save error", err);
    return NextResponse.json({ ok: false, message: "Could not save the opening balances." }, { status: 500 });
  }
}
