import type { Prisma } from "@prisma/client";
import { ACC, ensureAccounts, purchaseTypeAccount } from "./accounts";

/**
 * Double-entry posting. Each business event (purchase / sale) writes ONE balanced
 * journal voucher (sum of debits == sum of credits). This is the single entry
 * point so the General Ledger and Trial Balance always tie out.
 */
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

interface JLineInput { code: string; debit?: number; credit?: number; narration?: string }
interface PostJournalInput {
  tenantId: number;
  businessId?: number | null; // segregation: the source transaction's business …
  branchId?: number | null;   // … and branch, stamped on the entry + every line
  voucherType: string; // PURCHASE | SALES | JOURNAL | …
  prefix?: string; // voucher number prefix (PV / SV / JV / RV)
  date: string;
  narration?: string;
  sourceType?: string | null;
  sourceId?: number | null;
  refNo?: string | null;
  createdBy?: number | null;
  // Optional financial dimensions captured on the GL header for dimensional reporting.
  costCenterId?: number | null;
  profitCenterId?: number | null;
  department?: string | null;
  project?: string | null;
  lines: JLineInput[];
}

/** Create one balanced journal entry. Zero-amount lines are dropped; throws if the
 * remaining debits and credits don't balance. Returns the entry id (or null if empty). */
export async function postJournal(tx: Prisma.TransactionClient, input: PostJournalInput): Promise<number | null> {
  const accounts = await ensureAccounts(tx, input.tenantId);
  const cleaned = input.lines
    .map((l) => ({ code: l.code, debit: r2(l.debit ?? 0), credit: r2(l.credit ?? 0), narration: l.narration ?? null }))
    .filter((l) => l.debit > 0 || l.credit > 0);
  if (!cleaned.length) return null;

  const totalDebit = r2(cleaned.reduce((s, l) => s + l.debit, 0));
  const totalCredit = r2(cleaned.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.05) {
    throw new Error(`Unbalanced journal (${input.voucherType}): Dr ${totalDebit} ≠ Cr ${totalCredit}`);
  }
  for (const l of cleaned) if (!accounts.has(l.code)) throw new Error(`Unknown ledger account ${l.code}`);

  const businessId = input.businessId ?? undefined;
  const branchId = input.branchId ?? undefined;
  const entry = await tx.journalEntry.create({
    data: {
      tenantId: input.tenantId, businessId, branchId, voucherNo: "TMP", voucherType: input.voucherType, date: input.date,
      narration: input.narration ?? null, sourceType: input.sourceType ?? null, sourceId: input.sourceId ?? null,
      refNo: input.refNo ?? null, totalDebit, totalCredit, createdBy: input.createdBy ?? null,
      costCenterId: input.costCenterId ?? null, profitCenterId: input.profitCenterId ?? null, department: input.department ?? null, project: input.project ?? null,
    },
  });
  const voucherNo = `${input.prefix ?? "JV"}-${String(entry.id).padStart(6, "0")}`;
  await tx.journalEntry.update({ where: { id: entry.id }, data: { voucherNo } });
  await tx.journalLine.createMany({
    data: cleaned.map((l) => ({ tenantId: input.tenantId, businessId, branchId, journalId: entry.id, accountId: accounts.get(l.code)!, debit: l.debit, credit: l.credit, narration: l.narration })),
  });
  return entry.id;
}

export interface PurchaseJournalInput {
  tenantId: number; businessId?: number | null; branchId?: number | null; grnId: number; grnNo: string; date: string; supplier?: string | null;
  subtotal: number; taxTotal: number; freight: number; otherCharges: number; roundOff: number;
  grandTotal: number; amountPaid: number; paymentMode?: string | null; createdBy?: number | null;
  hasInvoice?: boolean; // supplier-invoice details were entered at GRN
}
/** GRN accounting voucher. When the supplier invoice was entered at GRN (`hasInvoice`)
 * the full purchase is booked immediately: Dr Inventory + Input GST, Cr Cash (paid) +
 * Accounts Payable. Otherwise the goods sit in GRN Clearing (Dr Inventory / Cr GRN
 * Clearing) until the supplier bill is recorded via Purchase Invoice. */
export async function postPurchaseJournal(tx: Prisma.TransactionClient, p: PurchaseJournalInput) {
  const goodsValue = r2(p.subtotal + p.freight + p.otherCharges + p.roundOff); // landed cost, ex-GST
  if (!p.hasInvoice) {
    return postJournal(tx, {
      tenantId: p.tenantId, businessId: p.businessId, branchId: p.branchId, voucherType: "PURCHASE", prefix: "PV", date: p.date,
      narration: `Goods Received — ${p.grnNo}${p.supplier ? ` — ${p.supplier}` : ""}`,
      sourceType: "GRN", sourceId: p.grnId, refNo: p.grnNo, createdBy: p.createdBy,
      lines: [
        { code: ACC.INVENTORY, debit: goodsValue, narration: "Goods received into stock" },
        { code: ACC.GRN_CLEARING, credit: goodsValue, narration: "GRN clearing (awaiting supplier invoice)" },
      ],
    });
  }
  // Full purchase (invoice present): Dr Inventory + Input GST, Cr Cash + Payable.
  const settled = r2(Math.min(p.amountPaid, p.grandTotal));
  const payable = r2(p.grandTotal - settled);
  const cashCode = (p.paymentMode ?? "").toLowerCase().includes("cash") ? ACC.CASH : ACC.BANK;
  return postJournal(tx, {
    tenantId: p.tenantId, businessId: p.businessId, branchId: p.branchId, voucherType: "PURCHASE", prefix: "PV", date: p.date,
    narration: `Purchase — ${p.grnNo}${p.supplier ? ` — ${p.supplier}` : ""}`,
    sourceType: "GRN", sourceId: p.grnId, refNo: p.grnNo, createdBy: p.createdBy,
    lines: [
      { code: ACC.INVENTORY, debit: goodsValue, narration: "Goods received into stock" },
      { code: ACC.INPUT_GST, debit: r2(p.taxTotal), narration: "Input GST (ITC)" },
      { code: cashCode, credit: settled, narration: `Paid${p.paymentMode ? ` via ${p.paymentMode}` : ""}` },
      { code: ACC.PAYABLE, credit: payable, narration: `Payable to ${p.supplier ?? "supplier"}` },
    ],
  });
}

export interface SalesJournalInput {
  tenantId: number; businessId?: number | null; branchId?: number | null; saleId: number; invoiceNo: string; date: string; customerName?: string | null;
  taxableValue: number; taxTotal: number; roundOff: number; total: number; amountPaid: number; cost: number;
  cashAmount: number; bankAmount: number; tds?: number; tcs?: number; createdBy?: number | null;
  billDiscount?: number; loyaltyRedeem?: number; couponDiscount?: number; promoDiscount?: number; membershipDiscount?: number; membershipDiscountCode?: string; // bill-level reductions: Sales+GST are credited gross, so these debits balance the receipt shortfall
  engineDiscounts?: { code: string; amount: number }[]; // rule-based discounts resolved by the Discount Management engine (each posts a contra-revenue debit to its configured ledger)
  giftVoucher?: number; // gift voucher tendered as payment (stored value → Dr Gift Voucher Liability)
  advanceAdjusted?: number; advanceAccountCode?: string; // customer advance applied → Dr Advance Liability (reduces AR)
}
/** Sales voucher: Dr Cash/Bank/Receivable + TDS Receivable + COGS, Cr Sales +
 * Output GST + Inventory + TCS Payable (+ Round Off). `total` already includes TCS.
 * TDS is deducted by the buyer, so the cash the customer owes = total − TDS. */
export async function postSalesJournal(tx: Prisma.TransactionClient, s: SalesJournalInput) {
  const tds = r2(s.tds ?? 0);
  const tcs = r2(s.tcs ?? 0);
  const payable = r2(s.total - tds); // what the customer actually pays (TDS withheld)
  // Customer advance applied → Dr the advance liability account (reduces receivable).
  const advanceUsed = r2(Math.min(s.advanceAdjusted ?? 0, payable));
  const ar = r2(Math.max(0, payable - s.amountPaid - advanceUsed));
  const settled = r2(payable - ar); // amount actually settled now (cash/bank/voucher/advance)
  // Gift voucher tender = stored value → Dr Gift Voucher Liability (not cash/bank).
  const giftVoucher = r2(Math.min(s.giftVoucher ?? 0, Math.max(0, settled - advanceUsed)));
  const nonVoucher = r2(settled - advanceUsed - giftVoucher);
  const bankComponent = r2(Math.min(s.bankAmount, nonVoucher));
  const cashComponent = r2(nonVoucher - bankComponent);
  const billDiscount = r2(s.billDiscount ?? 0);
  const loyaltyRedeem = r2(s.loyaltyRedeem ?? 0);
  const couponDiscount = r2(s.couponDiscount ?? 0);
  const promoDiscount = r2(s.promoDiscount ?? 0);
  const membershipDiscount = r2(s.membershipDiscount ?? 0);
  const lines: JLineInput[] = [
    { code: ACC.CASH, debit: cashComponent, narration: "Cash received" },
    { code: ACC.BANK, debit: bankComponent, narration: "Card / UPI / Bank received" },
    { code: ACC.GIFT_VOUCHER_LIABILITY, debit: giftVoucher, narration: "Gift voucher redeemed (payment)" },
    { code: s.advanceAccountCode || ACC.CUSTOMER_ADVANCE, debit: advanceUsed, narration: "Customer advance adjusted" },
    { code: ACC.RECEIVABLE, debit: ar, narration: `Receivable from ${s.customerName || "customer"}` },
    { code: ACC.TDS_RECEIVABLE, debit: tds, narration: "TDS deducted by customer (receivable)" },
    { code: ACC.SALES_DISCOUNT, debit: billDiscount, narration: "Bill discount allowed" },
    { code: ACC.LOYALTY_EXPENSE, debit: loyaltyRedeem, narration: "Loyalty points redeemed (bill discount)" },
    { code: ACC.MARKETING_EXPENSE, debit: couponDiscount, narration: "Coupon discount (campaign funded)" },
    { code: ACC.MARKETING_EXPENSE, debit: promoDiscount, narration: "Promo code discount (campaign funded)" },
    { code: s.membershipDiscountCode || ACC.SALES_DISCOUNT, debit: membershipDiscount, narration: "Membership benefit discount" },
    ...(s.engineDiscounts ?? []).map((e) => ({ code: e.code || ACC.SALES_DISCOUNT, debit: r2(e.amount), narration: "Rule-based discount (Discount Master)" })),
    { code: ACC.COGS, debit: r2(s.cost), narration: "Cost of goods sold" },
    { code: ACC.SALES, credit: r2(s.taxableValue), narration: "Sales revenue" },
    { code: ACC.OUTPUT_GST, credit: r2(s.taxTotal), narration: "Output GST (CGST + SGST)" },
    { code: ACC.TCS_PAYABLE, credit: tcs, narration: "TCS collected (payable to govt)" },
    { code: ACC.INVENTORY, credit: r2(s.cost), narration: "Inventory issued (COGS)" },
  ];
  if (s.roundOff > 0.004) lines.push({ code: ACC.ROUND_OFF, credit: r2(s.roundOff), narration: "Round off gain" });
  else if (s.roundOff < -0.004) lines.push({ code: ACC.ROUND_OFF, debit: r2(-s.roundOff), narration: "Round off loss" });
  return postJournal(tx, {
    tenantId: s.tenantId, businessId: s.businessId, branchId: s.branchId, voucherType: "SALES", prefix: "SV", date: s.date,
    narration: `Sale — ${s.invoiceNo}${s.customerName ? ` — ${s.customerName}` : ""}`,
    sourceType: "SALES", sourceId: s.saleId, refNo: s.invoiceNo, createdBy: s.createdBy, lines,
  });
}

export interface ReceiptJournalInput {
  tenantId: number; businessId?: number | null; branchId?: number | null; date: string; refNo: string; saleId?: number | null; customerName?: string | null;
  amount: number; mode: string; createdBy?: number | null;
}
/** Receipt voucher for a customer collection against a receivable:
 * Dr Cash/Bank, Cr Accounts Receivable. Reduces the AR balance in the GL. */
export async function postReceiptJournal(tx: Prisma.TransactionClient, r: ReceiptJournalInput) {
  const amt = r2(r.amount);
  if (amt <= 0) return null;
  const cashCode = (r.mode ?? "").toLowerCase().includes("cash") ? ACC.CASH : ACC.BANK;
  return postJournal(tx, {
    tenantId: r.tenantId, businessId: r.businessId, branchId: r.branchId, voucherType: "RECEIPT", prefix: "RC", date: r.date,
    narration: `Receipt — ${r.refNo}${r.customerName ? ` — ${r.customerName}` : ""}`,
    sourceType: "SALES_RECEIPT", sourceId: r.saleId ?? null, refNo: r.refNo, createdBy: r.createdBy,
    lines: [
      { code: cashCode, debit: amt, narration: `Collected${r.mode ? ` via ${r.mode}` : ""}` },
      { code: ACC.RECEIVABLE, credit: amt, narration: `Against ${r.customerName ?? "customer"}` },
    ],
  });
}

export interface SupplierPaymentJournalInput {
  tenantId: number; businessId?: number | null; branchId?: number | null; date: string; paymentNo: string; paymentId?: number | null; supplier?: string | null;
  amount: number; mode: string; createdBy?: number | null;
}
/** Payment voucher for settling supplier payables: Dr Accounts Payable, Cr Cash/Bank.
 * Reduces the AP balance in the GL. */
export async function postSupplierPaymentJournal(tx: Prisma.TransactionClient, p: SupplierPaymentJournalInput) {
  const amt = r2(p.amount);
  if (amt <= 0) return null;
  const cashCode = (p.mode ?? "").toLowerCase().includes("cash") ? ACC.CASH : ACC.BANK;
  return postJournal(tx, {
    tenantId: p.tenantId, businessId: p.businessId, branchId: p.branchId, voucherType: "PAYMENT", prefix: "PY", date: p.date,
    narration: `Payment — ${p.paymentNo}${p.supplier ? ` — ${p.supplier}` : ""}`,
    sourceType: "SUPPLIER_PAYMENT", sourceId: p.paymentId ?? null, refNo: p.paymentNo, createdBy: p.createdBy,
    lines: [
      { code: ACC.PAYABLE, debit: amt, narration: `Settled ${p.supplier ?? "supplier"}` },
      { code: cashCode, credit: amt, narration: `Paid${p.mode ? ` via ${p.mode}` : ""}` },
    ],
  });
}

export interface SalesReturnJournalInput {
  tenantId: number; businessId?: number | null; branchId?: number | null; date: string;
  returnNo: string; returnId?: number | null; customerName?: string | null;
  taxableValue: number; // sales revenue reversed (excl tax)
  taxTotal: number;     // output GST reversed
  refundMode: string;   // cash | upi | bank | storeCredit | creditNote
  inventoryCost: number; // cost of ALL returned goods brought back into inventory
  writeOffCost: number;  // cost of damaged/expired/scrap goods written off as a loss
  createdBy?: number | null;
}
/**
 * Sales return voucher. Reverses the sale proportionally and settles the refund:
 *   Dr Sales Returns (taxable) + Dr Output GST (tax)
 *     Cr Cash/Bank/Store-Credit (refund)
 *   Dr Inventory + Cr COGS (returned goods back into stock at cost)
 *   [damaged/expired/scrap]  Dr Indirect Expenses + Cr Inventory (write-off loss)
 */
export async function postSalesReturnJournal(tx: Prisma.TransactionClient, s: SalesReturnJournalInput) {
  const taxable = r2(s.taxableValue);
  const tax = r2(s.taxTotal);
  const refund = r2(taxable + tax);
  const cost = r2(s.inventoryCost);
  const writeOff = r2(s.writeOffCost);
  const m = (s.refundMode ?? "").toLowerCase();
  const refundCode = m.includes("cash") ? ACC.CASH
    : (m.includes("storecredit") || m.includes("credit")) ? ACC.STORE_CREDIT
    : ACC.BANK; // upi / bank / card
  const lines: JLineInput[] = [
    { code: ACC.SALES_RETURN, debit: taxable, narration: "Sales return (revenue reversed)" },
    { code: ACC.OUTPUT_GST, debit: tax, narration: "Output GST reversed" },
    { code: refundCode, credit: refund, narration: `Refund${s.refundMode ? ` via ${s.refundMode}` : ""} to ${s.customerName ?? "customer"}` },
    { code: ACC.INVENTORY, debit: cost, narration: "Returned goods back to inventory" },
    { code: ACC.COGS, credit: cost, narration: "COGS reversed on return" },
  ];
  if (writeOff > 0.004) {
    lines.push({ code: ACC.INDIRECT_EXPENSE, debit: writeOff, narration: "Damaged / expired / scrap write-off" });
    lines.push({ code: ACC.INVENTORY, credit: writeOff, narration: "Inventory written off (non-sellable return)" });
  }
  return postJournal(tx, {
    tenantId: s.tenantId, businessId: s.businessId, branchId: s.branchId, voucherType: "SALES_RETURN", prefix: "SR", date: s.date,
    narration: `Sales Return — ${s.returnNo}${s.customerName ? ` — ${s.customerName}` : ""}`,
    sourceType: "SALES_RETURN", sourceId: s.returnId ?? null, refNo: s.returnNo, createdBy: s.createdBy,
    lines,
  });
}

export interface PurchaseReturnJournalInput {
  tenantId: number; businessId?: number | null; branchId?: number | null; date: string;
  returnNo: string; returnId?: number | null; supplier?: string | null;
  purchaseType: string;  // Inventory | Service | Expense | Asset — drives the credit account
  taxableValue: number;  // goods / service / expense / asset value reversed (excl tax)
  taxTotal: number;      // input GST reversed
  roundOff: number;      // residual rounding
  createdBy?: number | null;
}
/**
 * Purchase return voucher — mirrors the original purchase. Reduces the supplier
 * outstanding and reverses the cost side per purchase type:
 *   Dr Accounts Payable (debit raised on supplier, incl tax)
 *     Cr Inventory / Service Expense / Indirect Expense / Fixed Asset (per type)
 *     Cr Input GST (ITC reversed)
 * For an Inventory return this reverses the inventory just like the spec's
 * "Reverse Inventory/GRN Clearing + Reverse GST + Reduce Supplier Outstanding".
 */
export async function postPurchaseReturnJournal(tx: Prisma.TransactionClient, p: PurchaseReturnJournalInput) {
  const taxable = r2(p.taxableValue);
  const tax = r2(p.taxTotal);
  const debit = r2(taxable + tax + (p.roundOff || 0));
  const costAccount = purchaseTypeAccount(p.purchaseType);
  const lines: JLineInput[] = [
    { code: ACC.PAYABLE, debit, narration: `Debit on purchase return to ${p.supplier ?? "supplier"}` },
    { code: costAccount, credit: taxable, narration: `${p.purchaseType} purchase reversed` },
    { code: ACC.INPUT_GST, credit: tax, narration: "Input GST (ITC) reversed" },
  ];
  // Round-off residual so the voucher balances.
  if (p.roundOff > 0.004) lines.push({ code: ACC.ROUND_OFF, credit: r2(p.roundOff), narration: "Round off" });
  else if (p.roundOff < -0.004) lines.push({ code: ACC.ROUND_OFF, debit: r2(-p.roundOff), narration: "Round off" });
  return postJournal(tx, {
    tenantId: p.tenantId, businessId: p.businessId, branchId: p.branchId, voucherType: "PURCHASE_RETURN", prefix: "PR", date: p.date,
    narration: `Purchase Return — ${p.returnNo}${p.supplier ? ` — ${p.supplier}` : ""}`,
    sourceType: "PURCHASE_RETURN", sourceId: p.returnId ?? null, refNo: p.returnNo, createdBy: p.createdBy,
    lines,
  });
}

export interface LoyaltyJournalInput {
  tenantId: number; businessId?: number | null; branchId?: number | null; date: string;
  accrue: boolean;          // true = points credited (earn / restore); false = points released (redeem / reverse)
  value: number;            // ₹ equivalent of the points moved
  customerName?: string | null; invoiceNo?: string | null; saleId?: number | null; createdBy?: number | null;
  reason?: string;          // narration tail (earned / redeemed / reversed …)
}
/**
 * Loyalty points accounting (deferred-cost model):
 *   accrue (earn):   Dr Loyalty Points Expense   Cr Loyalty Points Liability
 *   release (redeem): Dr Loyalty Points Liability  Cr Loyalty Points Expense
 * The liability always reflects the ₹ value of outstanding points; the expense
 * nets to the cost of points actually consumed (breakage stays as expense).
 */
export async function postLoyaltyJournal(tx: Prisma.TransactionClient, p: LoyaltyJournalInput) {
  const value = r2(p.value);
  if (value <= 0) return null;
  const tail = p.reason ? ` — ${p.reason}` : "";
  const lines: JLineInput[] = p.accrue
    ? [{ code: ACC.LOYALTY_EXPENSE, debit: value, narration: "Loyalty points accrued" }, { code: ACC.LOYALTY_LIABILITY, credit: value, narration: "Loyalty liability raised" }]
    : [{ code: ACC.LOYALTY_LIABILITY, debit: value, narration: "Loyalty liability released" }, { code: ACC.LOYALTY_EXPENSE, credit: value, narration: "Loyalty expense reversed" }];
  return postJournal(tx, {
    tenantId: p.tenantId, businessId: p.businessId, branchId: p.branchId, voucherType: "LOYALTY", prefix: "LY", date: p.date,
    narration: `Loyalty ${p.accrue ? "earn" : "redeem"}${p.invoiceNo ? ` — ${p.invoiceNo}` : ""}${p.customerName ? ` — ${p.customerName}` : ""}${tail}`,
    sourceType: "LOYALTY", sourceId: p.saleId ?? null, refNo: p.invoiceNo ?? null, createdBy: p.createdBy,
    lines,
  });
}

/** Reverse all posted vouchers for a source document (swaps Dr/Cr) and marks the
 * originals Reversed. Used when a posted GRN is cancelled. */
export async function reverseJournalForSource(tx: Prisma.TransactionClient, tenantId: number, sourceType: string, sourceId: number, date: string, createdBy?: number | null) {
  const entries = await tx.journalEntry.findMany({ where: { tenantId, sourceType, sourceId, status: "Posted" }, include: { lines: true } });
  for (const e of entries) {
    const rev = await tx.journalEntry.create({
      data: {
        tenantId, businessId: e.businessId ?? undefined, branchId: e.branchId ?? undefined, voucherNo: "TMP", voucherType: "JOURNAL", date,
        narration: `Reversal of ${e.voucherNo} — ${e.narration ?? ""}`.trim(),
        sourceType, sourceId, refNo: e.refNo, totalDebit: e.totalCredit, totalCredit: e.totalDebit, status: "Posted", createdBy: createdBy ?? null,
      },
    });
    const voucherNo = `RV-${String(rev.id).padStart(6, "0")}`;
    await tx.journalEntry.update({ where: { id: rev.id }, data: { voucherNo } });
    await tx.journalLine.createMany({
      data: e.lines.map((l) => ({ tenantId, businessId: e.businessId ?? undefined, branchId: e.branchId ?? undefined, journalId: rev.id, accountId: l.accountId, debit: l.credit, credit: l.debit, narration: `Reversal: ${l.narration ?? ""}`.trim() })),
    });
    await tx.journalEntry.update({ where: { id: e.id }, data: { status: "Reversed" } });
  }
}
