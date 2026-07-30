# Inventory Management Module

Part of **ONE POS** — **Operations → Inventory**. Real-time stock control across batches,
expiry, serials, warehouses, branches and bins. Like Sales & Purchase it is **policy-driven**:
every screen reads `DEFAULT_INVENTORY_CONFIG` plus the Product/Warehouse masters — **no
hardcoded inventory logic**.

## Supported

Grocery · Pharmacy · Textile · Electronics · Hardware · Furniture · Cosmetics · Auto Spares ·
Wholesale · Multi-Branch Chains.

## Routes (Operations → Inventory)

| Route | Screen |
| --- | --- |
| `/inventory` | Dashboard (10 KPIs, health, movers, quick actions) |
| `/inventory/inquiry` | **Stock Inquiry** (search by name/code/barcode/QR/batch/serial) |
| `/inventory/ledger` | **Inventory Ledger** (every movement, running balance) |
| `/inventory/batch` | Batch Management (+ `/new`) |
| `/inventory/expiry` | **Expiry Management** (buckets + discount/return/write-off) |
| `/inventory/serial` | Serial Numbers (+ `/new`) |
| `/inventory/warehouse` | Warehouse Inventory (+ `/new`) |
| `/inventory/branch` | Branch Inventory |
| `/inventory/bin` | Bin Locations (+ `/new`) |
| `/inventory/reservation` | Stock Reservation (+ `/new`) |
| `/inventory/transfer` | Stock Transfer (+ `/new`) |
| `/inventory/adjustment` | Stock Adjustment (+ `/new`, approval) |
| `/inventory/verification` | Physical Verification (+ `/new`, variance) |
| `/inventory/cyclecount` | Cycle Count (+ `/new`, ABC) |
| `/inventory/valuation` | **Inventory Valuation** (FIFO/WAVG/Std + aging + dead stock) |
| `/inventory/reorder` | **Reorder Planning** (Min/Max/ROP/AI) |
| `/inventory/ai` | **AI Inventory Engine** (optimization + predictions) |
| `/inventory/forecasting` | **Inventory Forecasting** (demand & stock-out risk) |
| `/inventory/analytics` | Inventory Analytics |
| `/inventory/reports` | Inventory Reports (13 reports) |

## Control policy (the "no hardcode" contract)

`src/lib/inventory/inventoryConfig.ts` → `DEFAULT_INVENTORY_CONFIG`:

- `valuationMethod` (FIFO), `batchIssue` (FEFO), `nearExpiryDays`, `cycleAbc`, `countFrequency`
- `realTimeTracking`, `batchTracking`, `expiryTracking`, `serialTracking`
- `multiWarehouse`, `multiBranch`, `binTracking`, `reservationEnabled`
- `allowNegativeStock`, `adjustmentApproval`, `transferApproval`, `qcOnReceipt`
- `aiOptimization`, `deadStockAlert`

Every screen shows an **"Inventory policy"** strip via `invNotesFor(featureKey)`.

## Architecture

- `src/lib/inventory/inventoryConfig.ts` — policy + helpers (`inv`, `invFlag`, `inventoryDocNo`).
- `src/lib/inventory/inventoryData.ts` — 20-feature catalog, list configs, create-form
  metadata, sample data, stats, reports, `invNotesFor()`.
- `src/components/inventory/InventoryListScaffold.tsx` — policy-driven list reused by 10 features.
- `src/components/inventory/InventoryDocumentForm.tsx` — quantity-based create form (transfer,
  adjustment, reservation, verification, cycle count) + master forms (warehouse, bin, batch, serial).
- Bespoke pages: Dashboard, Stock Inquiry, Ledger, Expiry, Valuation, Reorder, AI Engine,
  Forecasting, Analytics, Reports.

## Inventory workflow

```
Opening Stock / Purchase (GRN) → Inventory Ledger (+balance)
   ↘ Batch / Expiry / Serial / Bin tracking
Reservation ← Sales Order / Transfer Request   (reduces available)
Stock Transfer: dispatch → transit → receipt    (across branch/warehouse)
Stock Adjustment (excess/short/damage/theft/expiry) → Approval → write-off
Physical Verification / Cycle Count → variance → Adjustment
Reorder Planning / AI Engine / Forecast → Purchase or Transfer suggestions
Valuation (FIFO/WAVG/Std) → aging, dead stock → GL posting
```

## Approval workflow

`adjustmentApproval` / `transferApproval` route adjustments & transfers through
**Initiator → Store Manager → Inventory Controller** before stock & GL impact. Physical-count
variances post as approved adjustments.

## Accounting integration (reference)

- **Valuation posting:** Inventory asset revalued per `valuationMethod`.
- **Stock adjustment:** Dr/Cr Inventory · Cr/Dr Stock-Adjustment (gain/loss).
- **Write-off (damage/expiry/theft):** Dr Inventory Write-off (P&L) · Cr Inventory.
- **Transfer:** Dr In-Transit · Cr Inventory (dispatch); reversed on receipt.
- **Reconciliation:** variance posts to Inventory Shrinkage.

## Validation rules (policy-driven)

- Block **negative stock** unless `allowNegativeStock`.
- **Duplicate batch** / **duplicate serial** rejected.
- **Invalid expiry** (expiry < mfg / past) blocked.
- **Invalid warehouse/bin** rejected; receipts honour `qcOnReceipt`.
- Transfers/adjustments above policy require approval.

## AI inventory features

- **AI Engine** — reorder qty, overstock reduction, dead-stock clearance, near-expiry
  clearance, inter-branch transfer; predicts stock-out risk, aging & seasonal demand.
- **Reorder Planning** — Min/Max/ROP/AI methods → purchase & transfer suggestions.
- **Forecasting** — actual-vs-forecast, stock-cover & stock-out risk.

## Database design (reference)

- `inventory_balance` — product_id, warehouse_id, branch_id, bin_id, batch_id?, serial?,
  available, reserved, damaged, avg_cost.
- `inventory_ledger` — product_id, location, date, ref_type, ref_no, qty_in, qty_out, balance, value.
- `batch` — product_id, batch_no, mfg, exp, supplier_id, qty (unique product+batch).
- `serial` — product_id, serial_no, status, purchase_date, warranty_till (unique).
- `bin` — warehouse_id, rack, shelf, bin, capacity.
- `stock_transfer` — no, from, to, type, status, lines (dispatch/transit/received qty).
- `stock_adjustment` — no, type, reason, status, lines, write_off_value.
- `physical_verification` / `cycle_count` — no, scope, method, abc, lines (system/counted/variance).
- `reservation` — product_id, qty, against_ref, expires, status.

## API specification (reference)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/inventory/config` | Effective control policy |
| GET | `/api/inventory/stock?by=` | Stock inquiry (multi-key) |
| GET | `/api/inventory/ledger/:product` | Movement ledger |
| GET/POST | `/api/inventory/:type` | List / create (transfer, adjustment, reservation, count…) |
| POST | `/api/inventory/transfer/:id/receive` | Receive a transfer |
| POST | `/api/inventory/adjustment/:id/approve` | Approve adjustment |
| POST | `/api/inventory/verification/:id/variance` | Post variance → adjustment |
| GET | `/api/inventory/valuation?method=` | Valuation, aging, dead stock |
| GET | `/api/inventory/reorder` · `/forecast` · `/ai` | Planning & AI |
| GET | `/api/inventory/reports/:id` | Reports |

## Responsive design

Bespoke screens (inquiry, ledger, expiry, valuation, reorder, AI, forecast) reflow tables &
charts; list screens reflow filters/tables; create forms are two-column → stacked; the
dashboard KPI grid scales 10 → 5 → 2 columns.
