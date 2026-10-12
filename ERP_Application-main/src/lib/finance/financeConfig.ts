/**
 * DEFAULT_FINANCE_CONFIG — finance & accounting policy obeyed by the suite.
 * The Accounting Rule Engine + period controls + approval workflow read this.
 * No manual entries are needed for standard ERP transactions when auto-post is on.
 */
export interface FinanceConfigData {
  fields: Record<string, string>;
  flags: Record<string, boolean>;
}

export const DEFAULT_FINANCE_CONFIG: FinanceConfigData = {
  fields: {
    fyStart: "2026-04-01", fyEnd: "2027-03-31",
    baseCurrency: "INR", branchCode: "CHN",
    depreciationMethod: "SLM", // SLM | WDV
    currentPeriod: "Jun 2026", periodStatus: "Open",
    jvPrefix: "JV", expPrefix: "EXP", payPrefix: "PMT", rcptPrefix: "RCT",
  },
  flags: {
    autoPostSales: true, autoPostPurchase: true, autoPostInventory: true,
    autoPostPayroll: true, autoPostDepreciation: true, autoPostTax: true, autoPostBank: true,
    backdatedRestriction: true, periodLock: true, auditLock: true,
    journalApproval: true, expenseApproval: true, paymentApproval: true, closureApproval: true,
    multiBranch: true, costCenterMandatory: false, profitCenterTracking: true,
    einvoiceAuto: true, ewayAuto: true, gstReconcile: true, aiFinance: true,
  },
};

export const fin = (n: string) => DEFAULT_FINANCE_CONFIG.fields[n] ?? "";
export const finFlag = (id: string) => !!DEFAULT_FINANCE_CONFIG.flags[id];
export function financeDocNo(prefix = "JV", seq = 1) {
  const f = DEFAULT_FINANCE_CONFIG.fields;
  return [prefix, f.branchCode, "26-27", String(Math.max(1, seq)).padStart(4, "0")].filter(Boolean).join("/");
}
