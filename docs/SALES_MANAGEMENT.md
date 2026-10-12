# Sales Management Module

Part of **ONE POS** — **Operations → Sales**. The operational layer where sales actually
happen. It is **100% configuration-driven**: every screen reads the **Sales Settings** rule
engine, the masters and the discount/tax/loyalty engines — there is **no hardcoded sales
behaviour**.

## The "no hardcode" contract

A single shared object, `DEFAULT_SALES_CONFIG`
([src/lib/settings/salesConfigDefaults.ts](src/lib/settings/salesConfigDefaults.ts)), is the
one source of truth:

- **Sales Settings** (`/settings/sales`) *edits* it — its form context is now just a clone of
  this object.
- **Sales Management** *obeys* it — every screen imports `field()`, `flag()`, `isOn()`,
  `enabledIds()`, `sampleBillNumber()` from the same file and branches on the values.

Each sales screen shows a **"Driven by Sales Settings"** strip listing the live rules it is
obeying, with a shortcut to change them. Change a toggle in Settings → the Sales screens
change behaviour. Nothing is hardcoded.

Integrations referenced: Product Master, Customer Master, Inventory, Discount Engine,
Loyalty Engine, Tax Engine, Payment Engine, Accounting, Notification Engine, AI Engine.

## Supported

Grocery · Pharmacy · Textile · Electronics · Hardware · Furniture · Cosmetics · Wholesale ·
Multi-Branch Chains — and both **B2C** and **B2B** sales.

## Routes (Operations → Sales)

| Route | Screen |
| --- | --- |
| `/sales` | Sales Dashboard (KPIs, channel mix, top products, active config) |
| `/sales/quotation` | Sales Quotation |
| `/sales/order` | Sales Order |
| `/sales/pos` | **POS Billing (B2C)** — interactive, config-driven |
| `/sales/invoice` | Sales Invoice (B2B) |
| `/sales/advance` | Advance Sales |
| `/sales/credit` | Credit Sales |
| `/sales/delivery` | Delivery Management |
| `/sales/return` | Sales Return |
| `/sales/exchange` | Sales Exchange |
| `/sales/cancellation` | Sales Cancellation |
| `/sales/collections` | Customer Collections |
| `/sales/outstanding` | Outstanding Management |
| `/sales/approval` | Sales Approval Workflow |
| `/sales/analytics` | Sales Analytics |
| `/sales/reports` | Sales Reports |

## Architecture

- `src/lib/settings/salesConfigDefaults.ts` — `DEFAULT_SALES_CONFIG` + read helpers +
  `sampleBillNumber()` (builds the bill no. purely from the numbering config).
- `src/lib/sales/salesData.ts` — the 16-feature catalog, dashboard stats, per-feature list
  config (KPIs, columns, sample rows, statuses), `configNotesFor()` (live rule strings per
  feature), and the POS product catalog.
- `src/components/sales/SalesListScaffold.tsx` — one config-driven transactional list page
  reused by 12 features (quotation, order, invoice, advance, credit, delivery, return,
  exchange, cancellation, collections, outstanding, approval). KPIs + config strip + search +
  status filters + table + pagination.
- `src/components/sales/PosBilling.tsx` — the B2C POS screen.

## POS Billing — how config drives it

| Config (Sales Settings) | Effect on POS |
| --- | --- |
| `taxMethod` inclusive/exclusive | Totals are back-calculated from MRP or tax is added on top |
| `priceSource` | The price column header & price used per line |
| `allowDiscounts` + `posScreen.discountColumn` | Shows/hides the per-line discount input (capped at max) |
| `posScreen.taxColumn / productStock / productImage / customerPanel` | Shows/hides those columns & panels |
| `enableLoyalty` | Shows the loyalty points earned on the bill |
| `walkInAllowed / mobileMandatoryB2c / gstMandatoryB2c` | Whether the bill can save without customer/mobile/GST |
| `allowCreditSales` | Whether the "Credit" payment mode appears |
| `enableAi` | Whether AI upsell/cross-sell suggestions appear |
| numbering config | The next bill number shown (Prefix·Branch·FY·Seq) |

## Sales workflow

```
Quotation → Sales Order → (POS Bill | B2B Invoice) → Delivery → Collection
                                   ↘ Return / Exchange / Cancellation → Credit Note
Advance ───────────────────────────↗ (adjusted against invoice)
Outstanding ← unpaid invoices → Collections → ledger
Overrides (discount/price/credit) → Approval Workflow → proceed
```

## Accounting integration (reference)

- **POS / Invoice:** Dr Cash/Bank/Debtors · Cr Sales · Cr Output GST (CGST/SGST or IGST).
- **Credit sale:** Dr Debtors · Cr Sales · Cr Output GST; ages into Outstanding.
- **Advance:** Dr Cash/Bank · Cr Customer Advance; reversed on adjustment.
- **Return:** Dr Sales Return + Output GST · Cr Debtors/Cash (credit note); stock restored.
- **Collection:** Dr Cash/Bank · Cr Debtors; allocates to invoices.
Tax split follows `taxMethod` and the CGST/SGST/IGST config; e-invoice/e-way bill fire when enabled.

## Validation rules (config-driven)

- Channel/customer/mobile/GST requirements come from the B2C/B2B flags.
- Credit bills validate limit & outstanding when those flags are on.
- Discounts capped by the max-discount config; over-limit → Approval Workflow.
- Expired/expiry & batch behaviour come from the Expiry/Batch config.

## Database design (reference)

- `sales_document` — id, type (quote/order/invoice/pos/credit_note…), no, branch_id,
  customer_id, channel, status, sub_total, discount, tax, round_off, net, created_by.
- `sales_document_line` — document_id, product_id, batch_id?, serial?, qty, uom, price,
  discount_pct, tax_pct, taxable, tax_amt, amount.
- `sales_payment` — document_id, mode, amount, ref, status.
- `sales_advance` — customer_id, amount, balance, against_document_id.
- `sales_return` / `sales_exchange` — against_document_id, lines, reason, credit_note_id.
- `customer_outstanding` — customer_id, document_id, due_date, amount, paid, ageing_bucket.
- `sales_approval` — document_id, type, level, status, requested_by, acted_by.

## API specification (reference)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/sales/config` | Effective sales config (drives every screen) |
| GET/POST | `/api/sales/:type` | List / create a document (quote, order, invoice, pos…) |
| POST | `/api/sales/quotation/:id/convert` | Quote → order/invoice |
| POST | `/api/sales/pos/checkout` | Save & print a B2C bill |
| POST | `/api/sales/:id/payment` | Record a payment / collection |
| POST | `/api/sales/:id/return` `/exchange` `/cancel` | Post-sales actions |
| GET | `/api/sales/outstanding` | Receivables ageing |
| POST | `/api/sales/approval/:id` | Approve / reject an override |
| GET | `/api/sales/analytics` · `/reports/:id` | Insights & reports |

## Responsive design

POS uses a two-pane desktop layout (catalog + cart/summary) that stacks on tablet/mobile;
list screens reflow filters and tables; the dashboard KPI grid scales 8 → 4 → 2 columns.

## AI features

Product recommendation, upsell & cross-sell on the POS, near-expiry clearance suggestions,
customer recommendations and discount suggestions — all gated by the `enableAi` /
`aiFeatures` config so they never appear unless switched on in Sales Settings.
