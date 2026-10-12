# Discount Master Management Module

Part of **ONE POS** — Masters group. Configure discounts, coupons, promotions, combos
and the priority rule engine that the POS terminal evaluates at billing time.

## Routes

| Route | Purpose |
| --- | --- |
| `/masters/discount` | Dashboard (KPIs + quick actions) + searchable/filterable list + Reports |
| `/masters/discount/new` | Create a new discount (16-tab editor) |
| `/masters/discount/[id]` | Edit an existing discount (hydrated from sample data) |

Sidebar: **System → Masters → Discount Master** (`Percent` icon).

## Architecture

Mirrors the Product / Supplier / Customer master pattern:

- `src/lib/masters/discountConfig.ts` — tabs, option arrays, field definitions,
  `DiscountRow` / `DiscountStatus` types, `SAMPLE_DISCOUNTS`, `DISCOUNT_STATS`, `REPORTS`.
- `src/components/masters/DiscountFormContext.tsx` — `DiscountFormProvider` /
  `useDiscountForm()`; holds `fields`, `toggles`, `flags`, repeatable `rows`,
  `customOptions`, `approvalStatus`; `validate()` and edit-mode `prefill`.
- `src/components/masters/DiscountEditor.tsx` — 16 tab bodies rendered through the
  shared `EditorShell` (top horizontal stepper + right Summary/Progress/AI panel).

## The 16 tabs

1. **General** — name, code, 26 discount-type chips, status, description.
2. **Applicability** — apply-on (product/category/brand/group/invoice) + channels (POS/online/app/B2B).
3. **Value** — method (Percentage / Flat / Slab), value, max cap, min purchase.
4. **Quantity** — quantity tiers + slab table (repeatable).
5. **Combo** — combo product groups & combo price.
6. **Buy / Get** — buy X get Y rules, free-item logic.
7. **Customer** — customer groups + loyalty-tier percentages.
8. **Coupon** — coupon type, code pattern, usage (single/multi), per-customer limit.
9. **Promotion** — campaign window, banner copy, promo budget.
10. **Expiry** — expiry rules (repeatable) + dead-stock 30/60/90 auto-discount.
11. **Branch** — per-branch policy + role-based approval limits.
12. **Approval** — maker-checker thresholds + approval status.
13. **Priority** — conflict behavior (Highest Wins / Stacking / First Match) + reorderable rule list.
14. **AI Engine** — animated AI recommendation table (targets, projected lift).
15. **Accounting** — discount GL account, tax treatment, write-off mapping.
16. **Audit** — change history / created-modified trail.

## 26 supported discount types

Percentage, Flat, Slab, Quantity-based, Combo, Buy-X-Get-Y, BOGO, Free Item,
Coupon, Promo Code, Seasonal, Festival, Clearance, Dead-Stock, Loyalty-Tier,
Membership, First-Purchase, Referral, Bundle, Cart-Value, Category, Brand,
Manufacturer, Channel-specific, Time-bound (Happy Hour), Employee.

## Dashboard KPIs (`DISCOUNT_STATS`)

Active Discounts · Expired · Coupon Usage · Promotion Revenue · Discount Given ·
Pending Approvals.

## Reports (`REPORTS`)

Discount Effectiveness, Coupon Redemption, Promotion ROI, Margin Impact,
Type-wise Usage, Branch-wise Discounts, Approval Audit.

## Rule engine (priority)

At billing, candidate discounts are filtered by applicability + channel + period,
then resolved by the **Priority** tab's behavior:
- **Highest Discount Wins** (default) — single best discount applied.
- **Stacking** — eligible discounts combine in the configured order.
- **First Match** — first rule in priority order wins.
