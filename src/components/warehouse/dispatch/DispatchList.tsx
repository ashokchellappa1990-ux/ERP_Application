"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, Search, Eye, Printer, RotateCcw, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { DISPATCH_STATUSES, DISPATCH_STATUS_TONE, DISPATCH_TYPES } from "@/lib/contracts/stockDispatch";

interface Row { id: number; dispatchNo: string; dispatchDate: string; dispatchType: string; referenceNo: string | null; source: string; destination: string; priority: string; totalItems: number; totalDispatchQty: number; totalValue: number; status: string; challanNo: string | null; createdByName: string | null; createdAt: string }
const fInp = "h-10 rounded-xl border border-border-strong bg-card text-sm text-foreground focus:border-primary focus:outline-none";
const PRIO_TONE: Record<string, "danger" | "warning" | "neutral"> = { Urgent: "danger", High: "warning" };

export function DispatchList({ mode, embedded }: { mode: "active" | "history"; embedded?: boolean }) {
  const router = useRouter();
  const isHistory = mode === "history";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState({ q: "", from: "", to: "", status: "All", type: "All" });

  const load = () => {
    setRows(null);
    const p = new URLSearchParams();
    if (isHistory) p.set("history", "1");
    Object.entries(f).forEach(([k, v]) => { if (v && v !== "All") p.set(k, v); });
    fetch(`/api/warehouse/dispatch?${p.toString()}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : []));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">{isHistory ? "Dispatch History" : "Stock Transfer Dispatch"}</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> {isHistory ? "Dispatch History" : "Stock Transfer Dispatch"}</h1>
          </div>
          {!isHistory && <Link href="/warehouse/transfer/dispatch/new"><Button size="md"><Plus className="h-4 w-4" /> New Dispatch</Button></Link>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Dispatch / reference / challan no…" className={cn(fInp, "w-full pl-10 pr-3")} />
        </div>
        <label className="flex items-center gap-1.5"><span className="text-2xs font-medium text-muted">From</span><input type="date" className={cn(fInp, "px-2.5")} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="flex items-center gap-1.5"><span className="text-2xs font-medium text-muted">To</span><input type="date" className={cn(fInp, "px-2.5")} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <select className={cn(fInp, "px-2.5")} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="All">All types</option>{DISPATCH_TYPES.slice(0, 2).map((t) => <option key={t}>{t}</option>)}</select>
        {!isHistory && <select className={cn(fInp, "px-2.5")} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="All">All statuses</option>{DISPATCH_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>}
        <Button size="md" variant="outline" onClick={load}>Apply</Button>
        <Button size="md" variant="ghost" onClick={() => { setF({ q: "", from: "", to: "", status: "All", type: "All" }); setTimeout(load, 0); }}><RotateCcw className="h-4 w-4" /> Reset</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Dispatch No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows && rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                  <td className="px-4 py-2.5"><Link href={`/warehouse/transfer/dispatch/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.dispatchNo}</Link>{r.challanNo && <div className="text-[10px] text-subtle">DC {r.challanNo}</div>}</td>
                  <td className="px-4 py-2.5 text-muted">{r.dispatchDate}</td>
                  <td className="px-4 py-2.5 text-2xs text-muted">{r.dispatchType.replace(" Based", "").replace(" Dispatch", "")}</td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-muted">{r.referenceNo || "—"}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.source}</td>
                  <td className="px-4 py-2.5 text-muted">{r.destination}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.totalItems}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{r.totalDispatchQty}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.totalValue ? r.totalValue.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={DISPATCH_STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/warehouse/transfer/dispatch/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><Eye className="h-4 w-4" /></Link>
                      <button onClick={() => router.push(`/warehouse/transfer/dispatch/${r.id}?print=1`)} title="Print" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><Printer className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows && <tr><td colSpan={11} className="px-4 py-10"><AppLoader label="Loading dispatches…" size="sm" /></td></tr>}
              {rows && rows.length === 0 && <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-muted">{isHistory ? "No dispatch history yet." : "No dispatches yet. Click New Dispatch to create one."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
