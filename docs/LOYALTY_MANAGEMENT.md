# Loyalty Management & Customer Rewards Engine

Part of **ONE POS** — **Customers → Loyalty**. A real-time rewards engine that earns &
redeems points, cashback, wallet credit, gift cards and tier benefits during every sales
transaction. **Policy-driven** — Sales/POS read `DEFAULT_LOYALTY_CONFIG`; no hardcoded loyalty
logic.

Integrates with Customer Master, Sales, POS Billing, Discount/Promotion/Coupon, Payment, CRM,
Mobile App and Customer Portal.

## Routes (`/loyalty/*`) — 21 features

Dashboard · Configuration · Program Master · Membership Tiers · Point Configuration · Point
Earning Rules · Point Redemption Rules · Cashback Configuration · Customer Wallet · Gift Card
Management · Referral Program · Birthday Rewards · Anniversary Rewards · Campaign Loyalty ·
Approval Workflow · Customer Loyalty Profile · POS Integration · Mobile Integration · AI
Loyalty Engine · Analytics · Reports.

## Architecture

- `src/lib/loyalty/loyaltyConfig.ts` — `DEFAULT_LOYALTY_CONFIG` (program types, point value &
  expiry, cashback, tier auto-upgrade, referral, occasion, approval, channels) + `ly`, `lyFlag`.
- `src/lib/loyalty/loyaltyData.ts` — 21-feature catalog, list configs, form metas, **CONFIG_PAGES**
  (declarative config screens), TIERS, dashboard stats, 11 reports, `loyaltyNotesFor()`.
- `src/components/loyalty/LoyaltyListScaffold.tsx` — list + View modal + Edit, reused by 9 features.
- `src/components/loyalty/LoyaltyDocumentForm.tsx` — create form (program, tier, earning,
  redemption, wallet, gift-card, campaign).
- `src/components/loyalty/LoyaltyConfigScreen.tsx` — renders a `CONFIG_PAGES` descriptor
  (configuration, point-config, cashback, referral, birthday, anniversary) with toggles/inputs.
- Bespoke: Dashboard, AI Loyalty Engine, Analytics, Reports, POS & Mobile integration.

## Engines

- **Point engine** — `₹100 = N points` (config), calc by invoice/product/category/brand/group;
  earning rules with **Double/Triple/Festival** multipliers; point value `₹/pt`, expiry & carry-forward.
- **Membership engine** — Silver → Gold → Platinum → Diamond → VIP; qualification by annual
  spend; **auto-upgrade**; per-tier benefits (extra points, discount, free gift, cashback bonus).
- **Cashback engine** — fixed or % cashback; immediate / after-X-days credit.
- **Wallet engine** — Loyalty / Cashback / Gift-card / Promotional wallets with balance, usage, history.
- **Referral engine** — referrer + new-customer rewards.
- **Occasion engine** — auto birthday & anniversary rewards (points/cashback/coupon/gift).
- **Campaign engine** — festival/category campaigns with bonus rewards.

## Sales & POS integration (real-time)

At every Sales Quotation / Order / **POS Bill** / B2B Invoice / Collection / Return / Exchange:
**Auto-calculate points · auto-cashback · auto-wallet update · auto-membership upgrade ·
auto-campaign rewards · auto-referral benefits**. The POS shows the customer's points, tier,
wallet, coupons, cashback & gift cards and lets the cashier **redeem points / wallet / gift card
/ cashback** (see `/loyalty/pos-integration`). (The POS already earns loyalty points from the
sales config; this module extends it with redemption & tiers.)

## AI Loyalty Engine

Inactive-customer win-back, near-tier-upgrade nudges, win-back / cross-sell / upsell campaign
suggestions, and expected retention improvement — one-click to create the campaign.

## Approval workflow

Manual point adjustment, wallet credit, cashback credit, membership override and gift-card
issue route for approval (per `approval*` flags).

## Database design (reference)

```
loyalty_program     (id, code, name, type, start, end, status, is_default)
membership_tier     (id, name, qualify_from, qualify_to, point_mult, discount, benefits jsonb, validity)
customer_loyalty    (customer_id, program_id, tier, points, lifetime_value, referrals, joined)
point_rule          (id, basis, target, per_100, multiplier, start, end, status)        -- earning
redemption_rule     (id, type, min_points, max_value, redeem_pct, status)
point_ledger        (customer_id, txn_ref, type earn|redeem|expire|adjust, points, balance, at)
wallet              (customer_id, type, balance) ; wallet_txn (wallet_id, dir, amount, ref, at)
gift_card           (no, type, value, balance, expiry, rechargeable, status, customer_id)
referral            (referrer_id, referee_id, reward_points, status)
campaign            (id, name, type, reward, start, end, target, status)
loyalty_approval    (id, type, customer_id, value, status, raised_by, acted_by)
loyalty_audit       (user, entity, action, before, after, at)
```

## API specification (reference)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/loyalty/config` | Effective loyalty policy |
| POST | `/api/loyalty/accrue` | Earn points/cashback for a sale (engine) |
| POST | `/api/loyalty/redeem` | Redeem points / wallet / gift card / cashback |
| GET | `/api/loyalty/customer/:id` | 360° loyalty profile |
| GET/POST | `/api/loyalty/program` `/tier` `/rule` `/campaign` | Masters |
| POST | `/api/loyalty/wallet/adjust` `/gift-card/issue` | Wallet & gift card |
| POST | `/api/loyalty/referral` | Register a referral |
| POST | `/api/loyalty/approval/:id` | Approve / reject |
| GET | `/api/loyalty/analytics` · `/ai` · `/reports/:id` | Insights |

## Validation rules

- Redemption within Min/Max & ≤ max-redeem % of the bill; sufficient point/wallet balance.
- Gift card balance ≥ redeem amount; not expired/blocked.
- Tier auto-upgrade only on qualifying spend; downgrade on validity lapse.
- Manual point/wallet/cashback/membership/gift-card over policy → approval.
- Points expire after the configured months unless carry-forward is on.

## Responsive design

Bespoke screens (dashboard, AI, analytics, POS/mobile preview) reflow cards/charts; list
screens reflow filters/tables; config screens & forms are two-column → stacked; dashboard KPI
grid scales 8 → 4 → 2 columns.
