# Sales Configuration & Billing Rule Engine

Part of **ONE POS** — **Settings → Sales Settings**. The central rule engine that controls
how every sales transaction behaves. **Must be configured before** building Sales Order,
B2C Billing, B2B Billing, Sales Return, Sales Exchange and Customer Collection — those
modules read these rules instead of hardcoding behaviour.

## Supported industries

Grocery · Pharmacy · Supermarket · Textile · Footwear · Electronics · Mobile · Hardware ·
Furniture · Cosmetics · Auto Spares · Wholesale Distribution · Multi-Branch Chains.

## Route

| Route | Purpose |
| --- | --- |
| `/settings/sales` | Single full-screen configuration with 23 tabs + live rule dashboard |

Sidebar: **System → Settings → Sales Settings** (`ReceiptText` icon). Settings is now an
expandable parent.

## Architecture

Mirrors the master-editor pattern but as a **single configuration** (no list / records):

- `src/lib/settings/salesConfig.ts` — 23 tabs, option arrays, toggle groups, flag groups,
  field definitions, approval levels, validation areas, `SALES_STATS`.
- `src/components/settings/SalesSettingsFormContext.tsx` — `SalesSettingsProvider` /
  `useSalesSettings()`; holds `fields`, `toggles` (13 groups), `flags` (40+ booleans) with
  sensible **defaults**; `countOn(group)` and `validate()`.
- `src/components/settings/SalesSettings.tsx` — 23 tab bodies through the shared
  `EditorShell` (top stepper + right summary/AI panel); the first tab embeds the dashboard.

## The 23 tabs

1. **Business Mode** — Retail / Wholesale / Retail+Wholesale / Pharmacy / Electronics /
   Textile / Multi-Store; selection pre-fills defaults. Also shows the **rule dashboard**.
2. **Sales Channels** — B2C, B2B, Counter, Online, Mobile, Tele + default channel.
3. **Product Selection** — name / code / SKU / barcode / QR / serial / batch / image / grid + default.
4. **Barcode** — enable, duplicate validation, mandatory; EAN/UPC/GS1/CODE128/Custom.
5. **QR Code** — enable; QR contents (code/name/batch/expiry/mfg/MRP/serial/GST); scan actions.
6. **Serial Number** — tracking (Mandatory/Optional/N-A); Mobile/Electronics/Appliances;
   duplicate validation; warranty integration.
7. **Batch** — tracking; selection FIFO/FEFO/Manual; manual override.
8. **Expiry** — validation; near-expiry alert (7/15/30/60/90); allow expired sales;
   near-expiry discount integration.
9. **Inventory Allocation** — issue method FIFO/FEFO/LIFO/Moving-Avg/Manual; branch & warehouse priority.
10. **B2C** — walk-in allowed, registration, mobile/GST mandatory, default customer, quick create.
11. **B2B** — customer master & GST mandatory, credit/outstanding validation, contract &
    customer-specific pricing, SO-before-invoice.
12. **Pricing** — price source (MRP/Retail/Wholesale/Dealer/Distributor/Contract); override + approval.
13. **Discount** — allow; sources (product/category/brand/customer/group/coupon/loyalty/invoice); max limit.
14. **Tax** — Inclusive/Exclusive; CGST/SGST/IGST/CESS defaults; E-Invoice & E-Way Bill.
15. **Credit Sales** — allow, limit & outstanding checks, approval workflow, max credit days, approver role.
16. **Loyalty** — enable, tier/birthday/special benefits, earn rate, redemption value.
17. **Approval Workflow** — approval-for (discount/price/credit/stock/expired); levels
    Cashier → Supervisor → Manager → Admin with limits.
18. **Invoice** — B2C/B2B prefixes; **bill-number sequence builder** (compose Prefix ·
    Branch · Year/FY · Month · Running No.) with separator, padding, starting number,
    **reset frequency** (Never / Daily / Monthly / Quarterly / Financial Year / Calendar
    Year), year format (FY 26-27 / 2026-2027 / 2026 / 26), branch-wise sequence, separate
    B2B sequence, lock-old-series-on-reset, and a **live preview** of the next B2C/B2B
    number; print formats (Thermal/A4/Custom).
19. **Delivery** — immediate / partial / scheduled / challan / proof-of-delivery.
20. **POS Screen** — toggle customer panel, stock, discount/tax columns, loyalty, image,
    quick keys, touch mode, dark mode.
21. **Notifications** — invoice SMS/email/WhatsApp, loyalty, payment & credit reminders.
22. **AI Sales** — master enable + product recommendation, upsell, cross-sell, customer
    recommendation, discount suggestion, near-expiry clearance.
23. **Audit Trail** — versioned user / change / timestamp (old → new) log.

## Dashboard (`SALES_STATS`, tab 1)

Active Sales Rules · Active Channels (live) · Discount Sources (live) · Credit Rules ·
Pending Approvals · AI Recommendations.

## Validation rules

- At least one **sales channel** enabled.
- At least one **product selection method** enabled.
- Default **price source** and **tax method** selected.
- If barcode billing on → at least one **barcode type**.
- If QR billing on → at least one **QR content** field.

(Validation areas surfaced: Product, Tax, Barcode, QR, Batch, Pricing, Customer.)

## Rule engine contract

The Sales modules call `getSalesConfig()` and branch on these values — **no hardcoded
logic**. Example reads:

```
config.batch.selection      // "FEFO" → auto-pick batch by earliest expiry
config.expiry.allowExpired   // false → block expired SKU unless approval
config.pricing.priceSource   // "wholesale" for B2B channel
config.tax.method            // "inclusive" → back-calculate tax from MRP
config.approval.for.discount // true → route >limit discounts to approver
```

## Database design (reference)

Single versioned settings document per company/branch:

- `sales_config` — id, company_id, branch_id (nullable = global), business_mode, version, updated_by, updated_at.
- `sales_config_section` — config_id, section (`channels`,`pricing`,…), payload JSONB.
- `sales_config_audit` — config_id, user_id, section, field, old_value, new_value, at.
- Lookups: `barcode_type`, `price_source`, `inventory_method`, `approval_level`.

Branch rows override the global row at read time (branch → global fallback).

## API specification (reference)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/settings/sales` | Fetch effective config (branch → global merge) |
| PUT | `/api/settings/sales` | Replace full config (new version) |
| PATCH | `/api/settings/sales/:section` | Update one section |
| POST | `/api/settings/sales/validate` | Run validation rules |
| GET | `/api/settings/sales/audit` | Version / change history |
| POST | `/api/settings/sales/apply-mode/:mode` | Pre-fill defaults for a business mode |

## Responsive design

Built on the shared `EditorShell`: desktop = top stepper + content + right summary panel;
tablet collapses the summary below content; mobile turns the stepper into a horizontal
scroll and reflows fields 3 → 2 → 1 column.
