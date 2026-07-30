"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle2,
  Gift,
  CreditCard,
  Ban,
  IndianRupee,
  Plus,
  Upload,
  Star,
  Wallet,
  Search,
  Eye,
  Pencil,
  MoreVertical,
  SlidersHorizontal,
  ChevronDown,
  X,
  Download,
  FileSpreadsheet,
  CircleAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { type CustomerStatus, type CustomerRow as ListRow } from "@/lib/masters/customerConfig";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

const STATUS_TONE: Record<CustomerStatus, "success" | "neutral" | "danger"> = {
  Active: "success",
  Inactive: "neutral",
  Blocked: "danger",
};
const FILTERS: ("All" | CustomerStatus)[] = ["All", "Active", "Inactive", "Blocked"];
const TIER_TONE: Record<string, string> = {
  Silver: "text-slate-500",
  Gold: "text-accent-foreground",
  Platinum: "text-secondary",
  Diamond: "text-primary",
};

export default function CustomerMasterPage() {
  const fmt = useFmt();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | CustomerStatus>("All");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [all, setAll] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const j = await fetch("/api/masters/customers", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) {
        const apMap: Record<string, ListRow["approval"]> = { approved: "Approved", pending: "Pending", rejected: "Rejected", draft: "Draft" };
        setAll((j.customers as Record<string, unknown>[]).map((c) => ({
          id: String(c.id), code: (c.code as string) || `CUST-${c.id}`, name: c.name as string, type: (c.type as string) || "—", category: (c.category as string) || "Regular",
          mobile: (c.phone as string) || "—", tier: "—", points: (c.loyaltyPoints as number) || 0, outstanding: (c.outstanding as number) || 0,
          status: ((c.status as string) || "Active") as CustomerStatus, approval: apMap[c.approvalStatus as string] || "Draft",
          loyalty: ((c.loyaltyPoints as number) || 0) > 0, credit: !!c.creditAllowed,
        })));
      }
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => ({
    total: all.length,
    active: all.filter((c) => c.status === "Active").length,
    loyalty: all.filter((c) => c.loyalty).length,
    credit: all.filter((c) => c.credit).length,
    blocked: all.filter((c) => c.status === "Blocked").length,
    outstanding: all.reduce((s, c) => s + (c.outstanding || 0), 0),
  }), [all]);

  const types = useMemo(() => ["All Types", ...Array.from(new Set(all.map((c) => c.type)))], [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((c) => {
      const haystack = `${c.code} ${c.name} ${c.type} ${c.category} ${c.mobile} ${c.tier} ${c.status} ${c.approval} ${c.outstanding} ${c.points}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesStatus = filter === "All" || c.status === filter;
      const matchesType = typeFilter === "All Types" || c.type === typeFilter;
      return matchesQuery && matchesStatus && matchesType;
    });
  }, [all, query, filter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const reset = () => setPage(1);
  const fmtL = (n: number) => `₹${(n / 100000).toFixed(1)}L`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <span>Masters</span>
            <span className="text-subtle">/</span>
            <span className="font-medium text-foreground">Customers</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Customer Master</h1>
          <p className="mt-0.5 text-sm text-muted">Manage customers, CRM, loyalty, credit &amp; outstanding in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="md" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import</Button>
          <Link href="/masters/customer/new">
            <Button size="md"><Plus className="h-4 w-4" /> Add Customer</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <CustomerStat icon={Users} label="Total Customers" value={stats.total.toLocaleString()} sub="all customers" tone="primary" />
        <CustomerStat icon={CheckCircle2} label="Active" value={stats.active.toLocaleString()} sub={`${stats.total ? Math.round(stats.active / stats.total * 100) : 0}% of total`} tone="success" />
        <CustomerStat icon={Gift} label="Loyalty Members" value={stats.loyalty.toLocaleString()} sub="enrolled" tone="accent" />
        <CustomerStat icon={CreditCard} label="Credit Customers" value={String(stats.credit)} sub="on credit terms" tone="secondary" />
        <CustomerStat icon={Ban} label="Blocked" value={String(stats.blocked)} sub="on hold" tone="danger" />
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); reset(); }} placeholder="Search name, code, mobile, category…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
            </div>
            <FilterSelect value={typeFilter} onChange={(v) => { setTypeFilter(v); reset(); }} options={types} />
          </div>
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => { setFilter(f); reset(); }} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", filter === f ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground")}>
                {f === "All" ? "All Status" : f}
              </button>
            ))}
            <button className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary" aria-label="More filters"><SlidersHorizontal className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3 text-center">Tier</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white shadow-sm">{c.name.charAt(0)}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-foreground">{c.name}</span>
                          <Badge tone="neutral" className="hidden sm:inline-flex">{c.category}</Badge>
                        </div>
                        <div className="text-2xs text-subtle">{c.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.type}</td>
                  <td className="px-4 py-3 text-muted">{c.mobile}</td>
                  <td className="px-4 py-3 text-center">
                    {c.tier === "—" ? <span className="text-subtle">—</span> : (
                      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", TIER_TONE[c.tier] ?? "text-muted")}>
                        <Star className="h-3 w-3 fill-current" />{c.tier}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{fmt.num(c.points)}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">
                    {c.outstanding > 0 ? fmt.money(c.outstanding) : <span className="text-success">Settled</span>}
                  </td>
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconAction href={`/masters/customer/${c.id}`} title="View" icon={Eye} />
                      <IconAction href={`/masters/customer/${c.id}`} title="Edit" icon={Pencil} accent />
                      <button title="More" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-border hover:bg-surface-2 hover:text-foreground"><MoreVertical className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && all.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">Loading customers…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">{all.length === 0 ? <>No customers yet. Click <Link href="/masters/customer/new" className="font-semibold text-primary hover:underline">Add Customer</Link>.</> : "No customers match your search."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={currentPage} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="customers" />
      </div>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

/* --------------------------------------------------------- filter select */
function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 appearance-none rounded-md border border-border bg-surface pl-3 pr-8 text-sm font-medium text-foreground transition hover:border-primary/40 focus:border-primary focus:outline-none">
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    </div>
  );
}

/* ------------------------------------------------------------ icon action */
function IconAction({ href, title, icon: Icon, accent }: { href: string; title: string; icon: LucideIcon; accent?: boolean }) {
  return (
    <Link href={href} title={title} aria-label={title} className={cn("grid h-8 w-8 place-items-center rounded-md border transition", accent ? "border-primary/30 bg-primary-subtle text-primary hover:bg-primary hover:text-white" : "border-border bg-surface text-muted hover:border-primary/40 hover:text-primary")}>
      <Icon className="h-4 w-4" />
    </Link>
  );
}

/* --------------------------------------------------------------- stats - */
const STAT_TONES = {
  primary: { chip: "bg-primary text-white", sub: "text-muted" },
  success: { chip: "bg-success text-white", sub: "text-success" },
  secondary: { chip: "bg-secondary text-white", sub: "text-muted" },
  warning: { chip: "bg-warning text-white", sub: "text-warning" },
  danger: { chip: "bg-danger text-white", sub: "text-danger" },
  accent: { chip: "bg-accent text-accent-foreground", sub: "text-muted" },
} as const;

function CustomerStat({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone: keyof typeof STAT_TONES }) {
  const t = STAT_TONES[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm", t.chip)}><Icon className="h-[18px] w-[18px]" /></span>
        <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
      </div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-0.5 text-2xs font-semibold", t.sub)}>{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------- quick action -- */
const QA_TONES = {
  primary: { card: "border-primary/20 bg-primary-subtle", ring: "text-primary" },
  secondary: { card: "border-secondary/20 bg-secondary-subtle", ring: "text-secondary" },
  success: { card: "border-success/20 bg-success-subtle", ring: "text-success" },
  accent: { card: "border-accent/30 bg-accent/10", ring: "text-accent-foreground" },
} as const;

function QuickAction({ icon: Icon, label, sub, href, onClick, gradient, tone = "primary" }: { icon: LucideIcon; label: string; sub: string; href?: string; onClick?: () => void; gradient?: boolean; tone?: keyof typeof QA_TONES }) {
  const t = QA_TONES[tone];
  const inner = (
    <div className={cn("flex h-full flex-col items-center gap-2.5 rounded-2xl border p-5 text-center transition hover:-translate-y-0.5 hover:shadow-md", gradient ? "border-transparent bg-brand-gradient text-white shadow-sm" : t.card)}>
      <span className={cn("grid h-12 w-12 place-items-center rounded-full shadow-sm", gradient ? "bg-white/20 text-white" : cn("bg-surface", t.ring))}><Icon className="h-5 w-5" /></span>
      <div>
        <p className={cn("text-sm font-bold", gradient ? "text-white" : "text-foreground")}>{label}</p>
        <p className={cn("mt-0.5 text-2xs", gradient ? "text-white/80" : "text-muted")}>{sub}</p>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return <button type="button" onClick={onClick} className="h-full w-full text-left">{inner}</button>;
}

/* ------------------------------------------------------------ import --- */
function ImportModal({ onClose }: { onClose: () => void }) {
  const templates = ["Customer Master", "Outstanding Balances", "Loyalty Data"];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm">
      <div className="animate-fade-in flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white"><Upload className="h-5 w-5" /></span>
            <div><p className="text-sm font-bold text-foreground">Import Customers</p><p className="text-2xs text-muted">Excel or CSV — bulk add & update</p></div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">1. Download a template</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {templates.map((t) => (
              <button key={t} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-xs font-medium text-foreground transition hover:border-primary hover:bg-surface-2"><Download className="h-4 w-4 shrink-0 text-primary" />{t}</button>
            ))}
          </div>
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">2. Upload your file</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-subtle/30">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium text-foreground">Drag &amp; drop or click to upload</span>
            <input type="file" className="hidden" accept=".xlsx,.csv" />
          </label>
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">3. Validation report</p>
          <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" /> 312 valid</span>
              <span className="inline-flex items-center gap-1.5 text-danger"><CircleAlert className="h-4 w-4" /> 5 errors</span>
            </div>
            <ul className="space-y-1 text-2xs text-muted">
              <li>Row 18 — Duplicate mobile number.</li>
              <li>Row 44 — Invalid email address.</li>
            </ul>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="md" onClick={onClose}>Download Error Report</Button>
          <Button size="md" onClick={onClose}>Import 312 Customers</Button>
        </div>
      </div>
    </div>
  );
}
