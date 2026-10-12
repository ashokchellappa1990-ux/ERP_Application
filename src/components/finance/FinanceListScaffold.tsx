"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Eye, Pencil, MoreVertical, SlidersHorizontal, Settings2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { FINANCE_LISTS, FINANCE_FEATURES, FINANCE_FORM_META, financeNotesFor, type FColumn } from "@/lib/finance/financeData";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";

const STAT_TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", accent: "bg-accent text-accent-foreground" } as const;
const STATUS_TONE = (s: string): "success" | "warning" | "danger" | "info" | "neutral" => {
  const v = s.toLowerCase();
  if (/(posted|paid|approved|active|matched|current|profit|done|reimbursed|verified|generated|return filed|in use|on track)/.test(v)) return "success";
  if (/(over budget|overdue|critical|loss|exception|rejected|expired|blocked|flagged)/.test(v)) return "danger";
  if (/(pending|due|watch|unmatched|expiring|paused|idle|soft-closed|submitted|warning|deducted|collected)/.test(v)) return "warning";
  if (/(draft|open|info|locked|audit-locked|ended)/.test(v)) return "info";
  return "neutral";
};
const inr = (n: number) => formatMoney(n);

export function FinanceListScaffold({ featureKey, parentLabel = "Finance", parentHref = "/finance", newHref }: { featureKey: keyof typeof FINANCE_LISTS; parentLabel?: string; parentHref?: string; newHref?: string }) {
  const cfg = FINANCE_LISTS[featureKey];
  const Icon = FINANCE_FEATURES.find((f) => f.key === featureKey)?.icon ?? FileText;
  const hasForm = !!FINANCE_FORM_META[featureKey];
  const addHref = newHref ?? `/finance/${featureKey}/new`;
  const editHref = newHref ?? `/finance/${featureKey}/new`;
  const notes = useMemo(() => financeNotesFor(featureKey), [featureKey]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewRow, setViewRow] = useState<Record<string, string | number> | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cfg.rows.filter((r) => (!q || Object.values(r).join(" ").toLowerCase().includes(q)) && (status === "All" || String(r.status) === status));
  }, [cfg.rows, query, status]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const paged = rows.slice((current - 1) * pageSize, current * pageSize);
  const reset = () => setPage(1);

  const cell = (r: Record<string, string | number>, c: FColumn) => {
    const v = r[c.key];
    if (c.kind === "status") return <Badge tone={STATUS_TONE(String(v))}>{String(v)}</Badge>;
    if (c.kind === "badge") return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-muted">{String(v)}</span>;
    if (c.kind === "amount") return <span className={cn("font-semibold", typeof v === "number" && v < 0 ? "text-danger" : "text-foreground")}>{typeof v === "number" ? inr(v) : v}</span>;
    if (["no", "code", "name", "customer", "supplier", "account", "bank", "branch", "asset"].includes(c.key)) return <span className="font-medium text-foreground">{String(v)}</span>;
    return <span className="text-muted">{String(v)}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href={parentHref} className="hover:text-foreground">{parentLabel}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{cfg.title}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> {cfg.title}</h1>
          <p className="mt-0.5 text-sm text-muted">{cfg.desc}</p>
        </div>
        {cfg.newLabel && <Link href={addHref}><Button size="md"><Plus className="h-4 w-4" /> {cfg.newLabel}</Button></Link>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Finance policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cfg.kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold shadow-sm", STAT_TONES[k.tone])}>{k.value.replace(/[^0-9]/g, "").slice(0, 1) || "•"}</span><p className="text-lg font-bold tracking-tight text-foreground">{k.value}</p></div>
            <p className="mt-2 text-xs font-medium text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); reset(); }} placeholder="Search…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {["All", ...cfg.statuses].map((s) => <button key={s} onClick={() => { setStatus(s); reset(); }} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", status === s ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground")}>{s}</button>)}
            <button className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary" aria-label="More filters"><SlidersHorizontal className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                {cfg.columns.map((c) => <th key={c.key} className={cn("px-4 py-3", c.align === "right" && "text-right", c.align === "center" && "text-center")}>{c.label}</th>)}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  {cfg.columns.map((c) => <td key={c.key} className={cn("px-4 py-3", c.align === "right" && "text-right", c.align === "center" && "text-center")}>{cell(r, c)}</td>)}
                  <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewRow(r)} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></button>
                    {hasForm
                      ? <Link href={editHref} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></Link>
                      : <button onClick={() => setViewRow(r)} title="View details" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Pencil className="h-4 w-4" /></button>}
                    <button title="More" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-border hover:bg-surface-2 hover:text-foreground"><MoreVertical className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={cfg.columns.length + 1} className="px-4 py-10 text-center text-sm text-muted">No records match your search.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination page={current} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="records" />
      </div>

      {viewRow && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setViewRow(null)} aria-hidden />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><Icon className="h-4 w-4" /></span>
              <div className="flex-1"><h3 className="text-sm font-bold text-foreground">{cfg.title} — Details</h3><p className="text-2xs text-muted">{String(viewRow[cfg.columns[0].key] ?? "")}</p></div>
              <button type="button" onClick={() => setViewRow(null)} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <dl className="divide-y divide-border">
                {cfg.columns.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-xs font-medium text-muted">{c.label}</dt>
                    <dd className="text-right text-sm">{c.kind === "status"
                      ? <Badge tone={STATUS_TONE(String(viewRow[c.key]))}>{String(viewRow[c.key])}</Badge>
                      : <span className={cn("font-semibold", c.kind === "amount" && typeof viewRow[c.key] === "number" && (viewRow[c.key] as number) < 0 ? "text-danger" : "text-foreground")}>{c.kind === "amount" && typeof viewRow[c.key] === "number" ? inr(viewRow[c.key] as number) : String(viewRow[c.key] ?? "—")}</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              {hasForm && <Link href={editHref}><Button variant="outline" size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
              <Button size="md" onClick={() => setViewRow(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
