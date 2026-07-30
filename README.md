# OASYS ONE POS

Enterprise-grade **Retail ERP + POS** — designed for SaaS and On-Premise deployment across 15+ retail verticals (grocery, pharmacy, textile, footwear, cosmetics, electronics, furniture, hardware, auto parts, agri, gifts, stationery, sports, wholesale and multi-store chains).

This repository contains the **product UI foundation**: a configurable design system, a 5-theme engine, a reusable component library, the enterprise app shell, and the first user journey — **Landing → Login → Dashboard**.

> Product name `OASYS ONE POS` is a working title and is centrally configurable (see Theming → Brand).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS mapped onto CSS custom properties |
| Theming | CSS-variable theme engine + React context |
| Icons | lucide-react |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

## User journey (live today)

```
/                →  Landing page (brand, features, industries, "Login" CTA)
/login           →  Split-panel enterprise login  (any credentials → dashboard)
/dashboard       →  Executive dashboard inside the persistent app shell
```

Login is a **demo stub** — any credentials route to `/dashboard`. Wire real auth
into `src/app/(app)/layout.tsx` (guard) and `src/app/login/page.tsx` (submit).

## Project structure

```
src/
├── app/
│   ├── layout.tsx              Root layout · ThemeProvider · FOUC-safe theme init
│   ├── globals.css             Tailwind layers + base styles
│   ├── page.tsx                Landing page
│   ├── login/page.tsx          Login screen
│   └── (app)/                  Authenticated console (route group)
│       ├── layout.tsx          Wraps pages in <AppShell>
│       └── dashboard/page.tsx  Dashboard
├── components/
│   ├── ui/                     Button, Card, Input, Badge, StatCard, Logo
│   ├── layout/                 AppShell, Sidebar, Topbar
│   └── theme/                  ThemeProvider, ThemeSwitcher
├── lib/
│   ├── themes.ts               Theme registry (5 themes)
│   ├── navigation.ts           ERP module navigation model
│   └── cn.ts                   className combiner
└── styles/
    └── tokens.css              ★ Design tokens + all 5 theme definitions
```

## Theming

The theme engine lives in two files:

- **`src/styles/tokens.css`** — every color/spacing/radius/shadow as a CSS variable, with one block per theme keyed by `[data-theme="…"]`.
- **`src/components/theme/ThemeProvider.tsx`** — persists the active theme/density/brand to `localStorage` and reflects them onto `<html>`.

Switch themes at runtime via the palette icon in the topbar. Five themes ship:
**Corporate Blue** (default), **Emerald Green**, **Retail Orange**, **Modern Dark**, **Pharmacy**.

**Brand (white-label):** `setBrand({ primaryColor, secondaryColor, accentColor, fontFamily, logoUrl, productName })` injects inline overrides that win over the theme — this is how per-tenant color/font/logo/name customization works.

**Density:** `comfortable` (desktop) and `touch` (POS/tablet — enlarges hit targets to ≥48px).

See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for the full design system: color, typography, grid, tokens, components, responsive breakpoints, and theming architecture.

## Responsive targets

Designed and tested against: POS `1024×768` / `1366×768`, laptop `1366×768` / `1920×1080`, desktop `1920×1080` / `2560×1440`, plus tablet and mobile. The app shell collapses the sidebar on desktop and becomes an off-canvas drawer below `lg`.

## Roadmap (next passes)

1. **POS Terminal** screen (touch billing, cart, payment, hold/recall).
2. Module screens: Masters, Purchase, Inventory, Sales, CRM, Accounting, GST.
3. Data layer + real authentication & RBAC.
4. Pharmacy add-on (batch/expiry, schedule drugs).
5. AI Analytics & reporting.

---

© 2026 OASYS ONE POS — Enterprise Retail ERP + POS.
