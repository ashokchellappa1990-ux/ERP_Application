# Purchase Management Module

Part of **ONE POS** — **Operations → Purchase**. The procure-to-pay layer. Like the Sales
module it is **policy-driven**: every screen reads `DEFAULT_PURCHASE_CONFIG` (the procurement
policy) plus the Product, Supplier and Inventory masters — **no hardcoded procurement logic**.

## Supported

Grocery · Pharmacy · Textile · Electronics · Hardware · Furniture · Cosmetics · Wholesale ·
Multi-Branch Chains.

## Routes (Operations → Purchase)

| Route | Screen |
| --- | --- |
| `/purchase` | Purchase Dashboard (KPIs, spend, top suppliers, policy) |
| `/purchase/requisition` | Purchase Requisition (+ `/new`) |
| `/purchase/rfq` | RFQ Management (+ `/new`) |
| `/purchase/comparison` | **Supplier Comparison** (quote matrix, AI pick) |
| `/purchase/order` | Purchase Order (+ `/new`) |
| `/purchase/approval` | Purchase Approval queue |
| `/purchase/grn` | Goods Receipt Note (+ `/new`) |
| `/purchase/invoice` | Purchase Invoice / 3-way match (+ `/new`) |
| `/purchase/landedcost` | Landed Cost Allocation (+ `/new`) |
| `/purchase/return` | Purchase Return (+ `/new`) |
| `/purchase/debitnote` | Debit Note (+ `/new`) |
| `/purchase/payments` | Supplier Payments (+ `/new`) |
| `/purchase/planning` | **AI Purchase Planning** (reorder engine) |
| `/purchase/forecasting` | **Demand Forecasting** |
| `/purchase/reports` | Purchase Reports |

## Procurement policy (the "no hardcode" contract)

`src/lib/purchase/purchaseConfig.ts` → `DEFAULT_PURCHASE_CONFIG` is the single source of
truth that every screen obeys:

- `costingMethod` (FIFO), `taxMethod` (exclusive), `landedBasis` (value/qty/weight)
- `approvalThreshold`, `maxApprovalLevels`, `multiLevelApproval`
- `threeWayMatch`, `grnBeforeInvoice`, `gstMandatorySupplier`
- `grnTolerancePct`, `allowOverReceipt`, `qcOnReceipt`, `batchExpiryOnReceipt`
- `landedCostEnabled`, `autoReorderSuggestion`, `eWayBillCapture`

Each screen shows a **"Procurement policy"** strip listing the live rules it applies, via
`purchaseNotesFor(featureKey)`.

## Architecture

- `src/lib/purchase/purchaseConfig.ts` — policy + helpers (`pf`, `pflag`, `purchaseDocNo`).
- `src/lib/purchase/purchaseData.ts` — 15-feature catalog, per-feature list configs, create-form
  metadata, sample data, suppliers, stats, reports, `purchaseNotesFor()`.
- `src/components/purchase/PurchaseListScaffold.tsx` — one policy-driven list page reused by
  10 features (requisition, rfq, order, approval, grn, invoice, landedcost, return, debitnote, payments).
- `src/components/purchase/PurchaseDocumentForm.tsx` — create form: **items** docs (with
  editable cost rate + tax-method totals) and **reference** docs (field-driven).
- Bespoke pages: Dashboard, Supplier Comparison, AI Planning, Demand Forecasting, Reports.

## Procurement workflow

```
Requisition (PR) → RFQ → Supplier Comparison → Purchase Order → Approval
   → Goods Receipt (GRN + QC + batch/expiry) → Landed Cost → Purchase Invoice (3-way match)
   → Supplier Payment
        ↘ Purchase Return → Debit Note (stock + GST reversal)
AI Planning / Demand Forecast feed Requisition & PO proactively.
```

## Approval workflow

Driven by `approvalThreshold` + `multiLevelApproval` + `maxApprovalLevels`. A PR/PO/invoice
above the threshold escalates: **Requestor → Manager (L1) → Finance (L2) → Admin (L3)**.
Invoices failing the 3-way match route to a mismatch review before approval.

## 3-way match (Purchase Invoice)

When `threeWayMatch` is on, an invoice is auto-matched on **PO ↔ GRN ↔ Invoice** for
quantity and rate within tolerance. Matches post straight through; mismatches are held.
When `grnBeforeInvoice` is on, an invoice cannot be booked before its GRN.

## Landed cost

When `landedCostEnabled`, freight/duty/insurance/clearing are allocated across received
items by the configured **basis** (value/qty/weight), uplifting item cost for valuation.

## Accounting integration (reference)

- **GRN:** Dr Inventory (at PO/landed cost) · Cr GRN-Clearing (goods received not invoiced).
- **Invoice:** Dr GRN-Clearing + Input GST · Cr Supplier (Creditors).
- **Landed cost:** Dr Inventory · Cr Freight/Duty/Clearing payable.
- **Return:** Dr Supplier · Cr Inventory + Input GST reversal (via Debit Note).
- **Payment:** Dr Supplier · Cr Bank/Cash. Costing follows `costingMethod`.

## Validation rules (policy-driven)

- Supplier + GSTIN required when `gstMandatorySupplier`.
- Receipt qty within `grnTolerancePct` unless `allowOverReceipt`.
- Invoice requires a matching GRN when `grnBeforeInvoice`; rate/qty within match tolerance.
- PR/PO above `approvalThreshold` cannot proceed without approval.
- Payments only against matched/approved invoices.

## AI features

- **AI Purchase Planning** — reorder engine reading stock, ROL, lead time, sales velocity &
  seasonality; suggests qty + best supplier + urgency; one-click POs.
- **Demand Forecasting** — actual-vs-forecast projection, stock-cover & reorder signals.
- **Supplier Comparison** — auto-highlights the lowest landed-cost quote within policy.

## Database design (reference)

- `purchase_document` — id, type (pr/rfq/po/grn/invoice/return/dn/payment/lc), no, branch_id,
  supplier_id, status, sub_total, tax, total, ref_document_id, created_by.
- `purchase_document_line` — document_id, product_id, qty, rate, disc_pct, tax_pct, amount,
  batch?, expiry?, received_qty?, accepted_qty?.
- `rfq_quote` — rfq_id, supplier_id, line rates, lead_time, terms, rating, total.
- `landed_cost` — grn_id, head, amount, basis, allocated JSONB.
- `three_way_match` — invoice_id, po_id, grn_id, qty_match, rate_match, status.
- `supplier_outstanding` — supplier_id, invoice_id, due_date, amount, paid, ageing.
- `purchase_approval` — document_id, level, status, acted_by.

## API specification (reference)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/purchase/config` | Effective procurement policy |
| GET/POST | `/api/purchase/:type` | List / create a document |
| POST | `/api/purchase/rfq/:id/quote` | Capture a supplier quote |
| GET | `/api/purchase/rfq/:id/compare` | Quote comparison matrix |
| POST | `/api/purchase/po/:id/approve` | Approve / reject (level) |
| POST | `/api/purchase/grn` | Receive against PO (+ QC, batch) |
| POST | `/api/purchase/grn/:id/landed-cost` | Allocate landed cost |
| POST | `/api/purchase/invoice/:id/match` | Run 3-way match |
| POST | `/api/purchase/:id/return` · `/debit-note` | Returns & debit notes |
| POST | `/api/purchase/payment` | Pay supplier(s) |
| GET | `/api/purchase/planning` · `/forecast` | AI planning & forecast |
| GET | `/api/purchase/reports/:id` | Reports |

## Responsive design

List screens reflow filters/tables; the create form is a two-column layout (items/supplier +
document/summary) that stacks on tablet/mobile; the dashboard KPI grid scales 8 → 4 → 2.
