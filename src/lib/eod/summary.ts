import { prisma } from "@/lib/db/prisma";
import type { LiveSummary } from "@/lib/contracts/eod";

const n = (v: unknown) => (v == null ? 0 : Number(v));

export interface SummaryFilter {
  tenantId: number;
  businessId?: number | null;
  branchIds?: number[] | null; // null/empty = no branch restriction
  terminalId?: number | null;
  terminalSessionId?: number | null;
  cashierUserId?: number | null;
  date: string; // YYYY-MM-DD
}

export interface OpeningSnapshot { cash: number; bank: number; safe: number }

/** Shared header-column filter (the traceability columns common to the 8 headers). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function headerBase(f: SummaryFilter): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w: Record<string, any> = { tenantId: f.tenantId };
  if (f.businessId) w.businessId = f.businessId;
  if (f.branchIds && f.branchIds.length) w.branchId = { in: f.branchIds };
  if (f.terminalSessionId) w.terminalSessionId = f.terminalSessionId;
  else if (f.terminalId) w.terminalId = f.terminalId;
  if (f.cashierUserId) w.cashierUserId = f.cashierUserId;
  return w;
}

/** Aggregate today's activity into the Live Day Summary (read-only). */
export async function buildLiveSummary(f: SummaryFilter, opening: OpeningSnapshot = { cash: 0, bank: 0, safe: 0 }): Promise<LiveSummary> {
  const base = headerBase(f);
  const dayStart = new Date(`${f.date}T00:00:00.000Z`);

  const safeBranch = { tenantId: f.tenantId, ...(f.branchIds?.length ? { branchId: { in: f.branchIds } } : {}) };
  const [b2c, b2b, tax, ret, cashRet, payByMode, vouchers, coll, supp, petty, deposits, withdrawals, safeOut, safeIn, bankDep, grn, ledger, safeByDir] = await Promise.all([
    prisma.sale.aggregate({ where: { ...base, channel: "POS", status: "Completed", saleDate: f.date }, _sum: { total: true }, _count: true }),
    prisma.sale.aggregate({ where: { ...base, channel: "B2B", status: "Completed", saleDate: f.date }, _sum: { total: true }, _count: true }),
    prisma.sale.aggregate({ where: { ...base, status: "Completed", saleDate: f.date }, _sum: { taxTotal: true } }),
    prisma.salesReturn.aggregate({ where: { ...base, status: "Completed", returnDate: f.date }, _sum: { refundAmount: true }, _count: true }),
    prisma.salesReturn.aggregate({ where: { ...base, status: "Completed", returnDate: f.date, refundMode: "cash" }, _sum: { refundAmount: true } }),
    prisma.salePayment.groupBy({ by: ["mode"], where: { sale: { ...base, status: "Completed", saleDate: f.date } }, _sum: { amount: true } }),
    prisma.journalEntry.groupBy({ by: ["voucherType"], where: { ...base, date: f.date }, _count: true }),
    prisma.customerCollection.aggregate({ where: { ...base, collectionDate: f.date }, _sum: { totalAmount: true } }),
    prisma.supplierPayment.aggregate({ where: { ...base, paymentDate: f.date }, _sum: { totalAmount: true } }),
    prisma.pettyCashVoucher.aggregate({ where: { ...base, voucherDate: f.date }, _sum: { totalAmount: true } }),
    prisma.terminalCashTransaction.aggregate({ where: { ...base, type: "Deposit", createdAt: { gte: dayStart } }, _sum: { amount: true } }),
    prisma.terminalCashTransaction.aggregate({ where: { ...base, type: "Withdrawal", createdAt: { gte: dayStart } }, _sum: { amount: true } }),
    prisma.safeLockerTransaction.aggregate({ where: { tenantId: f.tenantId, ...(f.branchIds?.length ? { branchId: { in: f.branchIds } } : {}), ...(f.terminalId ? { terminalId: f.terminalId } : {}), direction: "IN_FROM_TERMINAL", createdAt: { gte: dayStart } }, _sum: { amount: true } }),
    prisma.safeLockerTransaction.aggregate({ where: { tenantId: f.tenantId, ...(f.branchIds?.length ? { branchId: { in: f.branchIds } } : {}), ...(f.terminalId ? { terminalId: f.terminalId } : {}), direction: "OUT_TO_TERMINAL", createdAt: { gte: dayStart } }, _sum: { amount: true } }),
    prisma.bankDeposit.aggregate({ where: { tenantId: f.tenantId, ...(f.branchIds?.length ? { branchId: { in: f.branchIds } } : {}), depositDate: f.date }, _sum: { amount: true } }),
    prisma.goodsReceiptNote.aggregate({ where: { ...base, status: "Posted", grnDate: f.date }, _sum: { totalInvoiceValue: true }, _count: true }),
    prisma.inventoryLedger.groupBy({ by: ["txnType"], where: { tenantId: f.tenantId, ...(f.branchIds?.length ? { branchId: { in: f.branchIds } } : {}), txnDate: f.date }, _count: true }),
    // Branch safe-locker movements today (vault is branch-level, not terminal-specific).
    prisma.safeLockerTransaction.groupBy({ by: ["direction"], where: { ...safeBranch, createdAt: { gte: dayStart } }, _sum: { amount: true } }),
  ]);
  const safeDir = (d: string) => n(safeByDir.find((s) => s.direction === d)?._sum.amount);
  const safeInTerminal = safeDir("IN_FROM_TERMINAL");
  const safeInBank = safeDir("IN_FROM_BANK"); // bank withdrawal → safe (also a bank outflow)
  const safeOutTerminal = safeDir("OUT_TO_TERMINAL");
  const safeOutBank = safeDir("OUT_TO_BANK");
  const safeClosing = opening.safe + safeInTerminal + safeInBank - safeOutTerminal - safeOutBank;

  const byMode: Record<string, number> = {};
  for (const p of payByMode) byMode[p.mode] = n(p._sum.amount);
  const collTotal = Object.values(byMode).reduce((a, b) => a + b, 0);
  const cashSales = Object.entries(byMode).filter(([m]) => m.toLowerCase().includes("cash")).reduce((a, [, v]) => a + v, 0);
  const creditSales = Object.entries(byMode).filter(([m]) => m.toLowerCase().includes("credit")).reduce((a, [, v]) => a + v, 0);
  // In transit = card / UPI / wallet / bank-transfer collected but not yet settled to bank.
  const inTransit = collTotal - cashSales - creditSales;

  const vc = (t: string) => vouchers.find((v) => v.voucherType === t)?._count ?? 0;
  const lc = (t: string) => ledger.find((l) => l.txnType === t)?._count ?? 0;

  const pettyTotal = n(petty._sum.totalAmount);
  const cashRefund = n(cashRet._sum.refundAmount);
  const dep = n(deposits._sum.amount);
  const wd = n(withdrawals._sum.amount);
  const safeTransferOut = n(safeOut._sum.amount); // drawer → safe (cash leaves the drawer)
  const safeTransferIn = n(safeIn._sum.amount); // safe → drawer (cash enters the drawer)
  const bankDeposit = n(bankDep._sum.amount);
  const collectionsCash = n(coll._sum.totalAmount);
  const expected = opening.cash + cashSales + collectionsCash + dep + safeTransferIn - cashRefund - pettyTotal - wd - safeTransferOut - bankDeposit;

  return {
    period: { date: f.date, level: f.terminalSessionId ? "session" : f.terminalId ? "terminal" : "branch", terminalSessionId: f.terminalSessionId ?? null },
    sales: {
      b2cCount: b2c._count, b2cTotal: n(b2c._sum.total), b2bCount: b2b._count, b2bTotal: n(b2b._sum.total),
      returnsCount: ret._count, returnsTotal: n(ret._sum.refundAmount), taxTotal: n(tax._sum.taxTotal),
    },
    collection: { byMode, total: collTotal },
    finance: {
      receipt: vc("RECEIPT"), payment: vc("PAYMENT"), contra: vc("CONTRA"), journal: vc("JOURNAL"),
      collections: collectionsCash, supplierPayments: n(supp._sum.totalAmount), pettyCash: pettyTotal,
      // Net cash impact of finance activity for the day (money in − money out).
      net: collectionsCash - n(supp._sum.totalAmount) - pettyTotal,
    },
    cash: { opening: opening.cash, cashSales, cashRefund, pettyCash: pettyTotal, deposits: dep, withdrawals: wd, safeTransferIn, safeTransferOut, bankDeposit, expected },
    // Bank closing = opening + deposited − withdrawn (cash taken out to the safe).
    // In transit = card/UPI/wallet/bank-transfer collected, awaiting settlement.
    bank: { openingBalance: opening.bank, deposited: bankDeposit, withdrawn: safeInBank, closing: opening.bank + bankDeposit - safeInBank, inTransit },
    safe: { opening: opening.safe, inFromTerminal: safeInTerminal, inFromBank: safeInBank, outToTerminal: safeOutTerminal, outToBank: safeOutBank, closing: safeClosing },
    inventory: {
      purchaseCount: grn._count, purchaseValue: n(grn._sum.totalInvoiceValue),
      salesMovements: lc("SALES"), returnMovements: lc("SALES_RETURN"), adjustments: lc("ADJUSTMENT"), transfers: lc("TRANSFER"),
    },
  };
}
