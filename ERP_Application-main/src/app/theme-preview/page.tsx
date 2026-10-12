import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  IndianRupee,
  Boxes,
  Star,
  Check,
} from "lucide-react";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";

/* Candidate palettes — each rendered as a realistic mini-dashboard so you can
   compare them visually and pick one to apply app-wide. */
interface Palette {
  id: string;
  name: string;
  vibe: string;
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  gradient: string;
  bg: string;
  card: string;
  menu: string;
  menuMuted: string;
  text: string;
  muted: string;
  border: string;
  subtle: string; // primary-subtle tint
}

const THEMES: Palette[] = [
  {
    id: "indigo",
    name: "1 · Indigo Modern",
    vibe: "Clean premium SaaS — the recommended all-rounder",
    primary: "#4F46E5",
    secondary: "#0EA5E9",
    accent: "#F59E0B",
    success: "#16A34A",
    gradient: "linear-gradient(135deg,#4F46E5 0%,#0EA5E9 100%)",
    bg: "#F8FAFC",
    card: "#FFFFFF",
    menu: "#0F172A",
    menuMuted: "#94A3B8",
    text: "#0F172A",
    muted: "#64748B",
    border: "#E2E8F0",
    subtle: "#EEF0FE",
  },
  {
    id: "corporate",
    name: "2 · Refined Corporate Blue",
    vibe: "Trustworthy, executive — modern take on classic ERP blue",
    primary: "#2563EB",
    secondary: "#0891B2",
    accent: "#F59E0B",
    success: "#16A34A",
    gradient: "linear-gradient(135deg,#2563EB 0%,#0891B2 100%)",
    bg: "#F8FAFC",
    card: "#FFFFFF",
    menu: "#0F1B2E",
    menuMuted: "#8C9CB3",
    text: "#0F172A",
    muted: "#64748B",
    border: "#E2E8F0",
    subtle: "#E6EEFC",
  },
  {
    id: "teal",
    name: "3 · Slate + Teal",
    vibe: "Calm, fresh, low-glare — easy for long POS shifts",
    primary: "#0D9488",
    secondary: "#0284C7",
    accent: "#F59E0B",
    success: "#16A34A",
    gradient: "linear-gradient(135deg,#0D9488 0%,#0284C7 100%)",
    bg: "#F7FAFA",
    card: "#FFFFFF",
    menu: "#0F172A",
    menuMuted: "#94A3B8",
    text: "#0F172A",
    muted: "#5A6B72",
    border: "#E2E8F0",
    subtle: "#DEF3F1",
  },
  {
    id: "graphite",
    name: "4 · Graphite Minimal",
    vibe: "Restrained, content-first — the data is the hero",
    primary: "#3B82F6",
    secondary: "#64748B",
    accent: "#0EA5E9",
    success: "#16A34A",
    gradient: "linear-gradient(135deg,#3B82F6 0%,#0EA5E9 100%)",
    bg: "#F9FAFB",
    card: "#FFFFFF",
    menu: "#111827",
    menuMuted: "#9CA3AF",
    text: "#111827",
    muted: "#6B7280",
    border: "#E5E7EB",
    subtle: "#E8F0FE",
  },
];

export default function ThemePreviewPage() {
  return (
    <div style={{ background: "#eef1f6", minHeight: "100vh" }} className="p-5 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Choose your app theme
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Each option below is the same dashboard rendered in that palette. Tell me
            which one to apply — e.g. <span className="font-semibold text-slate-700">“use Indigo Modern”</span>.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {THEMES.map((p) => (
            <ThemeMock key={p.id} p={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemeMock({ p }: { p: Palette }) {
  const nav = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: ShoppingCart, label: "Sales" },
    { icon: Package, label: "Products" },
    { icon: Users, label: "Customers" },
  ];
  const kpis = [
    { icon: IndianRupee, label: "Sales", value: "₹2.4L", c: p.primary },
    { icon: ShoppingCart, label: "Orders", value: "318", c: p.secondary },
    { icon: Boxes, label: "Stock", value: "12.7K", c: p.accent },
  ];
  const bars = [42, 64, 50, 78, 58, 88, 70, 96, 64, 84];

  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: p.border, background: p.card }}
    >
      {/* Label */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: p.border }}
      >
        <div>
          <h3 className="text-sm font-bold" style={{ color: p.text }}>
            {p.name}
          </h3>
          <p className="text-xs" style={{ color: p.muted }}>
            {p.vibe}
          </p>
        </div>
        <div className="flex gap-1.5">
          {[p.primary, p.secondary, p.accent].map((c) => (
            <span key={c} className="h-5 w-5 rounded-full ring-1 ring-black/5" style={{ background: c }} />
          ))}
        </div>
      </div>

      {/* Mini app */}
      <div className="flex h-[280px]" style={{ background: p.bg }}>
        {/* Sidebar */}
        <div className="hidden w-32 flex-col gap-1 p-2.5 sm:flex" style={{ background: p.menu }}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="grid h-6 w-6 place-items-center rounded-md" style={{ background: p.gradient }}>
              <span className="h-2.5 w-2.5 rounded-sm bg-white" />
            </span>
            <span className="text-[11px] font-bold text-white">{DEFAULT_PRODUCT_NAME}</span>
          </div>
          {nav.map((n) => (
            <div
              key={n.label}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium"
              style={
                n.active
                  ? { backgroundImage: p.gradient, color: "#fff" }
                  : { color: p.menuMuted }
              }
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-3">
          {/* topbar */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: p.text }}>
              Dashboard
            </span>
            <span
              className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm"
              style={{ backgroundImage: p.gradient }}
            >
              + Add
            </span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-lg border p-2"
                style={{ borderColor: p.border, background: p.card }}
              >
                <span className="grid h-6 w-6 place-items-center rounded-md text-white" style={{ background: k.c }}>
                  <k.icon className="h-3.5 w-3.5" />
                </span>
                <p className="mt-1.5 text-sm font-bold" style={{ color: p.text }}>
                  {k.value}
                </p>
                <p className="text-[9px]" style={{ color: p.muted }}>
                  {k.label}
                </p>
              </div>
            ))}
          </div>

          {/* chart */}
          <div
            className="mt-2 flex h-16 items-end gap-1 rounded-lg border p-2"
            style={{ borderColor: p.border, background: p.card }}
          >
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, backgroundImage: p.gradient }} />
            ))}
          </div>

          {/* table row */}
          <div
            className="mt-2 flex items-center gap-2 rounded-lg border p-2"
            style={{ borderColor: p.border, background: p.card }}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white" style={{ backgroundImage: p.gradient }}>
              P
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold" style={{ color: p.text }}>
                Priya Sharma
              </p>
              <p className="text-[9px]" style={{ color: p.muted }}>
                CUST-1001
              </p>
            </div>
            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: p.accent + "22", color: p.accent === "#F59E0B" ? "#92600A" : p.accent }}>
              <Star className="h-2.5 w-2.5 fill-current" /> Gold
            </span>
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: p.success + "1f", color: p.success }}>
              Active
            </span>
            <span className="grid h-5 w-5 place-items-center rounded-md text-white" style={{ background: p.primary }}>
              <Check className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
