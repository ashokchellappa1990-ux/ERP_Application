# Supplier Master Module — Specification

Enterprise, configurable Supplier (Vendor) Master for ONE POS — part of Business
Initialization, completed after Product Master. Serves all retail verticals and
local + interstate suppliers; integrates with Purchase, Inventory, Finance, GST
and Accounts Payable.

- **Menu:** System → Masters → **Suppliers**
- **Routes:** `/masters/supplier` (dashboard + list) · `/masters/supplier/new` (15-tab editor) · `/masters/supplier/[id]` (view/edit)
- **Code:** `src/app/(app)/masters/supplier/**`, `src/components/masters/Supplier*`, `src/lib/masters/supplierConfig.ts`

---

## 1. User journey

```
Masters ▸ Suppliers
   ├─ Dashboard (Total / Active / Blocked / Preferred / Pending / Outstanding)
   ├─ Quick actions (Add · Import · Upload GST · Create PO)
   ├─ List (search name/code/GSTIN · status filter · View / Edit)
   ├─ Add Supplier ──▶ 15-tab editor
   │      groups: Basics · Compliance · Finance · Procurement · Records · Tools
   │      Save Draft (→ Pending) · Save Supplier (validate → success → list)
   └─ View/Edit (/[id]) ──▶ same editor, prefilled from the supplier record
```

---

## 2. The 15 tabs

| # | Tab | Highlights |
|---|-----|-----------|
| 1 | General Information | code, name, legal name, type, category (creatable), status, website, description |
| 2 | Contact Information | primary + secondary contacts, communication preferences (email/SMS/WhatsApp) |
| 3 | Address Information | registered address, "same as registered" toggle, communication address, **multiple supplier branches** |
| 4 | GST & Tax | reg type (Regular/Composition/SEZ/Export), GSTIN, PAN, TAN, state code, place of supply, **Verify GSTIN**, TDS |
| 5 | Banking | **multiple bank accounts** (repeatable), holder, IFSC, account type, UPI |
| 6 | Purchase Config | preferred, approval-required, lead time, min/max order qty |
| 7 | Credit & Payment | credit allowed, limit, period, payment terms, payment-mode preferences |
| 8 | Product Mapping | **multiple products** — product code, supplier code/name, last price, preferred |
| 9 | Branch Mapping | All branches vs selected branches/warehouses |
| 10 | Documents | GST/PAN/MSME/FSSAI/Drug-Licence/Bank-proof/Agreement uploads + expiry tracking |
| 11 | Performance | purchase value/qty, delivery %, rejection %, return %, vendor rating; rating params (quality/delivery/pricing/support) |
| 12 | Accounting | supplier ledger, advance & purchase accounts, opening payable/advance |
| 13 | AI Smart Setup | upload GST/invoice/card or enter GSTIN → extract & **prefill the form** with a confidence score |
| 14 | Import | download template, upload Excel/CSV, validation + error report |
| 15 | Approval Workflow | Draft → Pending → Approved/Rejected, maker-checker, multi-level |

Tab bodies render from field metadata (`supplierConfig.ts`); toggle-heavy areas
use a shared `ToggleGrid`, repeatable areas a shared `Repeatable`. Every field
carries an icon, info tooltip and sample value.

---

## 3. Validation rules

Client checks in `SupplierFormContext.validate()`; full rule set (client + server):

| Rule | Scope |
|------|-------|
| Supplier Name required | client |
| Primary contact name + mobile required | client |
| Mobile number format | client |
| Email format | client |
| GSTIN 15 chars | client; full regex server-side |
| **Duplicate Supplier Code** | server |
| **Duplicate GST Number** | server |
| **Duplicate PAN Number** | server |
| Invalid GSTIN / IFSC | server (`^[A-Z]{4}0[A-Z0-9]{6}$` for IFSC) |
| Invalid mobile / email | server |

Import surfaces a validation report (valid rows / errors) with a downloadable
error report (duplicate GST, invalid IFSC, etc.).

---

## 4. Responsive behaviour

| Device | Editor | List |
|--------|--------|------|
| Desktop / Laptop | grouped left tab rail + content; sticky actions | 6-col stats, full table |
| POS 1024×768 | rail collapses; touch targets | 3-col stats, scroll table |
| Tablet | tab rail → dropdown; 2-col grids | 2–3-col stats |
| Mobile | dropdown tabs; fields stack; inline prev/next | stats stack; table scrolls; filters wrap |

---

## 5. Database design (suggested)

```
suppliers           id, company_id, code (uniq/co), name, legal_name, type,
                    category, status, website, description, approval_status
supplier_contacts   id, supplier_id, kind(primary/secondary), name, designation,
                    mobile, alt_mobile, email
supplier_comm_prefs supplier_id, email, sms, whatsapp
supplier_addresses  id, supplier_id, kind(registered/communication/branch),
                    line1, line2, city, district, state, country, pincode
supplier_gst        supplier_id, reg_type, gstin, pan, tan, state_code,
                    place_of_supply, tds_applicable, tds_pct
supplier_banks      id, supplier_id, bank_name, branch, holder, account_no,
                    ifsc, account_type, upi, is_default
supplier_purchase   supplier_id, preferred, approval_required, lead_time,
                    min_order_qty, max_order_qty
supplier_credit     supplier_id, credit_allowed, credit_limit, credit_period,
                    payment_terms, payment_modes (json)
supplier_products   id, supplier_id, product_id, supplier_product_code,
                    supplier_product_name, last_purchase_price, preferred
supplier_branches   supplier_id, scope(all/selected), branch_id, warehouse_id
supplier_documents  id, supplier_id, kind, url, expiry_date
supplier_perf       supplier_id, total_value, total_qty, delivery_pct,
                    rejection_pct, return_pct, rating, rate_quality,
                    rate_delivery, rate_pricing, rate_support
supplier_accounting supplier_id, ledger_account, advance_account, purchase_account,
                    opening_payable, opening_advance
supplier_approvals  id, supplier_id, status, maker_id, checker_id, level, remarks, at
```

---

## 6. API design (suggested REST)

```
GET    /api/suppliers                list (q, status, type, page, sort)
GET    /api/suppliers/dashboard      counts (total/active/blocked/preferred/pending/outstanding)
POST   /api/suppliers                create (nested payload = the 15 tabs)
GET    /api/suppliers/:id            fetch one (all tabs)
PUT    /api/suppliers/:id            update
PATCH  /api/suppliers/:id/status     active / inactive / block
POST   /api/suppliers/:id/submit     → Pending (maker)
POST   /api/suppliers/:id/approve    → Approved (checker, multi-level)
POST   /api/suppliers/:id/reject     → Rejected (+ remarks)
POST   /api/suppliers/validate       duplicate code/GST/PAN, IFSC, mobile, email
POST   /api/suppliers/verify-gstin   GST portal lookup
POST   /api/suppliers/ai-extract     OCR/GST lookup → prefill payload + confidence
GET    /api/suppliers/template?type= master | balances | product-mapping
POST   /api/suppliers/import         upload xlsx/csv → { validRows, errors[] }
```

---

## 7. Development-ready notes

- Replace `SAMPLE_SUPPLIERS` / `SUPPLIER_STATS` with list & dashboard APIs.
- `/masters/supplier/[id]` already prefills from the sample record; swap to `GET /api/suppliers/:id`.
- `Save Supplier` → `POST/PUT`; `Save Draft` sets status = Pending.
- AI tab `Run AI Extraction` → `POST /api/suppliers/ai-extract`; it currently calls `prefill()` with a sample and sets a confidence message.
- Multi-level approval: extend `supplier_approvals` with `level` and route `/approve` through the configured chain.

---

© 2026 ONE POS — Supplier Master Module.
