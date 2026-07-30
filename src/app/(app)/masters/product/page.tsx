"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Factory,
  Ruler,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CalendarClock,
  Sparkles,
  Plus,
  Upload,
  FolderPlus,
  TagsIcon,
  Search,
  Pencil,
  Eye,
  ChevronRight,
  Download,
  FileSpreadsheet,
  X,
  CircleAlert,
  QrCode as QrCodeIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { AppLoader } from "@/components/ui/AppLoader";
import { QrStickerModal, type QrTarget } from "@/components/masters/QrStickerModal";
import { type ProductStatus } from "@/lib/masters/productConfig";
import type { ProductRow, ProductListStats } from "@/lib/contracts/masters";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 8;

const EMPTY_STATS: ProductListStats = { total: 0, active: 0, inactive: 0, blocked: 0, lowStock: 0, nearExpiry: 0, newAdded: 0 };

const STATUS_TONE: Record<ProductStatus, "success" | "neutral" | "danger"> = {
  Active: "success",
  Inactive: "neutral",
  Blocked: "danger",
};

const FILTERS: ("All" | ProductStatus)[] = ["All", "Active", "Inactive", "Blocked"];

export default function ProductMasterPage() {
  const fmt = useFmt();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | ProductStatus>("All");
  const [importOpen, setImportOpen] = useState(false);
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ProductListStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Fetch from the API on search / filter / page change (debounced).
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, status: filter, page: String(page), pageSize: String(PAGE_SIZE) });
        const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) {
          setNotAuthed(true);
        } else {
          const j = await res.json().catch(() => ({}));
          if (j.ok) {
            setNotAuthed(false);
            setRows(j.rows);
            setTotal(j.total);
            setStats(j.stats);
          }
        }
      } catch {
        /* ignore aborted / network errors */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, filter, page]);

  const activePct = stats.total ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <span>Masters</span>
            <span className="text-subtle">/</span>
            <span className="font-medium text-foreground">Products</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Product Master
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Manage your full product catalog across all stores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="md" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Link href="/masters/product/new">
            <Button size="md">
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <ProductStat icon={Boxes} label="Total Products" value={stats.total.toLocaleString()} sub="across all stores" tone="primary" />
        <ProductStat icon={CheckCircle2} label="Active" value={stats.active.toLocaleString()} sub={`${activePct}% of catalog`} tone="success" />
        <ProductStat icon={XCircle} label="Inactive" value={String(stats.inactive)} sub="hidden from sale" tone="secondary" />
        <ProductStat icon={AlertTriangle} label="Low Stock" value={String(stats.lowStock)} sub="need reorder" tone="warning" />
        <ProductStat icon={CalendarClock} label="Near Expiry" value={String(stats.nearExpiry)} sub="batch-tracked" tone="danger" />
        <ProductStat icon={Sparkles} label="New (30d)" value={String(stats.newAdded)} sub="added this month" tone="accent" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <QuickAction icon={Plus} label="Add Product" href="/masters/product/new" gradient />
        <QuickAction icon={FolderPlus} label="Create Category" href="/masters/category/new" tone="primary" />
        <QuickAction icon={Boxes} label="Create Group" href="/masters/group/new" tone="accent" />
        <QuickAction icon={TagsIcon} label="Create Brand" href="/masters/brand/new" tone="success" />
        <QuickAction icon={Factory} label="Create Manufacturer" href="/masters/manufacturer/new" tone="secondary" />
        <QuickAction icon={Ruler} label="Create UOM" href="/masters/uom/new" tone="info" />
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search any column — name, code, category, brand, GST…"
              className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setPage(1);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  filter === f
                    ? "bg-brand-gradient text-white shadow-sm"
                    : "border border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3 text-right">MRP</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-center">GST</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const low = p.reorder > 0 && p.stock <= p.reorder;
                const hasVariants = p.variantCount > 0;
                const isExp = expanded.has(p.id);
                return (
                  <Fragment key={p.id}>
                  <tr className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasVariants ? (
                          <button onClick={() => toggleExpand(p.id)} className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Toggle variants">
                            <ChevronRight className={cn("h-4 w-4 transition-transform", isExp && "rotate-90")} />
                          </button>
                        ) : (
                          <span className="w-6 shrink-0" />
                        )}
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-gradient text-xs font-bold text-white shadow-sm">
                          {p.name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/masters/product/${p.id}/view`} className="truncate font-semibold text-foreground hover:text-primary hover:underline">{p.name}</Link>
                            {hasVariants && <Badge tone="primary">{p.variantCount} sizes</Badge>}
                          </div>
                          <div className="text-2xs text-subtle">{p.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.category}</td>
                    <td className="px-4 py-3 text-muted">{p.brand}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                        {p.uom}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{fmt.money(p.mrp)}</td>
                    <td className="px-4 py-3 text-right">
                      {hasVariants ? (
                        <span className="text-2xs font-medium text-subtle">{fmt.qty(p.variants.reduce((s, v) => s + v.stock, 0))} total</span>
                      ) : low ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-bold text-danger">
                          <AlertTriangle className="h-3 w-3" />
                          {fmt.qty(p.stock)}
                        </span>
                      ) : (
                        <span className="font-semibold text-foreground">{fmt.qty(p.stock)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-md bg-info-subtle px-2 py-0.5 text-xs font-semibold text-info">
                        {p.gst}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/masters/product/${p.id}/view`}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        <Link
                          href={`/masters/product/${p.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-primary-subtle px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setQrTarget({ name: p.name, code: p.code, sku: p.variantCount > 0 ? p.code : p.code, barcode: "", mrp: p.mrp, stock: p.stock })}
                          title="Generate QR sticker"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                        >
                          <QrCodeIcon className="h-3.5 w-3.5" />
                          QR
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExp && p.variants.map((v) => (
                    <tr key={`v-${v.id}`} className="border-b border-border bg-surface-2/40 text-xs last:border-0">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 pl-12">
                          <span className="text-subtle">↳</span>
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{v.name.replace(`${p.name} - `, "") || v.name}</span>
                            <div className="font-mono text-2xs text-subtle">SKU {v.sku} · {v.barcode}</div>
                          </div>
                        </div>
                      </td>
                      <td colSpan={3} className="px-4 py-2" />
                      <td className="px-4 py-2 text-right font-semibold text-foreground">{fmt.money(v.mrp)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-foreground">{fmt.qty(v.stock)}</td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 text-center"><Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge></td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setQrTarget({ name: v.name, code: v.code, sku: v.sku, barcode: v.barcode, mrp: v.mrp, stock: v.stock })}
                            title="Generate QR sticker"
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary"
                          >
                            <QrCodeIcon className="h-3 w-3" /> QR
                          </button>
                          <Link href={`/masters/product/${v.id}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary">
                            <Pencil className="h-3 w-3" /> Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  </Fragment>
                );
              })}
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6">
                    <AppLoader label="Loading products…" size="sm" />
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && notAuthed && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">
                    Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link> to view products.
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && !notAuthed && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">
                    No products yet. Click <Link href="/masters/product/new" className="font-semibold text-primary hover:underline">Add Product</Link> to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          label="products"
        />
      </div>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      {qrTarget && <QrStickerModal target={qrTarget} onClose={() => setQrTarget(null)} />}
    </div>
  );
}

const QA_TONES = {
  primary: { card: "border-primary/30 bg-primary-subtle", icon: "bg-primary text-white" },
  secondary: { card: "border-secondary/30 bg-secondary-subtle", icon: "bg-secondary text-white" },
  accent: { card: "border-accent/40 bg-accent/15", icon: "bg-accent text-accent-foreground" },
  success: { card: "border-success/30 bg-success-subtle", icon: "bg-success text-white" },
  info: { card: "border-info/30 bg-info-subtle", icon: "bg-info text-white" },
  warning: { card: "border-warning/40 bg-warning-subtle", icon: "bg-warning text-white" },
} as const;

function QuickAction({
  icon: Icon,
  label,
  href,
  onClick,
  gradient,
  tone = "primary",
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  gradient?: boolean;
  tone?: keyof typeof QA_TONES;
}) {
  const t = QA_TONES[tone];
  const inner = (
    <div
      className={cn(
        "flex h-full flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition hover:-translate-y-0.5",
        gradient
          ? "border-transparent bg-brand-gradient text-white shadow-sm hover:shadow-md"
          : cn(t.card, "hover:shadow-sm")
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-sm",
          gradient ? "bg-white/20 text-white" : t.icon
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className={cn("text-xs font-semibold leading-tight", gradient ? "text-white" : "text-foreground")}>
        {label}
      </span>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="h-full w-full text-left">
      {inner}
    </button>
  );
}

/* --------------------------------------------------------- stat widget - */

const STAT_TONES = {
  primary: { chip: "bg-primary text-white", sub: "text-primary" },
  success: { chip: "bg-success text-white", sub: "text-success" },
  secondary: { chip: "bg-secondary text-white", sub: "text-secondary" },
  warning: { chip: "bg-warning text-white", sub: "text-warning" },
  danger: { chip: "bg-danger text-white", sub: "text-danger" },
  accent: { chip: "bg-accent text-accent-foreground", sub: "text-accent-foreground" },
} as const;

function ProductStat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof STAT_TONES;
}) {
  const t = STAT_TONES[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm", t.chip)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
      </div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-0.5 text-2xs font-semibold", t.sub)}>{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------ import --- */

function ImportModal({ onClose }: { onClose: () => void }) {
  const templates = ["Product Master", "Product Pricing", "Opening Stock", "Barcode Data"];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm">
      <div className="animate-fade-in flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white">
              <Upload className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Import Products</p>
              <p className="text-2xs text-muted">Excel or CSV — bulk add & update</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            1. Download a template
          </p>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t) => (
              <button
                key={t}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-xs font-medium text-foreground transition hover:border-primary hover:bg-surface-2"
              >
                <Download className="h-4 w-4 shrink-0 text-primary" />
                {t}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">
            2. Upload your file
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-subtle/30">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Drag &amp; drop or click to upload
            </span>
            <span className="text-2xs text-subtle">.xlsx or .csv — up to 10,000 rows</span>
            <input type="file" className="hidden" accept=".xlsx,.csv" />
          </label>

          {/* Sample validation report */}
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">
            3. Validation report
          </p>
          <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-success">
                <CheckCircle2 className="h-4 w-4" /> 117 rows valid
              </span>
              <span className="inline-flex items-center gap-1.5 text-danger">
                <CircleAlert className="h-4 w-4" /> 3 errors
              </span>
            </div>
            <ul className="space-y-1 text-2xs text-muted">
              <li>Row 14 — Duplicate product code “PRD-1001”.</li>
              <li>Row 39 — Invalid HSN code “12”.</li>
              <li>Row 52 — Duplicate barcode “8901234567890”.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="md" onClick={onClose}>
            Download Error Report
          </Button>
          <Button size="md" onClick={onClose}>
            Import 117 Products
          </Button>
        </div>
      </div>
    </div>
  );
}
