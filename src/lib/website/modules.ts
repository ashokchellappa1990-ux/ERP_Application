/**
 * Detailed ERP module catalogue that powers the dedicated /platform page and the
 * per-module /platform/[slug] detail pages. This is deep product content kept in
 * code (the CMS manages the marketing home page; this is the reference-grade
 * module documentation the "View all modules" button links to).
 */

export interface ModuleDetail {
  slug: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  features: string[];
  benefits: string[];
}
export interface ModuleCategory { key: string; title: string; blurb: string; icon: string; modules: ModuleDetail[] }

export const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    key: "sales", title: "Sales & Point of Sale", icon: "ShoppingCart", blurb: "Sell faster across every counter, channel and customer.",
    modules: [
      { slug: "sales-management", name: "Sales Management", icon: "ShoppingCart", tagline: "Quote to cash, end to end", description: "Run the complete order-to-cash cycle — quotations, sales orders, invoicing, returns and exchanges — with real-time stock, pricing and credit control on every line.", features: ["Quotations, sales orders & invoices", "B2B & B2C billing with GST", "Sales returns, exchanges & cancellations", "Price lists, schemes & discount rules", "Credit limits & outstanding control", "Multi-branch & multi-warehouse"], benefits: ["Faster billing, fewer errors", "Real-time margin visibility", "Tighter receivables control"] },
      { slug: "pos", name: "Point of Sale (POS)", icon: "Monitor", tagline: "Lightning-fast, offline-ready billing", description: "A touch-ready POS built for speed at the counter — barcode scanning, split tenders, held bills and day-close reconciliation, with resilience when the network drops.", features: ["Touch & keyboard billing", "Barcode / QR / weight-scale support", "Split & multi-mode payments", "Hold, recall & park bills", "Cashier shifts & day-close", "Offline resilience"], benefits: ["Shorter queues at the counter", "Accurate cash reconciliation", "Works even when internet fails"] },
      { slug: "crm", name: "CRM", icon: "Users", tagline: "Know every customer, deepen every relationship", description: "A 360° customer view spanning purchases, loyalty, outstanding, service history and analytics — with segmentation, pipelines and follow-ups to grow lifetime value.", features: ["360° customer profiles", "Segmentation & RFM analytics", "Leads & opportunity pipeline", "Loyalty, membership & rewards", "Service & complaint history", "Birthday / anniversary automation"], benefits: ["Higher repeat purchase rate", "Personalised customer engagement", "Data-driven retention"] },
      { slug: "service-management", name: "Service Management", icon: "Wrench", tagline: "Warranty, tickets & field service", description: "Track serial-wise warranty, log service tickets and manage field jobs from complaint to resolution — keeping customers informed at every step.", features: ["Serial / IMEI warranty tracking", "Service tickets & SLAs", "Field-service scheduling", "Spare-parts consumption", "Complaint management", "Customer notifications"], benefits: ["Faster resolution times", "Higher CSAT", "Full service traceability"] },
    ],
  },
  {
    key: "purchase", title: "Purchase & Supply Chain", icon: "Truck", blurb: "Buy smarter and keep the shelves stocked.",
    modules: [
      { slug: "purchase-management", name: "Purchase Management", icon: "Truck", tagline: "From PO to payment, controlled", description: "Manage the full procurement cycle — purchase orders, goods receipt, supplier bills and purchase returns — with three-way matching and supplier outstanding control.", features: ["Purchase orders & requisitions", "Goods Receipt Note (GRN)", "Supplier invoices & 3-way match", "Purchase returns / debit notes", "Landed cost & tax handling", "Supplier outstanding & ageing"], benefits: ["Prevent over-billing", "Accurate landed costs", "Stronger supplier control"] },
      { slug: "scm", name: "Supply Chain", icon: "Network", tagline: "End-to-end visibility", description: "Connect demand, procurement and fulfilment across locations with schemes, claims and distribution flows — so stock moves to where it sells.", features: ["Demand-driven procurement", "Stock transfers between branches", "Distribution schemes & claims", "Supplier & vendor management", "Lead-time planning", "Fulfilment tracking"], benefits: ["Fewer stock-outs", "Balanced inventory across sites", "Lower carrying cost"] },
      { slug: "warehouse", name: "Warehouse Management", icon: "Warehouse", tagline: "Every bin, batch and location", description: "Multi-location, multi-warehouse stock with transfers, bin control and reconciliation — plus batch, serial and expiry tracking down to the unit.", features: ["Multi-warehouse & bin locations", "Stock transfers & adjustments", "Batch, serial & expiry tracking", "Physical stock reconciliation", "FEFO / FIFO valuation", "Barcode-driven operations"], benefits: ["Accurate on-hand stock", "Reduced shrinkage", "Audit-ready inventory"] },
    ],
  },
  {
    key: "inventory", title: "Inventory & Quality", icon: "Boxes", blurb: "Precise stock control with quality built in.",
    modules: [
      { slug: "inventory", name: "Inventory Management", icon: "Boxes", tagline: "One accurate, real-time stock ledger", description: "A live inventory ledger with batch, serial, expiry and barcode tracking, valuation and ageing — so you always know what you have, where, and what it's worth.", features: ["Real-time stock ledger", "Batch / serial / expiry / IMEI", "Stock valuation (FIFO / FEFO)", "Reorder levels & alerts", "Dead-stock & ageing analysis", "Barcode & QR generation"], benefits: ["Zero guesswork on stock", "Less dead stock", "Optimised reorder timing"] },
      { slug: "quality", name: "Quality Management", icon: "BadgeCheck", tagline: "Inspect, control, comply", description: "Define inspection plans, capture QC results at receipt and production, and quarantine non-conforming stock — with full compliance traceability.", features: ["Inspection plans & checklists", "Incoming & in-process QC", "Quarantine & rejection handling", "Batch-wise compliance records", "Non-conformance tracking", "Audit trails"], benefits: ["Consistent product quality", "Regulatory compliance", "Fewer customer returns"] },
    ],
  },
  {
    key: "finance", title: "Finance, GST & Assets", icon: "Landmark", blurb: "Accurate books and statutory compliance by default.",
    modules: [
      { slug: "finance", name: "Finance & Accounting", icon: "Landmark", tagline: "Real-time, double-entry accounting", description: "A complete finance suite — general ledger, payables, receivables, cash & bank, and financial statements — posted automatically from every transaction.", features: ["Double-entry general ledger", "Accounts payable & receivable", "Cash, bank & fund management", "Expense & budget control", "P&L, Balance Sheet, Cash Flow, Trial Balance", "Multi-company consolidation"], benefits: ["Always-current books", "No manual journal entry", "Board-ready statements"] },
      { slug: "gst", name: "GST & E-Invoice", icon: "ReceiptText", tagline: "Statutory GST, built in", description: "Generate GSTR-1, 2B, 3B and 9, reconcile input tax credit, and produce e-invoices (IRN) and e-way bills — accurate straight from your transactions.", features: ["GSTR-1 / 2B / 3B / 9 returns", "E-Invoice (IRN) generation", "E-Way Bill generation", "Input Tax Credit reconciliation", "HSN & tax-rate management", "GST audit reports"], benefits: ["Filing in minutes, not days", "Fewer notices & mismatches", "Maximised ITC"] },
      { slug: "assets", name: "Asset Management", icon: "Building", tagline: "Track and depreciate every asset", description: "Maintain a fixed-asset register with depreciation, AMC and maintenance schedules — from acquisition to disposal.", features: ["Fixed-asset register", "Depreciation schedules", "AMC & maintenance tracking", "Asset transfers & disposal", "Barcode asset tagging", "Asset-wise reporting"], benefits: ["Accurate asset valuation", "Planned maintenance", "Compliance-ready records"] },
    ],
  },
  {
    key: "manufacturing", title: "Manufacturing", icon: "Factory", blurb: "Plan, produce and control the shop floor.",
    modules: [
      { slug: "manufacturing", name: "Manufacturing", icon: "Factory", tagline: "BOM to finished goods", description: "Run production with multi-level bills of material, work orders and shop-floor control — with real-time material consumption and yield tracking.", features: ["Multi-level BOM", "Work orders & routing", "Shop-floor execution", "Material consumption & yield", "By-product & scrap handling", "WIP valuation"], benefits: ["Lower production cost", "Real-time WIP visibility", "Better yield control"] },
      { slug: "production-planning", name: "Production Planning", icon: "ClipboardList", tagline: "Schedule with confidence", description: "Plan production against demand and capacity, sequence work orders and balance the load across lines and machines.", features: ["Demand-based planning", "Capacity & load balancing", "Work-order scheduling", "Material availability check", "Production calendar", "Plan-vs-actual tracking"], benefits: ["On-time production", "Optimised capacity use", "Fewer bottlenecks"] },
      { slug: "mrp", name: "Material Requirement Planning", icon: "Repeat", tagline: "Never run short of materials", description: "MRP explodes demand into material requirements, nets against stock and open POs, and generates purchase and production suggestions automatically.", features: ["Demand explosion via BOM", "Net requirement calculation", "Reorder & lead-time planning", "Auto purchase / production suggestions", "Safety-stock handling", "What-if planning"], benefits: ["Fewer shortages", "Lower inventory holding", "Automated procurement"] },
    ],
  },
  {
    key: "people", title: "HR & Payroll", icon: "UserCog", blurb: "Manage your people from hire to retire.",
    modules: [
      { slug: "hrms", name: "HRMS", icon: "UserCog", tagline: "The complete employee lifecycle", description: "Manage employees, attendance, shifts, leave and performance — with employee self-service on mobile for a modern workforce.", features: ["Employee master & documents", "Attendance & shift management", "Leave & holiday policies", "Performance & appraisals", "Recruitment & onboarding", "Employee self-service"], benefits: ["Less HR paperwork", "Accurate attendance", "Engaged employees"] },
      { slug: "payroll", name: "Payroll", icon: "Wallet", tagline: "Accurate salaries, every cycle", description: "Automate salary processing with statutory compliance, loans, advances, claims and payslips — integrated directly with attendance and finance.", features: ["Automated salary processing", "Statutory compliance (PF/ESI/TDS)", "Loans, advances & recovery", "Claims & reimbursements", "Digital payslips", "Payroll registers & reports"], benefits: ["Error-free payroll", "On-time salaries", "Full compliance"] },
    ],
  },
  {
    key: "ops", title: "Operations & Intelligence", icon: "BarChart3", blurb: "Govern, collaborate and decide with data.",
    modules: [
      { slug: "projects", name: "Project Management", icon: "KanbanSquare", tagline: "Deliver projects on time and on budget", description: "Plan tasks and milestones, track project costing and monitor progress across teams — with budgets and billing tied to finance.", features: ["Tasks & milestones", "Gantt & Kanban views", "Project costing & budgets", "Resource allocation", "Time & expense tracking", "Project P&L"], benefits: ["On-time delivery", "Cost visibility", "Better resource use"] },
      { slug: "workflow", name: "Approval Workflow", icon: "GitPullRequest", tagline: "Control without the bottlenecks", description: "Configure multi-level approvals for any document — purchase, sales, expense, payroll — with rules, escalations and full audit trails.", features: ["Configurable approval rules", "Multi-level hierarchies", "Amount-based routing", "Escalations & reminders", "Mobile approvals", "Complete audit trail"], benefits: ["Stronger governance", "Faster approvals", "Full accountability"] },
      { slug: "documents", name: "Document Management", icon: "FileText", tagline: "Every document, controlled", description: "Attach, version and control documents against any record — invoices, GRNs, contracts — with access control and searchability.", features: ["Attach files to any record", "Versioning & history", "Access control", "Full-text search", "Templates & e-sign ready", "Retention policies"], benefits: ["Paperless operations", "Instant retrieval", "Audit compliance"] },
      { slug: "analytics", name: "Analytics & BI", icon: "BarChart3", tagline: "Decisions powered by live data", description: "Live dashboards, drill-down reports and AI insights across every module — plus natural-language reporting and a business health score.", features: ["Role-based live dashboards", "Drill-down & drill-through reports", "AI forecasting & insights", "Business health score", "Natural-language reports", "Scheduled report delivery"], benefits: ["Faster, better decisions", "One source of truth", "Proactive alerts"] },
    ],
  },
];

export const ALL_MODULES: ModuleDetail[] = MODULE_CATEGORIES.flatMap((c) => c.modules);
export function findModule(slug: string): { module: ModuleDetail; category: ModuleCategory } | null {
  for (const c of MODULE_CATEGORIES) { const m = c.modules.find((x) => x.slug === slug); if (m) return { module: m, category: c }; }
  return null;
}
