# Tenant → Business → Branch (Multi-Entity Data Segregation)

How ONE POS isolates data across accounts, businesses and locations.

## The three levels

| Level | What it is | Created when | Segregation key |
|-------|-----------|--------------|-----------------|
| **Tenant** | The **subscriber account** — owns the subscription/plan, users and all data. | At **sign-up** (`/api/auth/register`). | `tenantId` (on every table) |
| **Business** | A **legal company / GST entity** under the tenant. A tenant owns **1..N** businesses. | Default business seeded at sign-up; **finalized when Business Setup is completed**. | `businessId` |
| **Branch** | A **physical location** (store, warehouse, head office) of a business. A business owns **1..N** branches. | Default "Main Branch" with each business; more added in System → Account & Tenant (or Branch Setup). | `branchId` |

```
Tenant (account)            ← tenantId    — isolates one customer from every other
 └─ Business (GST entity)   ← businessId  — isolates sibling businesses in one account
     └─ Branch (location)   ← branchId    — isolates a location's operational data
```

## Tenant vs Business Setup (FAQ)

- The **tenant is the account**; **Business Setup configures a business** inside it.
- **Single-business tenants** (the common case) never see a separate "create tenant"
  step — completing **Business Setup** creates/finalizes the tenant's one Business and
  syncs the account name (`/api/company-setup` on `status: "completed"`).
- **Multi-business tenants** add further businesses in **System → Account & Tenant**.

## How segregation works in queries

Every tenant-scoped transactional table has `businessId` + `branchId` (nullable,
indexed by `(tenantId, businessId, branchId)`). Existing rows were backfilled to each
tenant's default business/branch by migration `20260623220000_tenant_business_branch`.

The active scope is resolved per request from `src/lib/auth/scope.ts`:

```ts
const scope = await getActiveScope(user);   // { tenantId, businessId, branchId }

// Reads — filter to the active business (+ branch):
prisma.sale.findMany({ where: scopeWhere(scope, { branch: true }) });

// Writes — stamp the active business/branch onto the new row:
prisma.pettyCashVoucher.create({ data: { tenantId: user.tenantId, ...scopeData(scope, { branch: true }), /* … */ } });
```

`getActiveScope` reads the `pos_business` / `pos_branch` selection cookies (set by
`POST /api/system/scope`) and **validates they belong to the tenant**, falling back to
the tenant's default business and that business's default branch. A stale or forged
cookie can never read another account's data.

`{ branch: true }` includes `branchId`; omit it for business-level data (masters,
ledgers, suppliers, customers) that isn't location-specific.

## How users are segregated

A user is an *actor*, not data, so segregation works differently. The `users`
table carries the user's **home assignment** — `businessId` + `branchId` (the
business/branch they operate in by default):

```
users(id, tenantId, businessId, branchId, role, …)
```

`getActiveScope(user)` resolves the active scope from, in order:
1. the **switch cookie** — honoured ONLY for `owner` / `admin` roles;
2. the user's **assigned** `businessId` / `branchId`;
3. the tenant's **default** business / branch.

So a regular user (cashier, manager) is pinned to their assigned business +
branch and cannot read another by forging a cookie; an owner/admin can switch
businesses/branches within the tenant (via `POST /api/system/scope`). The owner
is auto-assigned to the business + branch created at sign-up; existing users were
backfilled to their tenant's defaults.

*Multi-branch users* (one user working across several branches) would be a
future `user_branch_access` join table; today each user has a single home scope.

## Rollout status

- **DB:** `businesses` + `branches` tables created; `businessId`/`branchId` added and
  backfilled on all 27 tenant-scoped transactional tables (+ `sale_payments` via its
  parent sale). `company_setups.businessId` links a setup to its business.
- **Wired to active scope:** registration, Business Setup completion, petty-cash
  vouchers, and financial periods.
- **Remaining:** progressively adopt `scopeWhere` / `scopeData` in the other read/write
  paths (sales, inventory, GRN, journals, masters). Until a path adopts it, it still
  scopes correctly by `tenantId` (data stays attributed via the backfill), it just
  won't yet split a multi-business tenant — add the scope helper as each is touched.

## Settings note

Tenant-level singletons (`*_settings`, `theme_settings`, `petty_cash_config`) stay
**tenant-wide** by design (one row per tenant). Promote any to per-business later by
adding `businessId` and switching its `@unique(tenantId)` to `@unique([tenantId, businessId])`.
