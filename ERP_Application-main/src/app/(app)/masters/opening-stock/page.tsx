"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  IndianRupee,
  Search,
  Eye,
  Pencil,
  Trash2,
  FileText,
  FileBarChart,
  ArrowRight,
  Download,
  Upload,
  CheckCircle2,
  FileStack,
  Send,
  PencilRuler,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { REPORTS } from "@/lib/masters/openingStockConfig";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { TerminalFilter } from "@/components/pos/TerminalFilter";
import { cn } from "@/lib/cn";
import type { OpeningStockRow as DocRow, OpeningStockListStats as Stats } from "@/lib/contracts/openingStock";

const EMPTY_STATS: Stats = { total: 0, draft: 0, submitted: 0, totalValue: 0, totalQty: 0 };

const STATUS_TONE: Record<DocRow["status"], "success" | "warning"> = { Submitted: "success", Draft: "warning" };
const FILTERS: ("All" | DocRow["status"])[] = ["All", "Draft", "Submitted"];

const TEMPLATE_COLUMNS = ["Product Code", "Product Name", "Quantity", "UOM", "MRP", "Purchase Price", "Batch Number", "Mfg Date", "Expiry Date", "Supplier"];
const TEMPLATE_SAMPLE = ["SKU-100245", "Surf Excel 1kg", "120", "PCS", "110.00", "82.50", "BATCH-AX2310", "2026-01-15", "2027-01-14", "HUL Distributors"];
function downloadTemplate() {
  const esc = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
  const csv = [TEMPLATE_COLUMNS, TEMPLATE_SAMPLE].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "opening-stock-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function OpeningStockPage() {
  const fmt = useFmt();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | DocRow["status"]>("All");
  const [terminalId, setTerminalId] = useState("");
  const [rows, setRows] = useState<DocRow[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, status: filter });
        if (terminalId) params.set("terminalId", terminalId);
        const res = await fetch(`/api/inventory/opening-stock?${params}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, filter, terminalId, reloadKey]);

  async function remove(id: number) {
    if (!window.confirm("Delete this opening stock document? Submitted quantities will be reversed.")) return;
    await fetch(`/api/inventory/opening-stock/${id}`, { method: "DELETE" });
    setReloadKey((k) => k + 1);
  }

  const fmtMoney = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  const filtered = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Masters</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Opening Stock Setup</span></div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Opening Stock Setup</h1>
          <p className="mt-0.5 text-sm text-muted">Initialize inventory for ERP migration &amp; Go-Live — search products, enter quantity, rate &amp; batch, then submit.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="md" onClick={downloadTemplate}><Download className="h-4 w-4" /> Excel Template</Button>
          <Button variant="outline" size="md" onClick={() => uploadRef.current?.click()}><Upload className="h-4 w-4" /> Import</Button>
          <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setUploadedFile(e.target.files?.[0]?.name ?? null)} />
          <Link href="/masters/opening-stock/bulk"><Button size="md"><Boxes className="h-4 w-4" /> Quick Stock Entry</Button></Link>
        </div>
      </div>

      {uploadedFile && (
        <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> <strong>{uploadedFile}</strong> uploaded — open the editor to map columns &amp; verify before import.</span>
          <div className="flex items-center gap-2">
            <Link href="/masters/opening-stock/bulk"><Button size="sm">Open Editor</Button></Link>
            <button type="button" onClick={() => { setUploadedFile(null); if (uploadRef.current) uploadRef.current.value = ""; }} className="grid h-7 w-7 place-items-center rounded text-muted transition hover:text-danger" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat icon={FileStack} label="Documents" value={String(stats.total)} tone="primary" />
        <Stat icon={PencilRuler} label="Drafts" value={String(stats.draft)} tone="warning" />
        <Stat icon={Send} label="Submitted" value={String(stats.submitted)} tone="success" />
        <Stat icon={Boxes} label="Quantity Loaded" value={fmt.qty(stats.totalQty)} tone="secondary" />
        <Stat icon={IndianRupee} label="Stock Value" value={fmtMoney(stats.totalValue)} tone="accent" />
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search document no or warehouse…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <TerminalFilter value={terminalId} onChange={setTerminalId} />
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", filter === f ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground")}>{f}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Application Reference No</th><th className="px-4 py-3">As-on / Warehouse</th><th className="px-4 py-3 text-center">Lines</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-sm"><FileText className="h-4 w-4" /></span>
                      <div className="min-w-0"><div className="truncate font-semibold text-foreground">{d.docNo}</div><div className="text-2xs text-subtle">{d.lineCount} item{d.lineCount === 1 ? "" : "s"}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><div className="text-foreground">{d.asOnDate}</div><div className="text-2xs text-subtle">{d.warehouse || "—"}</div></td>
                  <td className="px-4 py-3 text-center font-medium text-foreground">{d.lineCount}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{fmt.qty(d.totalQty)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{fmtMoney(d.totalValue)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/masters/opening-stock/${d.id}`} title="View & QR labels" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                      <Link href={`/masters/opening-stock/bulk?id=${d.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></Link>
                      <button onClick={() => remove(d.id)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading documents…" size="sm" /></td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  {notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No opening stock yet. Click <Link href="/masters/opening-stock/bulk" className="font-semibold text-primary hover:underline">Quick Stock Entry</Link> to begin.</>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reports */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><FileBarChart className="h-4 w-4 text-primary" /> Opening Stock Reports</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {REPORTS.map((r) => (
            <button key={r.id} className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary transition group-hover:bg-brand-gradient group-hover:text-white"><FileBarChart className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{r.name}</p><p className="text-2xs text-muted">{r.desc}</p></div>
              <ArrowRight className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const STAT_TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", accent: "bg-accent text-accent-foreground" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: keyof typeof STAT_TONES }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm", STAT_TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}
