import { prisma } from "@/lib/db/prisma";
import { registerModule } from "./moduleRegistry";

/**
 * Seeds the GLOBAL (tenantId null) AI foundation data: prompt categories, the ERP
 * module registry, the semantic dictionary, ready-made prompts and default settings.
 * Idempotent — re-running replaces the global seed rows only (never user data).
 */

const CATEGORIES = [
  { key: "Finance", name: "Finance", icon: "Landmark", sortOrder: 1 },
  { key: "Sales", name: "Sales", icon: "ReceiptText", sortOrder: 2 },
  { key: "Purchase", name: "Purchase", icon: "Truck", sortOrder: 3 },
  { key: "Inventory", name: "Inventory", icon: "Boxes", sortOrder: 4 },
  { key: "CRM", name: "CRM", icon: "Users", sortOrder: 5 },
  { key: "HR", name: "HR", icon: "UserCog", sortOrder: 6 },
  { key: "Dashboard", name: "Analytics & Dashboard", icon: "BarChart3", sortOrder: 7 },
  { key: "General", name: "General", icon: "Sparkles", sortOrder: 8 },
];

const MODULES = [
  { moduleKey: "finance", name: "Finance & Accounting", menu: "Finance", description: "General ledger, cash/bank, AR/AP, journals, P&L and financial health.",
    businessTerms: ["cash balance", "bank balance", "net profit", "working capital", "receivable", "payable", "ledger", "journal", "trial balance"],
    kpis: ["Cash Balance", "Bank Balance", "Net Profit", "Working Capital", "Receivables", "Payables", "Gross Profit"],
    questions: ["What is today's cash balance?", "Show net profit this month", "How much is outstanding receivable?"],
    actions: ["view-ledger", "post-journal", "view-pnl"], permissions: ["finance", "finance.journal", "finance.gl"], tables: ["GeneralLedger", "JournalVoucher", "CashBook"], relationships: ["Sales→Revenue", "Purchase→Expense"] },
  { moduleKey: "sales", name: "Sales & POS", menu: "Operations", description: "POS billing, sales invoices, revenue, customers and collections.",
    businessTerms: ["today's sales", "revenue", "sales order", "customer", "collection", "outstanding customer"],
    kpis: ["Total Sales", "Orders", "Average Bill Value", "Collections", "Top Customers"],
    questions: ["Show today's sales", "Which customer bought the most?", "Show pending customer collections"],
    actions: ["view-sales", "collect-payment"], permissions: ["sales", "finance.receivables"], tables: ["SalesInvoice", "Customer"], relationships: ["Customer→Sales", "Sales→Receivable"] },
  { moduleKey: "purchase", name: "Purchase & Suppliers", menu: "Operations", description: "Purchase invoices, GRN, supplier payments and payables.",
    businessTerms: ["supplier payment", "purchase", "payable", "vendor", "outstanding supplier", "grn"],
    kpis: ["Total Purchase", "Payables", "Top Suppliers", "Overdue Payments"],
    questions: ["Show pending supplier payments", "Which supplier is overdue?", "Total purchases this month"],
    actions: ["view-payables", "pay-supplier"], permissions: ["purchase", "finance.payables"], tables: ["PurchaseInvoice", "Supplier", "Payable"], relationships: ["Supplier→Payable"] },
  { moduleKey: "inventory", name: "Inventory & Stock", menu: "Operations", description: "Stock levels, valuation, low-stock, batches and serials.",
    businessTerms: ["inventory value", "stock", "low stock", "out of stock", "stock value", "reorder"],
    kpis: ["Inventory Value", "Low Stock Items", "Out of Stock", "Stock Turnover"],
    questions: ["Show low stock items", "What is my inventory value?", "Which items are out of stock?"],
    actions: ["view-stock", "reorder"], permissions: ["inventory"], tables: ["StockItem", "InventoryLot"], relationships: ["Purchase→Stock", "Sales→Stock"] },
  { moduleKey: "crm", name: "CRM & Loyalty", menu: "Customers", description: "Customer 360, loyalty, memberships and engagement.",
    businessTerms: ["loyalty points", "membership", "customer 360", "top customer", "lead"],
    kpis: ["Active Members", "Loyalty Points Issued", "Repeat Customers"],
    questions: ["Who are my top loyalty customers?", "How many active members?"],
    actions: ["view-customer-360"], permissions: ["crm", "loyalty"], tables: ["Customer", "LoyaltyLedger"], relationships: ["Customer→Loyalty"] },
  { moduleKey: "statutory", name: "GST / TDS / TCS Compliance", menu: "Finance", description: "GST, TDS and TCS liabilities, payments and returns.",
    businessTerms: ["gst payable", "gst", "tds", "tcs", "input gst", "output gst", "net gst", "return due"],
    kpis: ["Net GST", "GST Payment Due", "TDS Pending", "TCS Pending"],
    questions: ["What is my GST liability this month?", "How much TDS is pending?", "When is the GST return due?"],
    actions: ["view-gst", "pay-statutory"], permissions: ["finance.statutory-compliance", "finance.gst-compliance"], tables: ["StatutoryLiability", "StatutoryPayment"], relationships: ["Sales→OutputGST", "Purchase→InputGST"] },
  { moduleKey: "budget", name: "Budget & Cost Control", menu: "Finance", description: "Budget utilization, variance, cost & profit centre analysis.",
    businessTerms: ["budget utilization", "budget", "variance", "over budget", "cost centre", "profit centre", "branch profit"],
    kpis: ["Budget", "Actual", "Utilization %", "Variance", "Profit by Centre"],
    questions: ["What is my budget utilization?", "Which department is over budget?", "Show branch wise profit"],
    actions: ["view-budget"], permissions: ["finance.budget"], tables: ["Budget", "CostCentre", "ProfitCentre"], relationships: ["Expense→CostCentre"] },
  { moduleKey: "dashboard", name: "Analytics & Dashboards", menu: "Intelligence", description: "Executive KPIs, trends, business health and AI insights.",
    businessTerms: ["dashboard", "kpi", "trend", "business health", "summary", "forecast"],
    kpis: ["Business Health Score", "Revenue Trend", "Expense Trend", "Priority Score"],
    questions: ["What is my business health score?", "Show revenue vs expense trend", "Any financial alerts?"],
    actions: ["open-dashboard"], permissions: ["finance", "dashboard"], tables: ["Dashboard"], relationships: [] },
  { moduleKey: "advance", name: "Advance Management", menu: "Finance", description: "Customer, supplier and employee advances, settlements, refunds and outstanding advance balances.",
    businessTerms: ["customer advance", "supplier advance", "employee advance", "advance settlement", "advance refund", "advance balance", "pending settlement", "security deposit", "advance ageing", "advance outstanding"],
    kpis: ["Outstanding Advances", "Open Advances", "Pending Advance Approval", "Settled Advances"],
    questions: ["Show outstanding customer advances", "Which supplier advances are pending settlement?", "Total employee advances outstanding", "Show advances awaiting approval", "Explain the advance history for this customer"],
    actions: ["view-advances", "settle-advance", "refund-advance"], permissions: ["finance.advance"], tables: ["Advance", "AdvanceSettlement", "AdvanceRefund"], relationships: ["Customer→Advance", "Supplier→Advance", "Advance→Settlement", "Advance→SalesInvoice", "Advance→PurchaseInvoice"] },
];

const SEMANTIC: { term: string; entity: string; kpi?: string; moduleKey: string; definition?: string; synonyms?: string[] }[] = [
  { term: "Today's Sales", entity: "Sales.today", kpi: "Total Sales", moduleKey: "sales", definition: "Total value of completed sales invoices dated today.", synonyms: ["sales today", "today sales", "daily sales"] },
  { term: "Outstanding Receivable", entity: "Receivables.outstanding", kpi: "Receivables", moduleKey: "finance", definition: "Amount customers still owe (unpaid/partly-paid invoices).", synonyms: ["receivable", "amount to collect", "customer dues", "debtors"] },
  { term: "Budget Utilization", entity: "Budget.utilization", kpi: "Utilization %", moduleKey: "budget", definition: "Actual spend as a percent of approved budget.", synonyms: ["budget used", "budget utilisation", "budget consumed"] },
  { term: "Supplier Payment", entity: "Payables.due", kpi: "Payables", moduleKey: "purchase", definition: "Amounts owed to suppliers, with due dates.", synonyms: ["pending supplier payment", "vendor payment", "creditors"] },
  { term: "Inventory Value", entity: "Inventory.value", kpi: "Inventory Value", moduleKey: "inventory", definition: "Total valuation of stock on hand.", synonyms: ["stock value", "stock valuation"] },
  { term: "Branch Profit", entity: "ProfitCentre.profit", kpi: "Profit by Centre", moduleKey: "budget", definition: "Net profit attributed to a branch / profit centre.", synonyms: ["branch wise profit", "profit by branch", "store profit"] },
  { term: "Cash Balance", entity: "Cash.balance", kpi: "Cash Balance", moduleKey: "finance", definition: "Closing balance of cash-in-hand.", synonyms: ["cash in hand", "cash position"] },
  { term: "Net Profit", entity: "PnL.netProfit", kpi: "Net Profit", moduleKey: "finance", definition: "Total income minus total expense for the period.", synonyms: ["profit", "bottom line"] },
  { term: "GST Payable", entity: "GST.net", kpi: "Net GST", moduleKey: "statutory", definition: "Net GST due after input tax credit.", synonyms: ["gst liability", "gst due", "net gst"] },
  { term: "Outstanding Advances", entity: "Advance.outstanding", kpi: "Outstanding Advances", moduleKey: "advance", definition: "Unsettled advance balances (customer/supplier/employee) still to be adjusted or refunded.", synonyms: ["advance balance", "pending advance", "unsettled advance", "advance outstanding", "advances given", "advances received"] },
  { term: "Pending Settlement", entity: "Advance.pendingSettlement", moduleKey: "advance", definition: "Advances with a remaining balance awaiting settlement against invoices or expenses.", synonyms: ["advance to settle", "unadjusted advance", "settlement pending"] },
  { term: "Low Stock", entity: "Inventory.lowStock", kpi: "Low Stock Items", moduleKey: "inventory", definition: "Items at or below their reorder level.", synonyms: ["low stock items", "reorder items", "running low"] },
  { term: "TDS Pending", entity: "TDS.pending", kpi: "TDS Pending", moduleKey: "statutory", definition: "TDS deducted but not yet paid to government.", synonyms: ["tds due", "pending tds"] },
  { term: "Business Health", entity: "Dashboard.health", kpi: "Business Health Score", moduleKey: "dashboard", definition: "Composite 0–100 financial well-being score.", synonyms: ["health score", "business health score"] },
];

const PROMPTS: { category: string; title: string; promptText: string; description: string }[] = [
  { category: "Sales", title: "Today's sales", promptText: "Show today's total sales, number of orders and average bill value.", description: "Daily sales snapshot" },
  { category: "Sales", title: "Top customers", promptText: "Who are my top 5 customers by sales this month?", description: "Best customers" },
  { category: "Finance", title: "Today's cash balance", promptText: "What is today's cash and bank balance?", description: "Cash position" },
  { category: "Finance", title: "Net profit", promptText: "What is my net profit this month vs last month?", description: "Profitability" },
  { category: "Purchase", title: "Pending supplier payments", promptText: "Show pending supplier payments and which are overdue.", description: "Payables" },
  { category: "Inventory", title: "Low stock items", promptText: "Show items that are low on stock or out of stock.", description: "Stock alerts" },
  { category: "Budget", title: "Branch wise profit", promptText: "Show branch wise / profit-centre profit for this month.", description: "Branch profitability" },
  { category: "Finance", title: "GST liability", promptText: "What is my GST liability this month and when is the return due?", description: "GST compliance" },
  { category: "Dashboard", title: "Business health", promptText: "What is my business health score and any financial alerts?", description: "Health overview" },
  { category: "Budget", title: "Budget utilization", promptText: "What is my budget utilization and which heads are over budget?", description: "Budget control" },
];

export async function seedAiFoundation() {
  // Categories (global)
  await prisma.aiPromptCategory.deleteMany({ where: { tenantId: null } });
  await prisma.aiPromptCategory.createMany({ data: CATEGORIES.map((c) => ({ tenantId: null, ...c })) });

  // Module registry (global)
  await prisma.aiModuleRegistry.deleteMany({ where: { tenantId: null } });
  for (const m of MODULES) await registerModule(null, m);

  // Semantic dictionary (global)
  await prisma.aiSemanticDictionary.deleteMany({ where: { tenantId: null } });
  await prisma.aiSemanticDictionary.createMany({ data: SEMANTIC.map((s) => ({ tenantId: null, term: s.term, normalized: s.term.toLowerCase(), moduleKey: s.moduleKey, entity: s.entity, kpi: s.kpi ?? null, definition: s.definition ?? null, synonyms: JSON.stringify(s.synonyms ?? []) })) });

  // Ready-made prompts (global, isSystem)
  await prisma.aiPromptLibrary.deleteMany({ where: { tenantId: null, isSystem: true } });
  await prisma.aiPromptLibrary.createMany({ data: PROMPTS.map((p) => ({ tenantId: null, category: p.category, title: p.title, promptText: p.promptText, description: p.description, isSystem: true, shared: true })) });

  // Default global settings row.
  const existing = await prisma.aiSettings.findFirst({ where: { tenantId: null } });
  if (!existing) await prisma.aiSettings.create({ data: { tenantId: null } });

  return { categories: CATEGORIES.length, modules: MODULES.length, semantic: SEMANTIC.length, prompts: PROMPTS.length };
}
