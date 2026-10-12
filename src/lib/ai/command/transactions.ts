/**
 * Registry of AI-creatable transactions. The AI collects the required fields, stages a
 * DRAFT, then hands the user to `createHref` to create the REAL record through the normal
 * ERP screen (which runs every validation + approval). Adding a new creatable transaction
 * = one entry here (no router changes) — the extensibility promise of the platform.
 */

export interface TxField { key: string; label: string; type: "text" | "number" | "money" | "bool" | "date"; required: boolean; ask: string; hint?: string; master?: "expenseHead" | "supplier" | "customer" }
export interface TxType {
  key: string; label: string; module: string; permission: string; createHref: string; priority?: "High" | "Medium" | "Low";
  keywords: RegExp; fields: TxField[];
  summarize: (f: Record<string, string>) => string;
}

const money = (v: string) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

export const TX_TYPES: TxType[] = [
  { key: "expense", label: "Expense Voucher", module: "finance", permission: "finance.petty-cash", createHref: "/finance/petty-cash/new",
    keywords: /\bexpense\b|\bpetty cash\b|\bbill payment voucher\b/, fields: [
      { key: "head", label: "Expense Head", type: "text", required: true, ask: "Which expense head is this for? (e.g. Electricity, Rent, Salary)", master: "expenseHead" },
      { key: "party", label: "Payee / Supplier", type: "text", required: true, ask: "Who is the payee or supplier? (e.g. TNEB)", master: "supplier" },
      { key: "amount", label: "Amount", type: "money", required: true, ask: "What is the amount?" },
      { key: "gst", label: "GST Applicable", type: "bool", required: true, ask: "Is GST applicable? (yes/no)" },
    ], summarize: (f) => `${f.head ?? "Expense"} — ${f.party ?? ""} · ${money(f.amount)}${f.gst?.toLowerCase().startsWith("y") ? " (GST)" : ""}` },
  { key: "payment", label: "Supplier Payment", module: "purchase", permission: "purchase.payments", createHref: "/purchase/payments",
    keywords: /\bsupplier payment\b|\bpay supplier\b|\bvendor payment\b|\bpayment voucher\b/, fields: [
      { key: "supplier", label: "Supplier", type: "text", required: true, ask: "Which supplier are you paying?", master: "supplier" },
      { key: "amount", label: "Amount", type: "money", required: true, ask: "How much are you paying?" },
    ], summarize: (f) => `Pay ${f.supplier ?? "supplier"} · ${money(f.amount)}` },
  { key: "receipt", label: "Income Receipt", module: "finance", permission: "finance.receipt", createHref: "/finance/receipt",
    keywords: /\bincome receipt\b|\breceipt voucher\b|\bcollect(ion)? voucher\b|\bmisc(ellaneous)? receipt\b/, fields: [
      { key: "category", label: "Receipt Category", type: "text", required: true, ask: "What is the receipt category? (e.g. Rental Income, Scrap Sale)" },
      { key: "party", label: "Received From", type: "text", required: true, ask: "Who is the amount received from?" },
      { key: "amount", label: "Amount", type: "money", required: true, ask: "What is the amount received?" },
    ], summarize: (f) => `Receipt — ${f.category ?? ""} from ${f.party ?? ""} · ${money(f.amount)}` },
  { key: "journal", label: "Journal Voucher", module: "finance", permission: "finance.journal", createHref: "/finance/journal/new",
    keywords: /\bjournal voucher\b|\bjournal entry\b|\badjustment entry\b/, fields: [
      { key: "narration", label: "Narration", type: "text", required: true, ask: "What is the narration / reason for this journal?" },
      { key: "amount", label: "Amount", type: "money", required: true, ask: "What is the voucher amount?" },
    ], summarize: (f) => `Journal — ${f.narration ?? ""} · ${money(f.amount)}` },
  { key: "sales-invoice", label: "Sales Invoice", module: "sales", permission: "sales", createHref: "/sales/invoice",
    keywords: /\bsales invoice\b|\bb2b invoice\b|\bcreate invoice\b/, fields: [
      { key: "customer", label: "Customer", type: "text", required: true, ask: "Which customer is this invoice for?", master: "customer" },
      { key: "amount", label: "Amount", type: "money", required: true, ask: "What is the invoice amount?" },
    ], summarize: (f) => `Invoice — ${f.customer ?? ""} · ${money(f.amount)}` },
  { key: "purchase-order", label: "Purchase Order", module: "purchase", permission: "purchase", createHref: "/purchase/order",
    keywords: /\bpurchase order\b|\bpo\b|\braise order\b/, fields: [
      { key: "supplier", label: "Supplier", type: "text", required: true, ask: "Which supplier is the PO for?", master: "supplier" },
      { key: "amount", label: "Estimated Value", type: "money", required: true, ask: "What is the estimated order value?" },
    ], summarize: (f) => `PO — ${f.supplier ?? ""} · ${money(f.amount)}` },
  { key: "customer", label: "Customer", module: "masters", permission: "masters.customer", createHref: "/masters/customer",
    keywords: /\bcustomer\b/, fields: [
      { key: "name", label: "Customer Name", type: "text", required: true, ask: "What is the customer's name?" },
      { key: "phone", label: "Phone", type: "text", required: false, ask: "Phone number? (optional)" },
    ], summarize: (f) => `Customer — ${f.name ?? ""}${f.phone ? ` · ${f.phone}` : ""}` },
  { key: "supplier", label: "Supplier", module: "masters", permission: "masters.supplier", createHref: "/masters/supplier",
    keywords: /\bsupplier\b|\bvendor\b/, fields: [
      { key: "name", label: "Supplier Name", type: "text", required: true, ask: "What is the supplier's name?" },
      { key: "phone", label: "Phone", type: "text", required: false, ask: "Phone number? (optional)" },
    ], summarize: (f) => `Supplier — ${f.name ?? ""}${f.phone ? ` · ${f.phone}` : ""}` },
  { key: "budget-revision", label: "Budget Revision", module: "finance", permission: "finance.budget", createHref: "/finance/budget/revision",
    keywords: /\bbudget revision\b|\brevise budget\b/, fields: [
      { key: "head", label: "Budget Head", type: "text", required: true, ask: "Which budget head do you want to revise?" },
      { key: "amount", label: "Revision Amount", type: "money", required: true, ask: "By how much (increase/decrease)?" },
    ], summarize: (f) => `Budget revision — ${f.head ?? ""} · ${money(f.amount)}` },
  { key: "budget-transfer", label: "Budget Transfer", module: "finance", permission: "finance.budget", createHref: "/finance/budget/transfer",
    keywords: /\bbudget transfer\b|\btransfer budget\b/, fields: [
      { key: "fromHead", label: "From Head", type: "text", required: true, ask: "Transfer budget FROM which head?" },
      { key: "toHead", label: "To Head", type: "text", required: true, ask: "Transfer budget TO which head?" },
      { key: "amount", label: "Amount", type: "money", required: true, ask: "How much to transfer?" },
    ], summarize: (f) => `Transfer ${money(f.amount)} — ${f.fromHead ?? ""} → ${f.toHead ?? ""}` },
];

export function findTxType(message: string): TxType | null {
  const q = message.toLowerCase();
  let best: TxType | null = null; let bestLen = 0;
  for (const t of TX_TYPES) { const hit = q.match(t.keywords); if (hit && hit[0].length > bestLen) { best = t; bestLen = hit[0].length; } }
  return best;
}
export const txByKey = (key: string) => TX_TYPES.find((t) => t.key === key) ?? null;
