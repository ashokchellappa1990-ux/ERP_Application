/** Intelligent-navigation registry: business screen names → ERP routes. Reports and
 *  dashboards are navigation targets too. Extend by adding an entry. */

export interface NavTarget { label: string; href: string; kind: "screen" | "dashboard" | "report" | "master"; keywords: RegExp; permission?: string }

export const NAV_TARGETS: NavTarget[] = [
  // dashboards
  { label: "Finance Dashboard", href: "/finance", kind: "dashboard", keywords: /\bfinance dashboard\b|\bfinance home\b/ },
  { label: "Sales Dashboard", href: "/sales", kind: "dashboard", keywords: /\bsales dashboard\b/ },
  { label: "Purchase Dashboard", href: "/purchase", kind: "dashboard", keywords: /\bpurchase dashboard\b/ },
  { label: "Inventory Dashboard", href: "/inventory", kind: "dashboard", keywords: /\binventory dashboard\b/ },
  { label: "CRM Dashboard", href: "/crm", kind: "dashboard", keywords: /\bcrm dashboard\b/ },
  { label: "Executive Dashboard", href: "/dashboard", kind: "dashboard", keywords: /\bexecutive dashboard\b|\bmain dashboard\b|\bhome dashboard\b/ },
  { label: "Budget Dashboard", href: "/finance/budget", kind: "dashboard", keywords: /\bbudget dashboard\b|\bbudget planning\b|\bbudget screen\b/ },
  // masters
  { label: "Product Master", href: "/masters/product", kind: "master", keywords: /\bproduct master\b|\bproduct screen\b|\bitem master\b/ },
  { label: "Customer Master", href: "/masters/customer", kind: "master", keywords: /\bcustomer master\b|\bcustomer screen\b/ },
  { label: "Supplier Master", href: "/masters/supplier", kind: "master", keywords: /\bsupplier master\b|\bsupplier screen\b|\bvendor master\b/ },
  { label: "Discount Master", href: "/masters/discount", kind: "master", keywords: /\bdiscount master\b/ },
  { label: "Cost Centre", href: "/system/cost-centre", kind: "master", keywords: /\bcost cent(re|er) master\b|\bcost cent(re|er) screen\b/ },
  { label: "Profit Centre", href: "/system/profit-centre", kind: "master", keywords: /\bprofit cent(re|er) master\b|\bprofit cent(re|er) screen\b/ },
  // finance screens
  { label: "Payables", href: "/finance/payables", kind: "screen", keywords: /\bpayables?\b|\bpending (supplier )?payments? (screen|list)\b/ },
  { label: "Receivables", href: "/finance/receivables", kind: "screen", keywords: /\breceivables?\b|\bcustomer collections? (screen|list)\b/ },
  { label: "Journal", href: "/finance/journal", kind: "screen", keywords: /\bjournal (screen|vouchers?|list)\b/ },
  { label: "Petty Cash / Expense", href: "/finance/petty-cash", kind: "screen", keywords: /\bpetty cash (screen|list)\b|\bexpense (screen|list)\b/ },
  { label: "Fund Management", href: "/finance/cash", kind: "screen", keywords: /\bfund management\b|\bcash management\b/ },
  { label: "Bank Reconciliation", href: "/finance/bank-recon", kind: "screen", keywords: /\bbank reconciliation\b|\bbank recon\b/ },
  { label: "Statutory Compliance", href: "/finance/statutory-compliance", kind: "screen", keywords: /\bstatutory (compliance|payments?)\b|\bgst (screen|payment)\b|\bgovernment payment\b/ },
  { label: "GST Compliance", href: "/finance/gst-compliance", kind: "screen", keywords: /\bgst compliance\b|\bgst return\b/ },
  { label: "Recurring Transactions", href: "/finance/recurring", kind: "screen", keywords: /\brecurring transactions?\b/ },
  { label: "Financial Reports", href: "/finance/reports", kind: "report", keywords: /\bfinance reports?\b|\bfinancial reports?\b|\bp&l report\b|\bprofit report\b|\bbalance sheet\b/ },
  // operations
  { label: "POS Billing", href: "/sales/pos", kind: "screen", keywords: /\bpos billing\b|\bpoint of sale\b|\bbilling screen\b/ },
  { label: "Sales History", href: "/sales/history", kind: "screen", keywords: /\bsales history\b|\bsales report\b/ },
  { label: "Purchase Invoice", href: "/purchase/invoice", kind: "screen", keywords: /\bpurchase invoice (screen|list)\b|\bpurchase report\b/ },
  { label: "Goods Receipt Note", href: "/purchase/grn", kind: "screen", keywords: /\bgrn\b|\bgoods receipt\b/ },
  { label: "Inventory Tracking", href: "/inventory/tracking", kind: "screen", keywords: /\binventory tracking\b|\blow stock (screen|report)\b|\bstock report\b/ },
  { label: "Stock Inquiry", href: "/inventory/inquiry", kind: "screen", keywords: /\bstock inquiry\b|\bstock enquiry\b/ },
  // CRM
  { label: "Customer 360", href: "/crm/customer-360", kind: "screen", keywords: /\bcustomer 360\b|\bcustomer report\b/ },
  { label: "Loyalty Program", href: "/loyalty/program", kind: "screen", keywords: /\bloyalty program\b/ },
  // AI
  { label: "AI Copilot", href: "/copilot", kind: "screen", keywords: /\bai copilot\b|\bcopilot\b/ },
];

export function findNavTarget(message: string): NavTarget | null {
  const q = message.toLowerCase();
  let best: NavTarget | null = null; let bestLen = 0;
  for (const t of NAV_TARGETS) { const hit = q.match(t.keywords); if (hit && hit[0].length > bestLen) { best = t; bestLen = hit[0].length; } }
  return best;
}
