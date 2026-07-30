# OASYS ONE POS — Design System & UI Architecture

> Premium · Enterprise · Modern · Clean · Fast · Touch-friendly
> Built to stand alongside SAP Business One, Oracle NetSuite, Microsoft Dynamics, Zoho, Odoo, Salesforce and Shopify POS.

This is the single design reference for the product. It documents the design
language and how it is implemented in code so design and engineering stay in
lock-step. Everything here is wired to live tokens in
[`src/styles/tokens.css`](../src/styles/tokens.css).

---

## 1. Design principles

1. **Executive calm.** Generous whitespace, restrained color, one accent at a time. The data is the hero.
2. **Density on demand.** `comfortable` for desktop analysis; `touch` for POS/tablet speed. Same screens, larger targets.
3. **Speed is a feature.** Static-first rendering, minimal JS, instant theme switching via CSS variables (no re-render of styles).
4. **Token-driven.** No hard-coded hex in components — only semantic tokens. A theme swap repaints the whole app.
5. **Accessible by default.** WCAG AA contrast on text, visible focus rings, ≥44px (≥48px touch) hit targets, full keyboard paths.
6. **One system, many verticals.** Vertical differences live in data/config, not in bespoke UI.

---

## 2. Color system

Colors are **semantic tokens**, never raw values, in components. Brand spec maps to the default *Corporate Blue* theme.

### Brand palette (Corporate Blue / default)

| Role | Token | Hex |
|------|-------|-----|
| Primary | `--color-primary` | `#0F4C81` |
| Primary hover | `--color-primary-hover` | `#0C3E69` |
| Secondary | `--color-secondary` | `#00A8A8` |
| Accent | `--color-accent` | `#FFB800` |
| Success | `--color-success` | `#28A745` |
| Warning | `--color-warning` | `#FF9800` |
| Danger | `--color-danger` | `#DC3545` |
| Info | `--color-info` | `#0EA5E9` |
| Background | `--color-background` | `#F5F7FA` |
| Surface / Card | `--color-surface` / `--color-card` | `#FFFFFF` |
| Menu (sidebar) | `--color-menu` | `#1E293B` |
| Text | `--color-text` | `#334155` |
| Text muted | `--color-text-muted` | `#64748B` |
| Border | `--color-border` | `#E2E8F0` |

Each status color ships with a `-subtle` tint for badge/alert backgrounds
(e.g. `--color-success-subtle`).

### Tailwind aliases

Tokens are exposed as Tailwind utilities (see `tailwind.config.ts`):

```
bg-primary  text-primary-foreground  border-border
bg-success-subtle  text-success
bg-menu  text-menu-foreground  bg-menu-active
bg-card  bg-surface  bg-surface-2  text-foreground  text-muted  text-subtle
shadow-focus   (the focus ring)
```

### Usage rules

- **Primary** = main CTAs, active nav, key emphasis. One per view region.
- **Secondary** = supporting actions, secondary data series.
- **Accent** (`#FFB800`) = highlights/rewards/loyalty only — never body text.
- **Status colors** carry meaning only; never decorative.
- Text on color must hold **AA (4.5:1)**; use `-foreground` tokens for safe pairing.

---

## 3. The 5 themes

| Theme | `data-theme` | Use case | Primary |
|-------|--------------|----------|---------|
| Corporate Blue | `corporate-blue` | Default, executive | `#0F4C81` |
| Emerald Green | `emerald-green` | Grocery, agri | `#0F766E` |
| Retail Orange | `retail-orange` | Fast retail, fashion | `#EA580C` |
| Modern Dark | `modern-dark` | Low-glare POS shifts | `#3B82F6` |
| Pharmacy | `pharmacy` | Medical stores | `#047481` |

Each is a complete token block in `tokens.css`. Activate by setting
`data-theme` on `<html>` — the `ThemeProvider` does this and persists it.
Because only CSS variables change, switching is instant and repaints every
component, chart and shadow consistently.

### Customization layers (precedence, low → high)

1. `:root` primitives (fonts, radius, shadow, layout sizes)
2. `[data-theme="…"]` block (the chosen theme)
3. **Inline brand overrides** on `<html>` (per-tenant color/font) — set via `setBrand()`

This three-layer model is how **color, font, logo, menu and dashboard
customization** are delivered without forking CSS.

---

## 4. Typography

| Token | Value |
|-------|-------|
| `--font-sans` | Inter → Segoe UI → system-ui |
| `--font-mono` | JetBrains Mono → ui-monospace (amounts, codes, SKUs) |

Type scale (defined in `tailwind.config.ts`) is tuned for **data density** —
base is `14px`, line-heights tight enough for tables yet readable.

| Token | Size / line | Typical use |
|-------|-------------|-------------|
| `text-2xs` | 11 / 16 | micro-labels, badges |
| `text-xs` | 12 | captions, table meta |
| `text-sm` | 13 | secondary body |
| `text-base` | 14 | **default body** |
| `text-md` | 15 | emphasized body |
| `text-lg` | 17 | card titles |
| `text-xl` | 20 | section headings |
| `text-2xl` | 24 | page titles |
| `text-3xl` | 30 | dashboard hero numbers |
| `text-4xl`/`5xl` | 40 / 56 | marketing |

**Weights:** 400 body · 500 medium (labels/links) · 600 semibold (titles/table headers) · 700 bold (KPIs, headlines).
**Numbers:** prefer tabular figures / mono for currency and quantities so columns align.

---

## 5. Spacing, radius & elevation

- **Spacing** — 4px base grid (Tailwind scale `1`=4px). Card padding `20px` (`p-5`), page gutters `16–24px`.
- **Radius** — `sm 6 · DEFAULT 8 · md 10 · lg 14 · xl 20`. Cards use `md`; buttons `md`; pills full.
- **Elevation** — six soft, low-spread shadows (`shadow-xs … shadow-xl`) tuned on a slate base so they read premium, not heavy. `shadow-focus` is the accessibility focus ring.

---

## 6. Grid & layout standards

### App shell

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar (menu)     │  Topbar (sticky, 60px)               │
│  264px / 72px      ├──────────────────────────────────────┤
│  collapsible       │  Content  (max-w 1600, p-4 → p-6)    │
│  off-canvas < lg   │  scrollable                          │
└────────────────────┴──────────────────────────────────────┘
```

- Sidebar: `--sidebar-width: 264px`, collapsed `72px`. Dark `--color-menu`.
- Topbar: `--topbar-height: 60px` (68px in touch density), sticky, blurred.
- Content max width `1600px` to keep line lengths sane on 1440p+.

### Responsive grids

- **Dashboard KPIs:** 1 col (mobile) → 2 (sm) → 4 (xl).
- **Content blocks:** 12-col mental model via Tailwind `grid-cols-3` with `lg:col-span-2` splits.
- **Forms:** single column ≤ md, two columns ≥ lg; labels above inputs.

### Breakpoints (device targets)

| Tailwind | Min width | Primary device |
|----------|-----------|----------------|
| (base) | 0 | Mobile portrait |
| `sm` | 640 | Mobile landscape / small tablet |
| `md` | 768 | Tablet · POS `1024×768` |
| `lg` | 1024 | POS `1366×768` · laptop — **sidebar becomes fixed** |
| `xl` | 1280 | Laptop `1366/1920` |
| `2xl` | 1536 | Desktop `1920–2560` |

POS resolutions (`1024×768`, `1366×768`) sit at `md`/`lg`; with `touch`
density the shell gives larger targets without layout change.

---

## 7. Component library

Location: [`src/components/ui`](../src/components/ui). All are token-driven and theme-aware.

| Component | File | Variants / notes |
|-----------|------|------------------|
| **Button** | `Button.tsx` | `primary · secondary · accent · outline · ghost · danger` × `sm/md/lg/xl`; `xl` is POS-sized (56px). `block`, active-press scale, focus ring. |
| **Input** | `Input.tsx` | Label, hint, error, leading/trailing icons; 40px height; danger state. |
| **Card** | `Card.tsx` | `Card / CardHeader / CardTitle / CardBody`. |
| **Badge** | `Badge.tsx` | tones: `neutral · primary · success · warning · danger · info`. |
| **StatCard** | `StatCard.tsx` | KPI tile with delta arrow + tone. |
| **Logo** | `Logo.tsx` | Themed wordmark; `invert` for dark surfaces; swap for tenant logo. |

### Layout & theme components

| Component | File | Role |
|-----------|------|------|
| `AppShell` | `layout/AppShell.tsx` | Sidebar + Topbar + scroll area; collapse + mobile drawer state. |
| `Sidebar` | `layout/Sidebar.tsx` | Grouped ERP nav, active state, collapse, off-canvas. |
| `Topbar` | `layout/Topbar.tsx` | Store selector, global search (Ctrl+K), notifications, theme switcher, user menu. |
| `ThemeProvider` | `theme/ThemeProvider.tsx` | Theme/density/brand state + persistence. |
| `ThemeSwitcher` | `theme/ThemeSwitcher.tsx` | Theme picker, density toggle, live brand color. |

### Component conventions

- Props use semantic `variant`/`tone`/`size` enums, never raw classes for color.
- `forwardRef` on form controls (`Button`, `Input`).
- Compose with the `cn()` helper; consumer `className` always overrides last.
- Every interactive element: hover, focus-visible ring, disabled, and ≥44px target.

---

## 8. Navigation design

The module map (`src/lib/navigation.ts`) groups all ERP areas so the sidebar
scales without becoming a wall of links:

```
Overview          Dashboard · POS Terminal
Operations        Sales · Purchase · Inventory · Masters
Customers         CRM · Loyalty · Chit Scheme
Finance           Accounting · GST & E-Invoice
Organization      Multi-Store · HRMS
Intelligence      Reports · AI Analytics
Add-ons           Pharmacy · Settings
```

- Active route → `--color-menu-active` pill.
- Collapsed mode shows icons + tooltips (72px rail) for dense POS screens.
- Keyboard hints (e.g. POS = `F2`) surface as inline badges.

---

## 9. Dashboard design

The executive dashboard ([`/dashboard`](../src/app/(app)/dashboard/page.tsx)) follows an **F-pattern**:

1. **Header row** — title + primary actions (New Sale / New Purchase).
2. **KPI band** — four StatCards (sales, invoices, low-stock, customers) with deltas.
3. **Primary panel** — sales trend chart (CSS bars, theme-gradient) + quick actions.
4. **Operational panel** — recent invoices table + low-stock alerts with progress meters.

Charts are pure CSS/SVG placeholders driving the visual language; swap in a
charting lib later while keeping the same token colors.

---

## 10. POS design (next pass — spec)

The POS Terminal will reuse the shell in `touch` density:

- **Two-pane:** product grid / search (left) · live cart + totals (right).
- **Action bar:** large `xl` buttons — Pay, Hold, Discount, Customer, Print.
- **Keyboard-first:** barcode focus trap, `F`-key shortcuts, numpad entry.
- **Offline-resilient:** queue invoices locally, sync on reconnect.
- Targets ≥48px; high-contrast amounts in mono.

---

## 11. Responsive & device strategy

| Device | Layout behavior |
|--------|-----------------|
| Mobile | Sidebar → off-canvas drawer; KPIs stack; tables scroll horizontally; topbar search collapses. |
| Tablet / POS `1024×768` | Drawer or collapsed rail; 2-col grids; `touch` density recommended. |
| POS `1366×768` (`lg`) | Fixed collapsed rail + content; large targets. |
| Laptop `1366/1920` | Full sidebar, 4-col KPIs, two-pane content. |
| Desktop `1920–2560` | Content capped at 1600px, centered; more columns where useful. |

---

## 12. UX guidelines

- **Feedback** — every action gives immediate visual response (press scale, loading text, toast — to add).
- **Forms** — label above field, inline validation, primary action right/last, destructive actions need confirm.
- **Tables** — sticky header, zebra-free with hover rows, right-align numbers, status as badges, bulk actions in a context bar.
- **Empty states** — icon + one line + a primary action; never a blank panel.
- **Errors** — plain language + a next step; danger tone reserved for true errors.
- **Loading** — skeletons for content, inline spinners for actions; never block the whole screen.
- **Color is never the only signal** — pair with icon/label for color-blind users.

---

## 13. Design tokens — quick reference

All tokens live in [`src/styles/tokens.css`](../src/styles/tokens.css). Categories:

```
Color    --color-primary / -hover / -subtle / -foreground / -ring
         --color-secondary · --color-accent
         --color-success|warning|danger|info  (+ -subtle)
         --color-background · -surface · -surface-2 · -card
         --color-menu · -hover · -active · -foreground · -muted
         --color-border · -border-strong
         --color-text · -text-muted · -text-subtle
Type     --font-sans · --font-mono
Radius   --radius-sm|··|xl
Shadow   --shadow-xs|sm||md|lg|xl
Layout   --sidebar-width · --sidebar-collapsed-width · --topbar-height
```

To add a theme: copy a `[data-theme]` block, rename it, adjust colors, and add
an entry to `THEMES` in `src/lib/themes.ts`. Nothing else changes.

---

## 14. Deliverables status

| Deliverable | Status |
|-------------|--------|
| Design System · Style Guide · Typography · Color · Grid | ✅ this doc + tokens |
| Component Library | ✅ core set (Button, Input, Card, Badge, StatCard, Logo) |
| Navigation Design | ✅ `navigation.ts` + Sidebar |
| Dashboard Design | ✅ `/dashboard` |
| Theme Engine (5 themes + customization) | ✅ tokens + ThemeProvider/Switcher |
| Landing · Login · Dashboard journey | ✅ live |
| Design Tokens · Layout Standards · UX Guidelines | ✅ this doc |
| POS Design | ◻ spec'd (§10), build next |
| Mobile / Tablet layouts | ✅ responsive shell; screen-level next |

---

© 2026 OASYS ONE POS — Enterprise Retail ERP + POS.
