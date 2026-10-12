# Opening Stock Setup Module

Part of **ONE POS** — Masters group. Used during ERP **implementation & migration** to
initialize inventory before **Go-Live**. Captures opening balances across branch,
warehouse, batch, expiry, serial, lot and multi-UOM dimensions, values them, and posts
the opening accounting journal automatically.

## Supported verticals

Grocery · Pharmacy · Textile · Electronics · Hardware · Furniture · Cosmetics ·
Automobile Spares · Wholesale · Multi-Branch Retail Chains.

## Routes

| Route | Purpose |
| --- | --- |
| `/masters/opening-stock` | Dashboard (7 KPIs) + searchable/filterable batch list + Reports |
| `/masters/opening-stock/new` | Create an opening-stock batch (12-tab editor) |
| `/masters/opening-stock/[id]` | Edit an existing batch (hydrated from sample data) |

Sidebar: **System → Masters → Opening Stock Setup** (`Warehouse` icon).

## Architecture

Mirrors the Product / Supplier / Customer / Discount master pattern:

- `src/lib/masters/openingStockConfig.ts` — tabs, option arrays, field definitions,
  verification checks, AI validations, approval chain, `OpeningStockRow` / `OSStatus`
  types, `SAMPLE_OPENING_STOCK`, `OPENING_STOCK_STATS`, `REPORTS`.
- `src/components/masters/OpeningStockFormContext.tsx` — `OpeningStockFormProvider` /
  `useOpeningStockForm()`; holds `fields`, `toggles` (dimensions / import sources / AI
  checks), `flags`, repeatable `rows` (batches / serials / lots / uoms), `approvalStatus`;
  `validate()` and edit-mode `prefill`.
- `src/components/masters/OpeningStockEditor.tsx` — 12 tab bodies rendered through the
  shared `EditorShell` (top horizontal stepper + right Summary/Progress/AI panel).

## The 12 tabs

1. **Stock Entry** — product, location (branch / warehouse / bin), inventory (qty, UOM,
   cost, MRP, selling), stock date (defaults to Go-Live), tracking dimensions.
2. **Batch Info** — batch number, mfg/expiry dates, qty, cost, MRP — multiple batches per product.
3. **Serial Numbers** — serial/IMEI, product, warehouse, cost — bulk upload supported.
4. **Lot Management** — lot number, lot qty, mfg/expiry dates.
5. **Multi UOM** — base & alternate UOMs with conversion factors (e.g. 1 Bag = 25 KG).
6. **Valuation** — FIFO / Weighted Average / Standard Cost; opening value, cost, average.
7. **Accounting** — account mapping + balanced preview (Inventory Dr / Opening Balance Cr).
8. **Import** — Excel, CSV, Tally, Busy, Marg, Zoho, ERPNext; template / validation / error reports.
9. **AI Import Assistant** — upload Excel / ERP export / stock sheet / PDF; AI column
   mapping, product & warehouse matching, duplicate / batch / expiry / costing validation
   with confidence scores.
10. **Verification** — duplicate, negative stock, invalid batch/expiry, missing
    warehouse/product, zero-cost checks with error & warning counts.
11. **Approval** — Draft → Pending Verification → Pending Approval → Approved / Rejected;
    chain: Inventory Executive → Store Manager → Finance Manager → Admin.
12. **Audit Trail** — user, date, action, quantity & cost changes, approval history.

## Dashboard KPIs (`OPENING_STOCK_STATS`)

Products Loaded · Quantity Loaded · Stock Value · Batches Loaded · Warehouses ·
Pending Validation · Pending Approvals.

Quick action: **Add Opening Stock** (Import / Verify / Accounting / Submit live inside the editor tabs).

## Reports (`REPORTS`)

Opening Stock Summary · Branch Wise · Warehouse Wise · Batch Wise · Expiry Wise ·
Inventory Valuation · Stock Verification · Accounting Impact.

## Accounting integration

On approval (when **auto-accounting** is enabled) the module posts a balanced opening journal:

```
Inventory Account .................. Dr   ₹ <opening value>
    Opening Balance Account ........ Cr        ₹ <opening value>
```

Quantity × Cost determines the opening value; the Accounting tab previews the entry live.

## Validation rules

- Product exists · Warehouse exists · Batch number unique · Expiry date valid
- Cost > 0 · Quantity > 0
- Prevents duplicate opening-stock entries and negative quantities.

## Database design (reference)

- `opening_stock_batch` — id, code, name, branch_id, warehouse_id, status, method, stock_date, posted_journal_id.
- `opening_stock_line` — batch_id, product_id, bin, qty, uom, cost, mrp, selling, value.
- `opening_stock_batch_detail` — line_id, batch_no, mfg_date, exp_date, qty, cost, mrp.
- `opening_stock_serial` — line_id, serial_no, cost, warehouse_id.
- `opening_stock_lot` — line_id, lot_no, qty, mfg_date, exp_date.
- `uom_conversion` — product_id, base_uom, alt_uom, factor.
- `opening_stock_audit` — batch_id, user_id, action, qty_delta, cost_delta, at.

## API specification (reference)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/opening-stock` | List batches (filter: branch, status) |
| POST | `/api/opening-stock` | Create batch + lines |
| GET | `/api/opening-stock/:id` | Fetch batch with lines/batches/serials/lots |
| PUT | `/api/opening-stock/:id` | Update batch |
| POST | `/api/opening-stock/:id/import` | Stage import (source, file) |
| POST | `/api/opening-stock/:id/ai-map` | AI column mapping + validation |
| POST | `/api/opening-stock/:id/verify` | Run verification checks |
| POST | `/api/opening-stock/:id/submit` | Advance approval state |
| POST | `/api/opening-stock/:id/post` | Generate opening journal |
| GET | `/api/opening-stock/:id/valuation` | FIFO / WAVG / Standard valuation |

## Responsive design

The editor uses the shared `EditorShell`: desktop shows the top stepper + content +
right summary panel; tablet collapses the right panel below the content; mobile stacks
the stepper into a horizontal scroll and fields reflow from 3 → 2 → 1 column.
