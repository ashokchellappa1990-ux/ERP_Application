# Employee, User, Roles & Permissions Module — Specification

Organization management console for ONE POS — employees (HRMS), user accounts,
RBAC, branch access, approval hierarchy, attendance, shifts, performance and audit.
Suits retail/pharmacy/grocery/textile/electronics/wholesale and multi-branch orgs.

- **Menu:** System → **User & Roles** → Employees & Access
- **Route:** `/organization/user-roles`
- **Code:** `src/app/(app)/organization/user-roles/page.tsx`, `src/components/org/UserRolesConsole.tsx`, `src/lib/org/userRolesConfig.ts`

---

## 1. Layout & UX

Single console: **dashboard KPI row** (Employees · Active · Users · Roles · Pending
Approvals · Attendance Today) + **quick actions** (Add Employee · Create User ·
Create Role · Configure Permissions · Assign Branch Access) + a **grouped left tab
rail** + gradient-headed content. Responsive: rail → dropdown below `lg`; tables scroll.

---

## 2. The 12 sections

| Section | Content |
|---------|---------|
| Employee Master | code, name, dept, designation, type (Permanent/Contract/…), branch, mobile, **status** badge; search + add/delete |
| User Accounts | username, login email, role, branch access, **2FA**, status; add/delete |
| Roles Management | 14 system roles (chips) + custom role creation (code/name/desc) |
| **Permission Management** | **RBAC matrix** — role selector × module rows (grouped Masters/Operations/Finance/Admin/Reports) × 7 levels (View/Add/Edit/Delete/Approve/Export/Print) with per-cell toggles + "All" switch |
| Branch Access | All / Assigned / Own-branch radio + per-branch access level + warehouse access |
| Approval Hierarchy | Purchase / Sales / Expense / User-Creation chains rendered as ordered level pills |
| Attendance Setup | methods (Manual/Biometric/Mobile/Geo) + tracked (check-in/out, hours, OT) |
| Shift Management | code, name, start, end, break; add/delete (Morning/General/Evening/Night) |
| Employee Performance | sales, collections, customers, attendance %, achievement %, incentive |
| Audit Trail | user, action, date-time, IP, device — searchable, colour-coded events |
| AI Employee Setup | Aadhaar / card / Excel → extract name, mobile, email, designation → create record |
| Import | Employee Master / User Accounts / Reporting Structure from Excel/CSV/ERP + report |

---

## 3. Role → Permission matrix (RBAC)

Rows = modules (5 groups), Columns = 7 levels. State = `Record<module, Record<level, bool>>`
per selected role. A module's "All" switch sets every level. Default new roles get
View/Add/Edit. "Approve" gates maker-checker steps elsewhere in the app.

---

## 4. Validation & security rules

| Rule | Scope |
|------|-------|
| Unique Employee Code / Mobile / Email | server |
| Unique Username / Login Email | server |
| Password policy (len, upper, number, symbol) | client + server |
| Confirm password match | client |
| Session timeout + login-attempt lockout | server (audit logs lockouts) |
| 2FA / OTP / Biometric per user | server |
| A user must map to one role; role drives permissions | server |
| Branch access enforced on every list/query | server |

---

## 5. Database design (suggested)

```
employees        id, company_id, code (uniq), name, gender, dob, mobile, alt_mobile,
                 email, aadhaar, pan, type, department, designation, manager_id,
                 join_date, relieve_date, status, branch_id, warehouse_id
users            id, company_id, employee_id, username (uniq), email (uniq), mobile,
                 password_hash, force_change, expiry_at, status,
                 twofa, otp_login, biometric
roles            id, company_id, code, name, description, is_system
permissions      id, role_id, module, level, allowed         -- RBAC matrix
branch_access    id, user_id, scope(all/assigned/own), branch_id, access_level
warehouse_access id, user_id, scope, warehouse_id
approval_levels  id, company_id, flow(purchase/sales/expense/user), seq, role
shifts           id, company_id, code, name, start, end, break_minutes
attendance       id, employee_id, date, method, check_in, check_out, hours, overtime
performance      id, employee_id, period, sales, collections, customers,
                 attendance_pct, target, achievement_pct, incentive
audit_log        id, company_id, user_id, action, entity, entity_id, before, after,
                 ip, device, at
```

---

## 6. API design (suggested REST)

```
GET    /api/org/dashboard           KPI counts
GET/POST/PUT/DELETE  /api/employees
GET/POST/PUT/DELETE  /api/users           (+ /:id/lock | unlock | reset-password)
GET/POST  /api/roles                 GET/PUT /api/roles/:id/permissions   (matrix)
GET/PUT   /api/users/:id/branch-access
GET/PUT   /api/org/approval-levels
GET/POST  /api/shifts                GET /api/attendance?from&to&employee
GET       /api/performance?period    GET /api/audit?user&action&from&to
POST      /api/org/ai-extract        (aadhaar/card/excel → employee fields + confidence)
POST      /api/org/import            (employees/users/structure → { valid, errors[] })
```

---

## 7. Development-ready notes

- Replace the seed arrays in `userRolesConfig.ts` with the APIs above; `ManagedList`
  add/delete maps to POST/DELETE.
- Persist the permission matrix via `PUT /api/roles/:id/permissions`; enforce server-side.
- Gate every screen + API on `permissions` for the user's role, and filter data by
  `branch_access`.
- Audit Trail is read-only from `audit_log`; write entries from a server middleware.

---

© 2026 ONE POS — Employee, User, Roles & Permissions Module.
