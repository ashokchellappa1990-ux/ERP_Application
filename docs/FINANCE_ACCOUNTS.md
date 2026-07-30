# Finance & Accounts Management Suite

Part of **ONE POS** — **Finance & Compliance → Finance & Accounts**. A complete accounting
suite with an **Accounting Rule Engine** that auto-creates journals for every standard ERP
transaction. **No manual entries are required** for standard flows.

Integrates with Sales, Purchase, Inventory, Customers, Suppliers, Banking, Payroll, Fixed
Assets, Taxation and Compliance.

## Routes (`/finance/*`) — 31 features

Dashboard · Financial Period · **Accounting Rule Engine** · Chart of Accounts · General
Ledger · Journal Entry (+new) · Receivables · Payables · Cash · Bank · Bank Reconciliation ·
Petty Cash · Expense (+new) · Recurring Income (+new) · Recurring Expense (+new) · Budget ·
Cost Center · Profit Center · Fixed Assets (+new) · Depreciation · GST · TDS · TCS ·
E-Invoice · E-Way Bill · Financial Closing · Multi-Branch Accounting · Audit · **AI Finance
Engine** · Finance Analytics · Financial Reports.

## Architecture

- `src/lib/finance/financeConfig.ts` — `DEFAULT_FINANCE_CONFIG` (period controls, auto-post
  flags per module, depreciation method, approval policy) + `fin`, `finFlag`, `financeDocNo`.
- `src/lib/finance/financeData.ts` — 31-feature catalog, **ACCOUNTING_RULES** (the rule
  engine: transaction → Dr/Cr per module), per-feature list configs, dashboard stats,
  voucher/journal form metas, 24 reports, `financeNotesFor()`.
- `src/components/finance/FinanceListScaffold.tsx` — config-driven list reused by 25 ledger/
  transaction features.
- `src/components/finance/FinanceVoucherForm.tsx` — **double-entry Journal** (Dr=Cr balancing)
  and **voucher** mode (expense / recurring income / recurring expense / fixed asset).
- Bespoke: Dashboard, **Accounting Rule Engine**, GST, AI Finance, Reports.

## Accounting Rule Engine (the core)

`/finance/rule-engine` shows the full auto-posting map; each module has an **Auto-Post toggle**
([financeData.ts → ACCOUNTING_RULES](src/lib/finance/financeData.ts)). Examples:

| Module | Transaction | Debit | Credit |
| --- | --- | --- | --- |
| Sales | Sales Invoice | Debtors / Cash / Bank | Sales + Output CGST/SGST/IGST |
| Sales | Customer Collection | Cash / Bank | Debtors |
| Purchase | GRN | Inventory (landed cost) | GRN Clearing (GRNI) |
| Purchase | Purchase Invoice | GRN Clearing + Input GST | Creditors |
| Inventory | Stock Write-Off | Inventory Write-Off (P&L) | Inventory |
| Assets | Depreciation | Depreciation Expense | Accumulated Depreciation |
| Taxation | GST Payment | GST Payable | Bank |
| Taxation | TDS Deduction | Expense / Creditors | TDS Payable |
| Banking | Bank Charges | Bank Charges (P&L) | Bank |
| Payroll | Salary Processing | Salary Expense | Salary Payable + TDS + PF/ESI |

Account legs resolve against the Chart of Accounts; tax legs (CGST/SGST/IGST, TDS, TCS) post
from the tax engine. Turning a module's toggle off switches it to manual journals.

## Financial Period Management

FY + monthly/quarterly/annual periods with **Open / Soft-Close / Lock / Audit-Lock**.
Controls: `backdatedRestriction`, `periodLock`, `auditLock` — a locked period rejects new/edited
vouchers.

## Approval workflow

`journalApproval`, `expenseApproval`, `paymentApproval`, `closureApproval` route the relevant
documents through approval before posting. Journal posting is blocked unless **Debit = Credit**.

## AI Finance Engine

Cash-flow / revenue / expense forecasts, collection prediction, GST risk alerts, working-
capital analysis, budget-variance, profitability and expense-optimisation suggestions.

## Database design (reference)

```
fin_period           (id, fy, name, from, to, type, status)               -- open/locked
account              (id, code, name, group, type, parent_id, is_system)  -- CoA
acct_rule            (id, module, txn, dr_account_id, cr_account_id, auto_post)
voucher              (id, type, no, date, branch_id, narration, status, posted_journal_id)
journal              (id, voucher_id, date, status, approved_by)
journal_line         (id, journal_id, account_id, debit, credit, cost_center_id, profit_center_id)
gl_balance           (account_id, branch_id, period_id, opening, debit, credit, closing)
ar_invoice / ap_bill (party_id, due_date, amount, paid, ageing)
bank_account / bank_txn / bank_recon
expense / recurring_income / recurring_expense (schedule, freq, next_run, auto_post)
fixed_asset / depreciation_run
budget (level, head, period, amount) ; cost_center ; profit_center
tax_ledger (gst/tds/tcs) ; einvoice ; eway_bill
audit_log (user, module, action, before, after, at)
```

## API specification (reference)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/finance/config` | Period + auto-post policy |
| GET/PUT | `/api/finance/rules` | Accounting rule map (Dr/Cr + auto-post) |
| POST | `/api/finance/post` | Engine entrypoint — ERP txn → journal |
| GET/POST | `/api/finance/journal` | Manual / adjustment / reversal journal |
| GET | `/api/finance/gl/:account` | Ledger with running balance |
| GET | `/api/finance/receivables` · `/payables` | Aging |
| POST | `/api/finance/expense` · `/recurring` | Vouchers & schedules |
| POST | `/api/finance/depreciation/run` | Period depreciation |
| GET | `/api/finance/gst|tds|tcs` | Tax workbench |
| POST | `/api/finance/period/:id/close` `/lock` | Closing |
| GET | `/api/finance/reports/:id` · `/ai` | Reports & AI |

## Validation rules

- Journal: **Debit = Credit**, non-zero, valid accounts; no posting into a **locked period**.
- Backdated entries blocked when `backdatedRestriction` is on.
- Expense/payment over threshold → approval; bank txn needs a valid bank account.
- GST/TDS/TCS payable reconciled before period close; closing checklist must be 100% done.

## Financial Reports (24)

Trial Balance · P&L · Balance Sheet · Trading A/c · Cash Flow · Fund Flow · GL · Day/Cash/
Bank Book · Journal Register · AR/AP Aging · Recurring Income/Expense · GST/TDS/TCS · Budget ·
Fixed Asset Register · Depreciation · Cost/Profit Center · Branch-wise Profitability.

## Responsive design

Bespoke screens (dashboard, rule engine, GST, AI) reflow cards/charts; list screens reflow
filters/tables; the journal/voucher form is two-column → stacked; dashboard KPI grid scales
11 → 6 → 2 columns.
