# Pricing & Batch-Wise Pricing Architecture

Enhancement to the **existing** modules (no separate Price Management module). Product
Master is the **Default Price Repository**; GRN captures **batch-wise pricing**; Sales
resolves the **selling price by configured priority**. Category rules drive batch/expiry/
pricing behaviour. Every GRN batch-pricing field is **enable/mandatory configurable from
Settings**.

## 1. Product Master = Default Price Repository

`PosProduct` ([src/lib/sales/salesData.ts](src/lib/sales/salesData.ts)) now carries the tiered
prices and the pricing-control method:

```ts
interface ProductPrices { retail; wholesale; dealer; distributor; online }
interface PosProduct { …; mrp; prices: ProductPrices; pricingControl: "product"|"batch"|"variant"|"customer" }
```

`pricingControl` defaults by category (Pharmacy/Grocery → batch, Electronics → product,
Textile → variant, Wholesale → customer) and is editable on the Product Master Pricing tab.
These tier prices are the **fallback** used whenever a more specific source isn't available.

## 2–3. GRN Batch-Wise Pricing (13 line fields)

GRN line items ([PurchaseDocumentForm](src/components/purchase/PurchaseDocumentForm.tsx),
`featureKey === "grn"`) expand to a **Batch & Pricing** panel, **prefilled from Product
Master**, capturing:

Batch Number · Manufacturing Date · Expiry Date · Purchase Cost · MRP · Retail · Wholesale ·
Dealer · Distributor · Online · **Margin % (auto = (MRP − Cost)/Cost)** · Effective Date ·
Price Revision Reason.

Each captured batch becomes a **batch price record** the Sales module can read.

## 4. Pricing Control Method (Product Master)

Options: **Product Level · Batch Level · Variant Level · Customer Level**. Stored on the
product (`pricingControl`), shown on each GRN line (e.g. "Batch pricing"). Determines whether
the batch-pricing panel / variant / customer pricing applies.

## 5. Price Source Configuration (Sales Configuration → Pricing)

`priceSources` toggle group ([salesConfig.ts](src/lib/settings/salesConfig.ts)) — a **priority
waterfall**:

1. **Promotion Price** → 2. **Customer Price** → 3. **Batch Price** → 4. **Branch Price** →
5. **Product Master Price** (always-on fallback).

Configured in **Settings → Sales Settings → Pricing**. The default Product-Master tier (MRP/
Retail/Wholesale/Dealer/Distributor/Online) is chosen by the existing **Default Price Source**.

## 6. Sales billing price resolution

[src/lib/sales/priceResolver.ts](src/lib/sales/priceResolver.ts):

```ts
resolveSellingPrice(product, { promotionPrice, customerPrice, batchPrice, branchPrice })
  → { price, source }   // first ENABLED source (in fixed priority) with a value wins
```

At POS the active waterfall is shown in the config strip (`Source: Promotion → Customer →
Batch → Branch → Product`). Billing calls `resolveSellingPrice` so the **selling price follows
the configured priority**, never hardcoded.

## 7. Category-wise behaviour

[grnPricingConfig.ts → CATEGORY_RULES](src/lib/settings/grnPricingConfig.ts), shown read-only
in **Settings → Document Field Settings → GRN Batch Pricing**:

| Category | Batch | Expiry | Batch Price | Pricing Control | Serial |
| --- | --- | --- | --- | --- | --- |
| Pharmacy | Mandatory | Mandatory | Mandatory | Batch | — |
| Grocery | Optional | Optional | Allowed | Batch | — |
| Electronics | Optional | N/A | Allowed | Product | Yes |
| Textile | Optional | N/A | Allowed | Variant | — |
| Wholesale | Optional | Optional | Allowed | Customer (Contract) | — |

GRN validation enforces these per line (e.g. a Pharmacy line cannot save without batch,
expiry, cost & MRP).

## 8. Settings — GRN line fields enable/mandatory

**Settings → Document Field Settings → GRN Batch Pricing** ([DocumentSettings](src/components/settings/DocumentSettings.tsx))
lists all 13 fields grouped (Batch / Pricing / Control) with **Enabled** + **Mandatory**
switches ([grnPricingConfig.ts](src/lib/settings/grnPricingConfig.ts)). The GRN form shows
only enabled fields and blocks save until mandatory ones (settings + category) are filled.

---

## Database design (reference)

```
product                 (id, …, mrp, retail, wholesale, dealer, distributor, online, pricing_control)
product_batch_price     (id, product_id, grn_id, batch_no, mfg_date, exp_date, cost,
                         mrp, retail, wholesale, dealer, distributor, online, margin_pct,
                         effective_date, revision_reason, branch_id, status)
grn_line                (id, grn_id, product_id, qty, accepted_qty, batch_price_id)
branch_price            (product_id, branch_id, price)            -- branch source
customer_price          (customer_id, product_id, price)          -- customer/contract source
promotion_price         (product_id, scheme_id, price, valid_from, valid_to)
sales_price_config      (company_id, price_sources jsonb, default_tier)   -- the waterfall
grn_field_config        (field_key, enabled, mandatory)           -- settings
category_rule           (category, batch, expiry, batch_price, pricing_control, serial, contract)
```

`product_batch_price` is written by GRN posting and read by the Batch price source.

## API specifications (reference)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/products/:id/prices` | Product Master tier prices + pricingControl |
| POST | `/api/grn` | Post GRN → creates `product_batch_price` rows |
| GET | `/api/products/:id/batch-prices` | Active batch prices (by branch/date) |
| GET | `/api/settings/grn-fields` · PUT | GRN line field enable/mandatory config |
| GET | `/api/settings/price-sources` · PUT | Price-source priority config |
| POST | `/api/sales/resolve-price` | `{product, customer, branch, batch}` → `{price, source}` |
| GET | `/api/settings/category-rules` | Category behaviour matrix |

## Validation rules

- **GRN:** batch number unique per product; expiry > mfg; cost > 0; MRP ≥ cost; retail ≤ MRP;
  margin auto-derived; category-mandatory + settings-mandatory fields enforced.
- **Pharmacy:** batch, expiry, batch price all mandatory.
- **Sales:** resolved price must be > 0; if Batch source selected and no batch price exists,
  waterfall falls through to the next enabled source.
- **No negative margin** without Price Revision Reason.

## Inventory logic

GRN receipt creates stock **at the batch** with its batch price + expiry; FEFO/FIFO issue
(from inventory policy) selects the batch at billing, and that batch's price feeds the **Batch
price source**. Valuation uses Purchase Cost.

## Sales logic

At billing: `resolveSellingPrice(product, ctx)` walks the enabled waterfall — Promotion →
Customer (contract) → Batch (selected batch) → Branch → Product Master tier. The winning
source is shown to the cashier. Override is allowed/approved per Sales Settings.

## UI summary

- **Product Master → Pricing tab:** 6 tier prices + Pricing Control Method.
- **GRN line → Batch & Pricing panel:** 13 settings-driven fields, prefilled, auto-margin.
- **Sales Settings → Pricing:** default tier + price-source priority toggles.
- **Document Field Settings → GRN Batch Pricing:** enable/mandatory per field + category matrix.
- **POS:** price-source waterfall indicator.
