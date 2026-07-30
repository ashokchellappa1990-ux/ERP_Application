# Chart of Accounts Module — Specification

Finance & Accounting console for ONE POS — manages the full chart of accounts,
GST ledgers, cost/profit centers, opening balances and financial reports.
Supports financial, GST, inventory accounting, costing, budgeting and reporting
across retail, pharmacy, grocery, textile, electronics, wholesale and
multi-branch businesses.

- **Menu:** Finance & Compliance → Accounting → **Chart of Accounts**
- **Route:** `/accounting/chart-of-accounts`
- **Code:** `src/app/(app)/accounting/chart-of-accounts/page.tsx`, `src/components/finance/CoaConsole.tsx`, `src/lib/finance/coaConfig.ts`

---

## 1. Layout & UX

A single console: **dashboard stat row** (Account Groups · Ledgers · GST Ledgers ·
Cost Centers · Profit Centers · Bank Accounts) + a **left section rail** (grouped)
+ a gradient-headed content panel. Header actions: Import · AI Setup · Add Account.
Responsive: rail → dropdown below `lg`; tables scroll on POS/tablet/mobile.

---

## 2. The 12 sections

| Section | Content |
|---------|---------|
| Account Groups | Default 5-nature tree (Assets/Liabilities/Equity/Income/COGS/Expenses) + add/search/delete; fields: code, name, parent, type |
| Ledger Accounts | Ledgers with code, name, **account type** (Asset/Liability/Equity/Income/Expense), parent group; add/search/delete |
| GST & Tax Accounts | System ledgers — Input (CGST/SGST/IGST), Output (CGST/SGST/IGST), TDS Receivable/Payable |
| Bank Accounts | Bank, account no., branch, IFSC, type (Current/Savings/OD), default flag |
| Cash Accounts | System: Cash in Hand, Petty Cash |
| Cost Centers | Head Office, branches, warehouse, online — code/name/description |
| Profit Centers | Retail/Wholesale/Online/Pharmacy — code/name/description |
| Opening Balances | Editable debit/credit grid (Cash/Bank/Receivable/Payable/Inventory/GST) with **live balanced check** |
| AI COA Setup | Pick business type → generate groups/sales/purchase/inventory/GST/expense/bank → review & apply |
| Import COA | Sources: Excel/Tally/Busy/Zoho — auto-mapping, validation, error report |
| Approval Workflow | Draft → Pending → Approved/Rejected (maker-checker) |
| Financial Reports | Trial Balance, P&L, Trading A/c, Balance Sheet, Cash Flow, GST, Cost/Profit Center reports |

---

## 3. Validation rules

| Rule | Scope |
|------|-------|
| Unique account/group code | server |
| Account type required on ledger | client |
| Parent group must exist & match nature | server |
| Opening balances: total debit = total credit | client (live indicator) |
| GST ledgers created once (no duplicates) | server |
| IFSC format on bank accounts | server |
| Cannot delete a group/ledger with postings | server |
| COA must be Approved before posting transactions | server (maker-checker) |

---

## 4. Database design (suggested)

```
account_groups   id, company_id, code (uniq), name, parent_id, nature
                 (asset/liability/equity/income/expense), status
ledger_accounts  id, company_id, code (uniq), name, type, group_id,
                 description, is_system, status
gst_ledgers      id, company_id, code, name, kind(input/output/other), rate
bank_accounts    id, company_id, ledger_id, bank, account_no, branch, ifsc,
                 type, is_default
cash_accounts    id, company_id, ledger_id, name, is_petty
cost_centers     id, company_id, code (uniq), name, description, status
profit_centers   id, company_id, code (uniq), name, description, status
opening_balances id, company_id, ledger_id, debit, credit, fy
coa_approvals    id, company_id, status, maker_id, checker_id, remarks, at
journal_entries  id, company_id, date, narration, status   -- postings
journal_lines    id, entry_id, ledger_id, debit, credit, cost_center_id,
                 profit_center_id
```

Reports are derived from `journal_lines` aggregated over `ledger_accounts` →
`account_groups` (Trial Balance, P&L, Balance Sheet, Cash Flow), filtered by
`cost_center_id` / `profit_center_id` for center reports, and by `gst_ledgers`
for GST reports.

---

## 5. API design (suggested REST)

```
GET    /api/coa/dashboard            counts (groups/ledgers/gst/cost/profit/banks)
GET    /api/coa/groups               POST /api/coa/groups   PUT/DELETE /:id
GET    /api/coa/ledgers              POST /api/coa/ledgers  PUT/DELETE /:id
GET    /api/coa/gst-ledgers          POST /api/coa/gst-ledgers/seed   (create system set)
GET    /api/coa/banks                POST /api/coa/banks    PUT/DELETE /:id
GET    /api/coa/cost-centers         POST ...   GET /api/coa/profit-centers  POST ...
GET    /api/coa/opening              PUT  /api/coa/opening   (bulk; validates dr=cr)
POST   /api/coa/ai-generate          { businessType } → generated structure + confidence
POST   /api/coa/import               upload + source → { mapped, errors[] }
POST   /api/coa/submit | approve | reject     (maker-checker)
GET    /api/reports/trial-balance | profit-loss | trading | balance-sheet |
       cash-flow | gst | cost-center | profit-center   (?from&to&center)
```

---

## 6. AI setup flow

1. Ask **“What type of business do you operate?”** (Grocery / Pharmacy / Textile / Electronics / Wholesale).
2. `POST /api/coa/ai-generate` returns a vertical-tuned COA — groups, sales,
   purchase, inventory, GST, expense and bank accounts (with a confidence score).
3. Show the generated structure for **review**, then **Apply** to create the COA.

---

## 7. Development-ready notes

- Replace the seed arrays in `coaConfig.ts` with the `/api/coa/*` endpoints; the
  `ManagedList` add/delete maps to POST/DELETE.
- Opening Balances PUT should reject unless debit total = credit total (UI already
  shows the live balanced indicator).
- Gate posting screens (Sales/Purchase/Payments) on `coa_approvals.status = Approved`.
- Financial Reports tab links to the report endpoints above; render with the same
  table/print components.

---

© 2026 ONE POS — Chart of Accounts Module.
