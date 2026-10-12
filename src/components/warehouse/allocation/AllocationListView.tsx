"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageCheck, Search, Eye, Pencil, Printer, Undo2, RotateCcw, History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { ALLOC_STATUSES, ALLOC_STATUS_TONE, isAllocationEditable } from "@/lib/contracts/stockAllocation";

interface Row { id: number; allocationNo: string; allocationDate: string; requestNo: string; source: string; destination: string; priority: string; totalItems: number; totalRequestedQty: number; totalAllocatedQty: number; status: string; allocatedByName: string | null; createdAt: string }
const PRIO_TONE: Record<string, "danger" | "warning" | "neutral"> = { Urgent: "danger", High: "warning" };
const fInp = "h-10 rounded-xl border border-border-strong bg-card text-sm text-foreground focus:border-primary focus:outline-none";

export function AllocationListView({ mode, embedded, onGoPending }: { mode: "active" | "history"; embedded?: boolean; onGoPending?: () => void }) {
  const router = useRouter();
  const isHistory = mode === "history";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState({ q: "", from: "", to: "", status: "All" });
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");

  const load = () => {
    setRows(null);
    const p = new URLSearchParams();
    if (isHistory) p.set("history", "1");
    Object.entries(f).forEach(([k, v]) => { if (v && v !== "All") p.set(k, v); });
    fetch(`/api/warehouse/allocation?${p.toString()}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : []));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function release(id: number) {
    if (!window.confirm("Release this allocation and free the reserved stock?")) return;
    setBusy(id); setErr("");
    const j = await fetch(`/api/warehouse/allocation/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "release" }) }).then((r) => r.json());
    setBusy(0);
    if (!j.ok) { setErr(j.message || "Release failed."); return; }
    load();
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">{isHistory ? "Allocation History" : "Stock Allocation"}</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">{isHistory ? <History className="h-5 w-5 text-primary" /> : <PackageCheck className="h-5 w-5 text-primary" />} {isHistory ? "Allocation History" : "Stock Allocation"}</h1>
            <p className="mt-0.5 text-sm text-muted">{isHistory ? "Released and cancelled allocations." : "Inventory reservations against approved transfer requests. Reservation only — no stock movement, ledger or accounting is posted."}</p>
          </div>
          {!isHistory && <Link href="/warehouse/transfer/allocation/pending"><Button size="md"><PackageCheck className="h-4 w-4" /> New Allocation</Button></Link>}
        </div>
      )}
      {embedded && !isHistory && onGoPending && (
        <div className="flex justify-end"><Button size="md" onClick={onGoPending}><PackageCheck className="h-4 w-4" /> New Allocation</Button></div>
      )}

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{err}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Allocation / request no…" className={cn(fInp, "w-full pl-10 pr-3")} />
        </div>
        <label className="flex items-center gap-1.5"><span className="text-2xs font-medium text-muted">From</span><input type="date" className={cn(fInp, "px-2.5")} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="flex items-center gap-1.5"><span className="text-2xs font-medium text-muted">To</span><input type="date" className={cn(fInp, "px-2.5")} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        {!isHistory && <select className={cn(fInp, "px-2.5")} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="All">All statuses</option>{ALLOC_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>}
        <Button size="md" variant="outline" onClick={load}>Apply</Button>
        <Button size="md" variant="ghost" onClick={() => { setF({ q: "", from: "", to: "", status: "All" }); setTimeout(load, 0); }}><RotateCcw className="h-4 w-4" /> Reset</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Allocation No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Request No.</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Destination</th><th className="px-4 py-3 text-center">Priority</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-right">Allocated</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3">Allocated By</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows && rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                  <td className="px-4 py-2.5"><Link href={`/warehouse/transfer/allocation/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.allocationNo}</Link></td>
                  <td className="px-4 py-2.5 text-muted">{r.allocationDate}</td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-muted">{r.requestNo}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.source}</td>
                  <td className="px-4 py-2.5 text-muted">{r.destination}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={PRIO_TONE[r.priority] ?? "neutral"}>{r.priority}</Badge></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.totalItems}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{r.totalAllocatedQty}<span className="text-2xs font-normal text-subtle"> / {r.totalRequestedQty}</span></td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={ALLOC_STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-4 py-2.5 text-muted">{r.allocatedByName || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/warehouse/transfer/allocation/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><Eye className="h-4 w-4" /></Link>
                      {!isHistory && isAllocationEditable(r.status) && <Link href={`/warehouse/transfer/allocation/${r.id}/edit`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><Pencil className="h-4 w-4" /></Link>}
                      <button onClick={() => router.push(`/warehouse/transfer/allocation/${r.id}?print=1`)} title="Print" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><Printer className="h-4 w-4" /></button>
                      {!isHistory && (r.status === "Allocated" || r.status === "Partially Allocated") && <button onClick={() => release(r.id)} disabled={busy === r.id} title="Release" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger"><Undo2 className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows && <tr><td colSpan={11} className="px-4 py-10"><AppLoader label="Loading allocations…" size="sm" /></td></tr>}
              {rows && rows.length === 0 && <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-muted">{isHistory ? "No released or cancelled allocations yet." : "No allocations yet. Start one from Pending Allocation."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
