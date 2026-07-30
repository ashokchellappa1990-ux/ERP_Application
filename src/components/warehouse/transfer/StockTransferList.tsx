"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Plus, Search, Eye, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { STR_STATUSES, PRIORITIES, STATUS_TONE } from "@/lib/contracts/stockTransfer";

interface Row {
  id: number; requestNo: string; requestDate: string; transferType: string | null;
  source: string; sourceWarehouse: string | null; destination: string; destinationWarehouse: string | null;
  priority: string; itemCount: number; totalRequestedQty: number; status: string; approvalStatus: string; createdByName: string | null;
}
// Uniform filter control — same height / border / surface as the search box so the
// whole filter row aligns cleanly.
const fInp = "h-10 rounded-xl border border-border-strong bg-card text-sm text-foreground focus:border-primary focus:outline-none";
const PRIO_TONE: Record<string, "danger" | "warning" | "neutral"> = { Urgent: "danger", High: "warning" };

export function StockTransferList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState({ q: "", from: "", to: "", status: "All", priority: "All" });
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v && v !== "All") p.set(k, v); });
    fetch(`/api/warehouse/transfer/request?${p.toString()}`, { cache: "no-store" })
      .then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const total = rows?.length ?? 0;
  const pending = rows?.filter((r) => r.approvalStatus === "Pending").length ?? 0;
  const drafts = rows?.filter((r) => r.status === "Draft").length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Stock Transfer Request</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ArrowLeftRight className="h-5 w-5 text-primary" /> Stock Transfer Request</h1>
          <p className="mt-0.5 text-sm text-muted">Raise an internal stock movement request from your branch to another branch or warehouse. No inventory or accounting is posted — this is the source document for Stock Transfer Dispatch.</p>
        </div>
        <Link href="/warehouse/transfer/request/new"><Button size="md"><Plus className="h-4 w-4" /> New Request</Button></Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Requests" value={String(total)} tone="primary" />
        <Kpi label="Awaiting approval" value={String(pending)} tone="warning" />
        <Kpi label="Drafts" value={String(drafts)} tone="muted" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search request no or reference…" className={cn(fInp, "w-full pl-10 pr-3")} />
        </div>
        <label className="flex items-center gap-1.5"><span className="text-2xs font-medium text-muted">From</span><input type="date" className={cn(fInp, "px-2.5")} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="flex items-center gap-1.5"><span className="text-2xs font-medium text-muted">To</span><input type="date" className={cn(fInp, "px-2.5")} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <select className={cn(fInp, "px-2.5")} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="All">All statuses</option>{STR_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className={cn(fInp, "px-2.5")} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="All">All priorities</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
        <Button size="md" variant="outline" onClick={load}>Apply</Button>
        <Button size="md" variant="ghost" onClick={() => { setF({ q: "", from: "", to: "", status: "All", priority: "All" }); setTimeout(load, 0); }}><RotateCcw className="h-4 w-4" /> Reset</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Request No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Destination</th><th className="px-4 py-3 text-center">Priority</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows && !loading && rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                  <td className="px-4 py-2.5"><Link href={`/warehouse/transfer/request/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.requestNo}</Link></td>
                  <td className="px-4 py-2.5 text-muted">{r.requestDate}</td>
                  <td className="px-4 py-2.5 text-muted">{r.transferType || "—"}</td>
                  <td className="px-4 py-2.5"><div className="font-medium text-foreground">{r.source}</div>{r.sourceWarehouse && <div className="text-2xs text-subtle">{r.sourceWarehouse}</div>}</td>
                  <td className="px-4 py-2.5"><div className="font-medium text-foreground">{r.destination}</div>{r.destinationWarehouse && <div className="text-2xs text-subtle">{r.destinationWarehouse}</div>}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={PRIO_TONE[r.priority] ?? "neutral"}>{r.priority}</Badge></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.itemCount}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{r.totalRequestedQty}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>{r.approvalStatus === "Pending" && <div className="mt-0.5 text-[10px] font-semibold text-warning">Awaiting approval</div>}</td>
                  <td className="px-4 py-2.5 text-right"><Link href={`/warehouse/transfer/request/${r.id}`} className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline"><Eye className="h-3.5 w-3.5" /> View</Link></td>
                </tr>
              ))}
              {(!rows || loading) && <tr><td colSpan={10} className="px-4 py-10"><AppLoader label="Loading requests…" size="sm" /></td></tr>}
              {rows && !loading && rows.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-muted">No transfer requests found. Click <strong>New Request</strong> to raise one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "primary" | "warning" | "muted" }) {
  const tones = { primary: "text-primary", warning: "text-warning", muted: "text-foreground" };
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><p className={cn("text-lg font-bold tabular-nums", tones[tone])}>{value}</p><p className="mt-0.5 text-2xs font-medium text-muted">{label}</p></div>;
}
