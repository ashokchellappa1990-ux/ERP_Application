# Business Setup Module — Specification

Production-ready onboarding wizard for ONE POS. Runs once, immediately after
registration + OTP verification, to configure the business before operations.

- **Route:** `/setup` (full-screen, outside the app shell)
- **Entry:** `/verify-otp` → `/setup` → (Complete) → success → `/dashboard`
- **Code:** `src/app/setup/page.tsx`, `src/components/setup/*`, `src/lib/setup/config.ts`

---

## 1. User journey

```
Register ──▶ OTP Verify ──▶ ┌─ Mode Selection (Quick / Standard / Advanced)
                            │
                            ▼
                  Step Wizard (progress rail + footer nav)
                  1..N steps depending on mode
                            │
                   Review & Complete
                            ▼
                  Success Screen (100%, quick actions) ──▶ Dashboard
```

Users can **Back**, **Save Draft** (persists progress), jump to any **visited**
step via the rail, or **Exit** to the dashboard at any time.

---

## 2. Setup modes → step coverage

`src/lib/setup/config.ts → MODE_STEPS`

| Mode | Steps | For |
|------|-------|-----|
| **Quick** (~5 min) | Company → GST → Users → POS → Payment → Review | Single store, fast start |
| **Standard** (~15 min) | 16 steps (adds Profile, Contact, Branch, Org, Financial, Banking, Inventory, Notifications, Modules, Industry) | Most retailers |
| **Advanced** (~25 min) | All 20 steps (adds Warehouse, Hardware, Migration, Security) | Enterprise / multi-store |

The wizard is **data-driven** — adding/removing a step from a mode is one array
edit; no UI rewrite.

---

## 3. The 20 steps

| # | Step | Type | Key data |
|---|------|------|----------|
| 1 | Company Information | Form | 21 fields incl. GST/PAN/CIN/Udyam/FSSAI/Drug Licence, logo, address |
| 2 | Business Profile | Form + chips | employees, turnover, ownership, working days, hours |
| 3 | Contact Information | Form ×2 | primary + secondary contacts |
| 4 | Branch Setup | Repeatable | add/edit/delete branches |
| 5 | Warehouse Setup | Repeatable | warehouses + branch mapping |
| 6 | Organization Structure | Radio + toggles | org type + centralization flags |
| 7 | Financial Setup | Form + radio + flags | FY dates, currency, accrual/cash, cost/profit centre |
| 8 | Banking Setup | Repeatable | multiple bank accounts |
| 9 | GST & Tax Setup | Radio + form + toggles | reg type, GSTIN, taxes, filing, e-invoice/e-way/TDS |
| 10 | User & Role Setup | Form + repeatable | primary admin + additional users (10 roles) |
| 11 | Inventory Configuration | Toggles + radio | tracking, valuation (FIFO/FEFO/WAvg), stock rules |
| 12 | POS Configuration | Toggles | billing features + receipt channels |
| 13 | Payment Configuration | Toggles + select | accepted modes, default, gateway flag |
| 14 | Notifications | Toggles | channels + events |
| 15 | Hardware Configuration | Toggles | 7 peripherals |
| 16 | Business Modules | Toggles | 15 modules |
| 17 | Industry Configuration | Conditional toggles | pharmacy / electronics / textile |
| 18 | Data Migration | Select + toggles | source software + import scope |
| 19 | Security Configuration | Toggles | OTP, 2FA, expiry, timeout, audit |
| 20 | Review & Complete | Summary | all sections + Complete |

Toggle-heavy steps render from `ToggleItem[]` definitions (`config.ts`) through a
single `ToggleGrid` component — consistent UX, minimal code.

---

## 4. Field-level validation rules

Enforced in `SetupContext.validate(stepId)`; **Next** is blocked until the
current step passes. Errors render inline under each field.

| Step | Field | Rule |
|------|-------|------|
| Company | Company Name | required |
| Company | Industry Category | required (select) |
| Company | Company Email | valid email format (if entered) |
| Company | Company Phone | required |
| Contact | Primary Name / Mobile | required |
| Contact | Primary Email | valid email (if entered) |
| GST | GSTIN | exactly 15 chars (if entered) |
| Users | Admin Name / Mobile / Email / Username | required |
| Users | Admin Email | valid email |
| Users | Admin Password | min 8 characters |

**Recommended additional (server-side) rules for production:**
- GSTIN regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
- PAN `^[A-Z]{5}[0-9]{4}[A-Z]$`, IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`, Pincode `^[1-9][0-9]{5}$`
- Duplicate Branch Code / Warehouse Code / Username uniqueness
- Password strength (upper + number + special), confirm match
- FY End > FY Start; Drug Licence required when Pharmacy module enabled

### Error handling & messages
- **Inline** message + red border on the offending field.
- On failed Next, the wizard stays on the step (no data loss).
- **Success messages:** "Draft saved" toast on Save Draft; full success screen on Complete.

---

## 5. Responsive behaviour

| Breakpoint | Layout |
|------------|--------|
| **Desktop 1920 / 1440** | Left progress rail (288px) + content; sticky footer nav; max-width 1280px |
| **Laptop 1366** | Same; rail visible, comfortable spacing |
| **POS 1024×768** | Rail collapses below `lg`; top progress bar; large touch targets (≥44/48px) |
| **Tablet** | Single column, inline progress bar, 2-col field grids |
| **Mobile** | Single column, fields stack, mode cards stack, footer nav full width |

Mode cards: `md:grid-cols-3` → stack. Field grids `sm:grid-cols-2` → 1 col.
Toggle grids `sm:grid-cols-2 lg:grid-cols-3`. All toggles/switches are touch-sized.

---

## 6. Component specifications

| Component | File | Responsibility |
|-----------|------|----------------|
| `SetupProvider` / `useSetup` | `setup/SetupContext.tsx` | Wizard state, data model, toggles, repeatable CRUD, validation, navigation |
| `SetupPage` / `Wizard` | `app/setup/page.tsx` | Orchestration, mode gate, progress rail, footer, success gate |
| `ProgressRail` | `app/setup/page.tsx` | Grouped step nav, done/active states, jump-to-visited |
| `StepBody` | `setup/StepViews.tsx` | Renders the current step's form |
| `ReviewStep` / `SuccessScreen` | `setup/ReviewStep.tsx` | Summary + completion |
| `ToggleGrid` | `setup/StepViews.tsx` | Data-driven enable/disable lists |
| `RepeatableList` | `setup/StepViews.tsx` | Add / edit / delete entity rows |
| Primitives | `ui/Switch`, `ui/Checkbox`, `ui/RadioCard`, `ui/Select`, `ui/Textarea`, `ui/Input` | Reusable, token-driven, theme-aware |

State shape: a single `SetupData` object — flat sections (`company`, `profile`,
`finance`, `gst`, `admin`, `org`), nested `contacts`, arrays
(`branches/warehouses/banks/users`), a `toggles` map (group → id → bool), and a
`flags` map (single booleans). One `toggle(group,id)` / `flag(id)` API drives all
switch UIs.

---

## 7. Database mapping suggestions

One tenant (company) → many of everything. Suggested tables:

| Table | Source step | Key columns |
|-------|-------------|-------------|
| `companies` | 1, 2 | id, name, legal_name, industry, gstin, pan, cin, udyam, fssai, drug_licence, email, phone, website, logo_url, address, city, state, pincode, country, established_on, employees, turnover_range, ownership_type |
| `company_hours` | 2 | company_id, working_days (json), start_time, end_time |
| `contacts` | 3 | company_id, type(primary/secondary), name, designation, mobile, email |
| `branches` | 4 | id, company_id, name, code (unique/co), type, address, city, state, pincode, phone, email, manager |
| `warehouses` | 5 | id, company_id, branch_id (fk), name, code, type, address, contact, mobile, capacity |
| `org_settings` | 6 | company_id, org_type, centralized_inventory, centralized_pricing, centralized_purchase, centralized_accounting |
| `finance_settings` | 7 | company_id, fy_start, fy_end, acct_start, base_currency, method, default_cost_center, default_profit_center, multi_currency, budget_mgmt, cost_center_acct |
| `bank_accounts` | 8 | id, company_id, bank_name, branch, account_no, ifsc, account_type, upi_id |
| `gst_settings` | 9 | company_id, reg_type, gstin, pan, state_code, effective_date, cgst, sgst, igst, utgst, filing_frequency, e_invoice, e_way, tds |
| `users` | 10 | id, company_id, name, mobile, email, username, password_hash, role |
| `inventory_settings` | 11 | company_id, valuation_method, + tracking flags + stock rules |
| `pos_settings` | 12 | company_id, feature flags, receipt channels |
| `payment_settings` | 13 | company_id, accepted_modes (json), default_mode, gateway_required |
| `notification_settings` | 14 | company_id, channels (json), events (json) |
| `hardware_settings` | 15 | company_id, device flags |
| `module_settings` | 16 | company_id, module flags (json) |
| `industry_settings` | 17 | company_id, vertical, vertical_flags (json) |
| `migration_jobs` | 18 | id, company_id, source, import_scope (json), status |
| `security_settings` | 19 | company_id, otp_login, two_factor, password_expiry, session_timeout, audit_trail |

Toggle/flag groups map cleanly to boolean columns or a single JSONB settings
column per domain. The wizard's `SetupData` already mirrors this grouping, so the
**Complete** action serializes to one `POST /api/setup` payload.

---

## 8. Development-ready notes

- **Persistence:** wire `Save Draft` + `Complete` to `PATCH/POST /api/setup`; hydrate `blankData()` from the saved draft on mount.
- **Auth guard:** gate `/setup` behind an authenticated, not-yet-onboarded session; redirect onboarded tenants to `/dashboard`.
- **Idempotency:** Complete should be safe to retry; provision modules per `module_settings`.
- **Industry prefill:** the chosen `company.industry` can auto-enable Step 17 toggles and the Pharmacy module.
- **Accessibility:** switches use `role="switch"`/`aria-checked`; focus rings via `shadow-focus`; all controls keyboard reachable.

---

© 2026 ONE POS — Business Setup Module.
