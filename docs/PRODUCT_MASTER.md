# Product Master Module — Specification

Enterprise, configurable Product Master for ONE POS — one schema serving all 15
retail verticals (grocery, pharmacy, textile, electronics, hardware, etc.) with
no custom development.

- **Menu:** System → Masters → **Products**
- **Routes:** `/masters/product` (dashboard + list) · `/masters/product/new` (16-tab editor)
- **Code:** `src/app/(app)/masters/product/**`, `src/components/masters/**`, `src/lib/masters/productConfig.ts`

---

## 1. Menu structure

```
Masters
├── Products            ← built (dashboard, list, 16-tab editor, import)
├── Categories          ← route ready (placeholder)
├── Brands              ← route ready (placeholder)
└── Units (UOM)         ← route ready (placeholder)
```
Supporting masters (Sub-Category, Group, Manufacturer, Attribute, Template,
Approval) are modeled in `productConfig.ts` options and plug into the same shell.

---

## 2. User journey

```
Masters ▸ Products
   │
   ├─ Dashboard  (Total / Active / Inactive / Low-Stock / Near-Expiry / New)
   ├─ Quick actions (Add · Import · Create Category · Create Brand)
   ├─ Product list  (search + status filter + edit)
   │
   ├─ Add Product ──▶ 16-tab editor
   │      tabs grouped: Basics · Identification · Compliance · Inventory ·
   │      Commercial · Advanced.  Pharmacy tab appears only for Pharmacy category.
   │      Save Draft (→ Pending) · Save Product (validate → success → list)
   │
   └─ Import ──▶ modal: download template → upload xlsx/csv → validation report
```

---

## 3. The 16 tabs

| # | Tab | Highlights |
|---|-----|-----------|
| 1 | General Information | code, name, short/alt name, status, launch/discontinue dates, keywords, description |
| 2 | Classification | type, category, sub-category, group, brand, manufacturer, family, segment |
| 3 | Packaging & UOM | base/purchase/sales UOM, units/case, package type, dimensions, net/gross weight |
| 4 | Product Codes | SKU, GTIN, UPC, EAN, ISBN, MPN, internal code; barcode type/prefix/length, auto-gen, QR |
| 5 | Tax Configuration | tax preference, GST rate, HSN, SAC |
| 6 | Inventory | tracking toggles (batch/lot/serial/mfg/expiry/warranty/trace), valuation (FIFO/FEFO/WAvg), controls |
| 7 | Expiry & Shelf Life | expiry-applicable gate, shelf-life type/value, near-expiry alert unit/value |
| 8 | Stock Control | opening qty/value, min/max/reorder/safety levels, lead time |
| 9 | Pricing | purchase + 7 sales prices, regional (local/interstate), discount cap |
| 10 | Accounting | sales/purchase revenue & inventory accounts, descriptions, cost/profit center |
| 11 | Sales Configuration | sales/return/bulk/credit/discount toggles, age-restricted, special approval |
| 12 | Purchase Configuration | purchase allowed, preferred supplier, lead time |
| 13 | Attributes & Variants | dynamic attributes (name/type/values), parent–child variants |
| 14 | Product Media | image, documents, brochure, tech specs, safety instructions |
| 15 | Pharmacy *(conditional)* | prescription, schedule drug, batch/expiry mandatory, drug-licence compliance |
| 16 | Approval Workflow | Draft → Pending → Approved/Rejected (maker-checker) |

Tab bodies render from field metadata (`productConfig.ts`) — every field carries
an **icon**, an **info tooltip**, and a **sample value**. Toggle-heavy tabs use a
single `PToggleGrid`. Adding a field = one entry in the metadata array.

---

## 4. Validation rules

Client checks live in `ProductFormContext.validate()`; the list of business rules
to enforce (client + server):

| Rule | Scope |
|------|-------|
| Product Name required | client (blocks save, jumps to General tab) |
| HSN 4–8 digits | client |
| **Duplicate Product Code** | server — unique per company |
| **Duplicate Barcode / GTIN / EAN / UPC** | server — unique per company |
| **Duplicate SKU** | server — unique per company/variant |
| **Duplicate Product Name** | server — warn (soft) |
| Invalid GST configuration | server — Taxable ⇒ GST rate + HSN required |
| Invalid HSN code | server — validate against HSN master |
| Invalid UOM mapping | server — purchase/sales UOM must convert to base UOM |
| FY/date sanity | discontinue ≥ launch; expiry fields required if expiry-applicable |
| Pharmacy | batch & expiry mandatory when Schedule Drug = on |

Import validation surfaces a **report** (valid rows / errors) and a downloadable
**error report** — duplicates, invalid HSN, invalid barcode shown per row.

---

## 5. Responsive behaviour

| Device | Editor | List |
|--------|--------|------|
| Desktop / Laptop | Left tab rail (grouped) + content; sticky actions | 6-col stat grid, full table |
| POS 1024×768 | Tab rail collapses; large touch targets | 3-col stats, horizontal-scroll table |
| Tablet | Tab rail → **dropdown** tab selector; 2-col field grids | 2–3-col stats |
| Mobile | Dropdown tabs; fields stack; inline prev/next | stats stack; table scrolls; filters wrap |

POS layout: from the POS terminal, product lookup uses the same master via
barcode/name search — only the read API is needed there.

---

## 6. Database design (suggested)

Core + satellite tables (one company → many products):

```
products            id, company_id, code (uniq/co), name, short_name, alt_name,
                    description, keywords, status, type, launch_date, discontinue_date,
                    category_id, subcategory_id, group_id, brand_id, manufacturer_id,
                    family, segment, approval_status
product_uom         product_id, base_uom, purchase_uom, sales_uom, units_per_case,
                    package_type, height, width, length, volume,
                    weight_unit, net_weight, gross_weight
product_codes       product_id, sku, gtin, upc, ean, isbn, mpn, internal_code,
                    barcode_type, barcode_prefix, barcode_length, auto_barcode,
                    qr_required, qr_template
product_tax         product_id, tax_pref, gst_rate, hsn, sac
product_inventory   product_id, stock_maintenance, batch, lot, serial, mfg, expiry,
                    warranty, trace, valuation, negative, backorder, reservation, blocking
product_expiry      product_id, expiry_applicable, shelf_life_type, shelf_life_value,
                    alert_unit, alert_value
product_pricing     product_id, std_purchase, last_purchase, mrp, retail, wholesale,
                    distributor, dealer, franchise, online, local, interstate,
                    discount_allowed, max_discount_pct
product_accounting  product_id, sales_revenue_acct, sales_inventory_acct,
                    purchase_expense_acct, purchase_inventory_acct,
                    sales_desc, purchase_desc, cost_center, profit_center
product_stock       product_id, store_id, opening_qty, opening_value,
                    min, max, reorder, safety, lead_time
product_sales_cfg   product_id, sales_allowed, sales_return, bulk, credit, discount,
                    age_restricted, special_approval
product_purchase    product_id, purchase_allowed, preferred_supplier_id, lead_time
product_attributes  id, product_id, name, type, values (json)
product_variants    id, parent_product_id, sku, attribute_values (json)
product_media       id, product_id, kind (image/doc/brochure/spec/safety), url
product_pharmacy    product_id, prescription, schedule, batch_mandatory,
                    expiry_mandatory, drug_license
product_approvals   id, product_id, status, maker_id, checker_id, remarks, at
```

Booleans can collapse into JSONB settings columns per domain; the form's
`toggles`/`flags` map already mirrors this grouping.

---

## 7. API design (suggested REST)

```
GET    /api/products                 list (q, status, category, page, sort)
GET    /api/products/dashboard       stat counts (total/active/low-stock/near-expiry/new)
POST   /api/products                 create (full payload from the editor)
GET    /api/products/:id             fetch one (all tabs)
PUT    /api/products/:id             update
PATCH  /api/products/:id/status      activate / deactivate / block
POST   /api/products/:id/submit      → Pending Approval (maker)
POST   /api/products/:id/approve     → Approved (checker)
POST   /api/products/:id/reject      → Rejected (+ remarks)
POST   /api/products/validate        pre-save duplicate/HSN/UOM checks
GET    /api/products/template?type=  download import template (master/pricing/stock/barcode)
POST   /api/products/import          upload xlsx/csv → { validRows, errors[] }
GET    /api/products/import/:job/errors  error report (csv)
GET    /api/masters/{categories|brands|uom|manufacturers|attributes}
```

The editor serializes one nested payload (sections = tabs). `validate` runs the
duplicate/GST/HSN/UOM rules before persistence; `import` reuses the same validator
per row.

---

## 8. Development-ready notes

- Replace `SAMPLE_PRODUCTS` / `DASHBOARD_STATS` with the list & dashboard APIs.
- Hydrate the editor from `GET /api/products/:id` for edit mode (`/masters/product/[id]`).
- Wire `Save Product` → `POST/PUT`; `Save Draft` already sets status = Pending.
- Pharmacy tab visibility is driven by `category === "Pharmacy"` — switch to a
  capability flag if multiple verticals need it.
- Barcode auto-generation, QR templates and attribute→variant expansion are the
  main server-side helpers to implement.

---

© 2026 ONE POS — Product Master Module.
