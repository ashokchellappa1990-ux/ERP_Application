"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Truck, Search, Plus, Eye, Pencil, Trash2, FileText, FileStack, Send, PencilRuler, IndianRupee, Boxes, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { TerminalFilter } from "@/components/pos/TerminalFilter";
import { cn } from "@/lib/cn";
// Shared API contract — one source of truth for the GRN list shapes.
import type { GrnRow, GrnListStats as Stats } from "@/lib/contracts/grn";

const EMPTY: Stats = { total: 0, draft: 0, posted: 0, totalValue: 0, totalQty: 0 };
const TONE: Record<GrnRow["status"], "success" | "warning" | "danger"> = { Posted: "success", Draft: "warning", Cancelled: "danger" };
const FILTERS: ("All" | GrnRow["status"])[] = ["All", "Draft", "Posted", "Cancelled"];

export default function GrnListPage() {
  const fmt = useFmt();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | GrnRow["status"]>("All");
  const [terminalId, setTerminalId] = useState("");
  const [rows, setRows] = useState<GrnRow[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, status: filter });
        if (terminalId) params.set("terminalId", terminalId);
        const res = await fetch(`/api/purchase/grn?${params}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, filter, terminalId, reloadKey]);

  async function remove(id: number) {
    if (!window.confirm("Delete this draft GRN?")) return;
    try {
      const j = await fetch(`/api/purchase/grn/${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
      toast.result(j, "GRN deleted.", "Could not delete the GRN.");
    } catch { toast.error("Could not reach the server. Please try again."); }
    setReloadKey((k) => k + 1);
  }
  async function cancel(id: number) {
    if (!window.confirm("Cancel this GRN? Its received stock and any payable will be reversed. The record is kept with status Cancelled.")) return;
    try {
      const j = await fetch(`/api/purchase/grn/${id}/cancel`, { method: "POST" }).then((r) => r.json()).catch(() => ({}));
      if (!j.ok && j.message) window.alert(j.message);
      toast.result(j, "GRN cancelled. Stock and payable reversed.", "Could not cancel the GRN.");
    } catch { toast.error("Could not reach the server. Please try again."); }
    setReloadKey((k) => k + 1);
  }
  const compact = (n: number) => (n >= 100000 ? `${fmt.money(n / 100000)}L` : fmt.money(n));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Purchase</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Goods Receipt Note</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> Goods Receipt Note</h1>
          <p className="mt-0.5 text-sm text-muted">Receive stock against suppliers — posting generates QR labels &amp; updates inventory.</p>
        </div>
        <Link href="/purchase/grn/new"><Button size="md"><Plus className="h-4 w-4" /> New GRN</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
        <Stat icon={FileStack} label="Total GRNs" value={String(stats.total)} tone="primary" />
        <Stat icon={PencilRuler} label="Drafts" value={String(stats.draft)} tone="warning" />
        <Stat icon={Send} label="Posted" value={String(stats.posted)} tone="success" />
        <Stat icon={Boxes} label="Qty Received" value={fmt.qty(stats.totalQty)} tone="secondary" />
        <Stat icon={IndianRupee} label="Receipt Value" value={compact(stats.totalValue)} tone="accent" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search GRN, supplier, PO or invoice…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <div className="flex items-center gap-1.5"><TerminalFilter value={terminalId} onChange={setTerminalId} />{FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", filter === f ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground")}>{f}</button>)}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">GRN No</th><th className="px-4 py-3">Date / Supplier</th><th className="px-4 py-3 text-center">Lines</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-sm"><FileText className="h-4 w-4" /></span><div className="min-w-0"><div className="truncate font-semibold text-foreground">{d.grnNo}</div><div className="text-2xs text-subtle">{d.poNo ? `PO ${d.poNo}` : d.warehouse || "—"}</div></div></div></td>
                  <td className="px-4 py-3"><div className="text-foreground">{d.grnDate}</div><div className="text-2xs text-subtle">{d.supplier || "—"}</div></td>
                  <td className="px-4 py-3 text-center font-medium text-foreground">{d.lineCount}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{fmt.qty(d.totalQty)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{compact(d.totalValue)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={TONE[d.status]}>{d.status}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                    <Link href={`/purchase/grn/${d.id}`} title="View & QR labels" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                    {d.status !== "Cancelled" && <Link href={`/purchase/grn/new?id=${d.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></Link>}
                    {d.status === "Draft" && <button onClick={() => remove(d.id)} title="Delete draft" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>}
                    {d.status === "Posted" && <button onClick={() => cancel(d.id)} title="Cancel GRN" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger"><XCircle className="h-4 w-4" /></button>}
                  </div></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading GRNs…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No GRNs yet. Click <Link href="/purchase/grn/new" className="font-semibold text-primary hover:underline">New GRN</Link> to receive stock.</>}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", secondary: "bg-secondary text-white", success: "bg-success text-white", warning: "bg-warning text-white", accent: "bg-accent text-accent-foreground" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
