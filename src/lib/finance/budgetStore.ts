/**
 * In-session Budget store. A Budget is a document for a Financial Year + Level,
 * holding head-wise lines split across the chosen period granularity
 * (Annual / Quarterly / Monthly). Add → list → view/edit all read this store.
 * (Mutable singleton; resets on full reload until a backend is wired.)
 */
export type PeriodType = "Annual" | "Quarterly" | "Monthly";

export const BUDGET_HEADS = ["Salaries", "Rent", "Marketing", "Utilities", "Repairs & Maintenance", "Purchases", "Logistics", "Professional Fees", "IT & Software", "Insurance", "Travel", "Miscellaneous"];
export const BUDGET_LEVELS = ["Organization", "Branch", "Department", "Category", "Project"];
export const FY_OPTIONS = ["FY 26-27", "FY 25-26"];
export const PERIOD_TYPES: PeriodType[] = ["Annual", "Quarterly", "Monthly"];

export function periodsOf(t: PeriodType): string[] {
  if (t === "Annual") return ["Annual"];
  if (t === "Quarterly") return ["Q1", "Q2", "Q3", "Q4"];
  return ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
}

export interface BudgetHead { head: string; amounts: number[]; spent: number }
export interface Budget { id: string; name: string; level: string; fy: string; periodType: PeriodType; status: string; heads: BudgetHead[] }

export const headTotal = (h: BudgetHead) => h.amounts.reduce((s, a) => s + (Number(a) || 0), 0);
export const budgetTotal = (b: Budget) => b.heads.reduce((s, h) => s + headTotal(h), 0);
export const budgetSpent = (b: Budget) => b.heads.reduce((s, h) => s + (Number(h.spent) || 0), 0);
export const periodTotals = (b: Budget) => periodsOf(b.periodType).map((_, i) => b.heads.reduce((s, h) => s + (Number(h.amounts[i]) || 0), 0));

let _seq = 3;
export const BUDGETS: Budget[] = [
  { id: "BUD-1", name: "FY 26-27 Operating Budget", level: "Organization", fy: "FY 26-27", periodType: "Annual", status: "Active", heads: [
    { head: "Salaries", amounts: [4800000], spent: 2200000 },
    { head: "Rent", amounts: [2220000], spent: 1110000 },
    { head: "Marketing", amounts: [600000], spent: 420000 },
    { head: "Utilities", amounts: [360000], spent: 180000 },
    { head: "IT & Software", amounts: [240000], spent: 96000 },
  ] },
  { id: "BUD-2", name: "Marketing Budget (Quarterly)", level: "Department", fy: "FY 26-27", periodType: "Quarterly", status: "Active", heads: [
    { head: "Marketing", amounts: [150000, 180000, 150000, 120000], spent: 330000 },
    { head: "Travel", amounts: [40000, 40000, 40000, 40000], spent: 60000 },
  ] },
];

export const listBudgets = () => BUDGETS;
export const getBudget = (id: string) => BUDGETS.find((b) => b.id === id);
export function saveBudget(b: Budget): Budget {
  const i = BUDGETS.findIndex((x) => x.id === b.id);
  if (i >= 0 && b.id) { BUDGETS[i] = b; return b; }
  const nb = { ...b, id: `BUD-${_seq++}` };
  BUDGETS.push(nb);
  return nb;
}
export function deleteBudget(id: string) { const i = BUDGETS.findIndex((b) => b.id === id); if (i >= 0) BUDGETS.splice(i, 1); }
export function newBudget(): Budget {
  return { id: "", name: "", level: "Organization", fy: "FY 26-27", periodType: "Annual", status: "Draft", heads: [{ head: "Salaries", amounts: [0], spent: 0 }] };
}
