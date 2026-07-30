/**
 * Editable Accounting Rule Engine store (in-session). Seeded from ACCOUNTING_RULES
 * and the auto-post flags; the Rule Engine screen adds / edits / deletes rules and
 * toggles per-module auto-posting, then saves back here. (Resets on full reload
 * until a backend is wired.)
 */
import { ACCOUNTING_RULES } from "./financeData";
import { DEFAULT_FINANCE_CONFIG } from "./financeConfig";

export interface AcctRule { txn: string; dr: string; cr: string; wired?: boolean }
export interface RuleGroup { module: string; autoFlag: string; auto: boolean; rules: AcctRule[] }

function build(): RuleGroup[] {
  return ACCOUNTING_RULES.map((g) => ({ module: g.module, autoFlag: g.autoFlag, auto: !!DEFAULT_FINANCE_CONFIG.flags[g.autoFlag], rules: g.rules.map((r) => ({ ...r })) }));
}
export const RULES_STATE: RuleGroup[] = build();

/** Deep copy for safe local editing. */
export const getRules = (): RuleGroup[] => RULES_STATE.map((g) => ({ ...g, rules: g.rules.map((r) => ({ ...r })) }));

export function saveRules(next: RuleGroup[]) {
  RULES_STATE.length = 0;
  next.forEach((g) => RULES_STATE.push({ ...g, rules: g.rules.map((r) => ({ ...r })) }));
  next.forEach((g) => { DEFAULT_FINANCE_CONFIG.flags[g.autoFlag] = g.auto; });
}

export const RULE_MODULES = ACCOUNTING_RULES.map((g) => g.module);
export const ACCOUNT_OPTIONS = [
  "Cash", "Bank", "Cash / Bank", "Debtors / Cash / Bank", "Sundry Debtors", "Sundry Creditors",
  "Sales", "Sales + Output GST", "Purchases", "GRN Clearing (GRNI)", "Inventory", "Inventory (In-Transit)",
  "Input GST", "Output GST", "GST Payable", "TDS Payable", "TCS Payable",
  "Discount Allowed", "Discount Received", "Bank Charges (P&L)", "Interest Income", "Interest Expense",
  "Fixed Asset", "Accumulated Depreciation", "Depreciation Expense", "Loss on Sale", "Profit on Sale",
  "Salary Expense", "Salary Payable + TDS + PF/ESI", "Reimbursement Expense",
  "Inventory Write-Off (P&L)", "Stock Adjustment (P&L)", "Expense Ledger", "Income Ledger", "Suspense",
];
