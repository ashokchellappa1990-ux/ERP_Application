# Customer Master Module — Specification

Enterprise, configurable Customer Master for ONE POS — supports Retail, B2B,
Credit, Loyalty, Corporate and Walk-In customers, with CRM, loyalty, credit and
analytics. Integrates with Sales/POS, CRM, Loyalty, Finance, GST and Accounts
Receivable.

- **Menu:** System → Masters → **Customers**
- **Routes:** `/masters/customer` (dashboard + list) · `/masters/customer/new` (14-tab editor) · `/masters/customer/[id]` (view/edit)
- **Code:** `src/app/(app)/masters/customer/**`, `src/components/masters/Customer*`, `src/lib/masters/customerConfig.ts`

---

## 1. User journey

```
Masters ▸ Customers
   ├─ Dashboard (Total / Active / Loyalty / Credit / Blocked / Outstanding)
   ├─ Quick actions (Add · Import · Create Loyalty Member · Record Payment)
   ├─ List (search all columns · type + status filters · pagination · View/Edit)
   ├─ Add Customer ──▶ 14-tab editor
   │      groups: Basics · Compliance · Finance · Engagement · Records · Tools
   │      Save Draft (→ Pending) · Save Customer (validate → success → list)
   └─ View/Edit (/[id]) ──▶ same editor, prefilled from the customer record
```

---

## 2. The 14 tabs

| # | Tab | Highlights |
|---|-----|-----------|
| 1 | General Information | code, name, legal name, **type** (Retail/Wholesale/Distributor/Dealer/Corporate/Walk-In/Online), category (creatable), status, reg date, customer since |
| 2 | Contact Information | primary (mobile/alt/WhatsApp/email) + secondary; communication preferences (SMS/Email/WhatsApp/Call) |
| 3 | Address Information | billing, "same as billing" toggle, shipping, **multiple addresses** (Home/Office/Delivery) |
| 4 | GST & Tax | GST type (Registered/Unregistered/SEZ/Export), GSTIN, PAN, TAN, business name, state code, **Verify GSTIN** |
| 5 | Credit Management | credit allowed, limit, period, block/warn on limit exceeded, **risk rating** (Low/Med/High) |
| 6 | Loyalty Management | loyalty member, number, tier (Silver/Gold/Platinum/Diamond), current/redeemed/available points |
| 7 | Preferences | preferred branch, salesperson, payment method, preferred product categories |
| 8 | CRM Information | visits, last purchase/contact, follow-up, interests, notes (complaints/service requests) |
| 9 | Accounting | customer ledger, advance account, opening receivable/advance |
| 10 | Documents | PAN, GST cert, business registration, agreement, credit-approval uploads |
| 11 | Customer Analytics | purchases, sales value, avg value, outstanding, loyalty points; revenue/loyalty/engagement scores |
| 12 | AI Smart Creation | mobile lookup / card / GST / Excel / software → extract & **prefill** with confidence score |
| 13 | Import | template → upload Excel/CSV → validation + error report (Customer Master / Outstanding / Loyalty) |
| 14 | Approval Workflow | Draft → Pending → Approved/Rejected, maker-checker, multi-level |

---

## 3. Validation rules

Client checks in `CustomerFormContext.validate()`; full set (client + server):

| Rule | Scope |
|------|-------|
| Customer Name required | client |
| Mobile required + format | client |
| Email format | client |
| GSTIN 15 chars | client; full regex server-side |
| **Duplicate Customer Code** | server |
| **Duplicate Mobile Number** | server |
| **Duplicate Email Address** | server |
| **Duplicate GST Number** | server |
| Invalid GSTIN / mobile / email | server |

---

## 4. Dashboard

KPIs: Total Customers · Active · Loyalty Members · Credit Customers · Blocked ·
Outstanding (₹). Quick actions: Add Customer · Import Customers · Create Loyalty
Member · Record Customer Payment.

---

## 5. Responsive behaviour

| Device | Editor | List |
|--------|--------|------|
| Desktop / Laptop | grouped tab rail + content | 6 KPI cards, full table, page-size selector |
| POS 1024×768 | rail collapses; touch targets | 3-col KPIs, scroll table |
| Tablet | tab rail → dropdown; 2-col grids | 2–3-col KPIs |
| Mobile | dropdown tabs; fields stack | KPIs stack; table scrolls; filters wrap |

---

## 6. Database design (suggested)

```
customers           id, company_id, code (uniq/co), name, legal_name, type,
                    category, status, reg_date, customer_since, approval_status
customer_contacts   id, customer_id, kind(primary/secondary), name, mobile,
                    alt_mobile, whatsapp, email
customer_comm_prefs customer_id, sms, email, whatsapp, call
customer_addresses  id, customer_id, kind(billing/shipping/home/office/delivery),
                    line1, line2, city, district, state, country, pincode
customer_gst        customer_id, gst_type, gstin, pan, tan, business_name, state_code
customer_credit     customer_id, credit_allowed, credit_limit, credit_period,
                    block_on_exceed, warn_on_exceed, risk_rating
customer_loyalty    customer_id, is_member, loyalty_no, tier, current_points,
                    redeemed_points, available_points
customer_prefs      customer_id, branch_id, salesperson_id, payment_method,
                    category_prefs (json)
customer_crm        customer_id, visits, last_purchase, last_contact, follow_up,
                    interests, notes
customer_accounting customer_id, ledger_account, advance_account,
                    opening_receivable, opening_advance
customer_documents  id, customer_id, kind, url, expiry_date
customer_analytics  customer_id, total_purchases, total_value, avg_value,
                    outstanding, points, revenue_score, loyalty_score, engagement_score
customer_approvals  id, customer_id, status, maker_id, checker_id, level, remarks, at
```

---

## 7. API design (suggested REST)

```
GET    /api/customers                list (q, status, type, page, sort)
GET    /api/customers/dashboard      counts (total/active/loyalty/credit/blocked/outstanding)
POST   /api/customers                create (nested payload = the 14 tabs)
GET    /api/customers/:id            fetch one
PUT    /api/customers/:id            update
PATCH  /api/customers/:id/status     active / inactive / block
POST   /api/customers/:id/submit     → Pending (maker)
POST   /api/customers/:id/approve    → Approved (checker, multi-level)
POST   /api/customers/:id/reject     → Rejected (+ remarks)
POST   /api/customers/validate       duplicate code/mobile/email/GST, format checks
POST   /api/customers/lookup         mobile-number lookup (AI)
POST   /api/customers/ai-extract     card/GST/Excel OCR → prefill payload + confidence
GET    /api/customers/template?type= master | balances | loyalty
POST   /api/customers/import         upload xlsx/csv → { validRows, errors[] }
```

---

## 8. Development-ready notes

- Replace `SAMPLE_CUSTOMERS` / `CUSTOMER_STATS` with list & dashboard APIs.
- `/masters/customer/[id]` prefills from the sample record; swap to `GET /api/customers/:id`.
- `Save Customer` → `POST/PUT`; `Save Draft` sets status = Pending.
- AI tab: Mobile Lookup → `POST /api/customers/lookup`; uploads → `POST /api/customers/ai-extract`. Currently `prefill()` fills a sample with a confidence animation.
- Analytics tab values come from `customer_analytics`; compute scores server-side.

---

© 2026 ONE POS — Customer Master Module.
