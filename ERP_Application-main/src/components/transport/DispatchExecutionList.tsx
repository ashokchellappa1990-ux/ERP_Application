"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageCheck, Search, Eye, FileStack, Package, Send, X, FileText, ShoppingCart, ArrowLeftRight, ClipboardEdit } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { DirectDispatchEditor } from "@/components/transport/DirectDispatchEditor";
import type { DispatchExecutionRow as Row } from "@/lib/contracts/transport";

interface Stats { total: number; draft: number; vehicleAssigned: number; completed: number }
const EMPTY: Stats = { total: 0, draft: 0, vehicleAssigned: 0, completed: 0 };
const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info" | "primary"> = {
  Draft: "neutral", "Vehicle Assigned": "primary", "Gate In": "info", Loading: "warning", Loaded: "warning", "Gate Out": "info", Completed: "success", Cancelled: "danger",
};
const FILTERS = ["All", "Draft", "Vehicle Assigned", "Gate In", "Loading", "Loaded", "Gate Out", "Completed", "Cancelled"] as const;
const DOC_TYPES = ["All", "Customer", "StockTransfer", "PurchaseReturn", "SalesReturn", "ProductionTransfer", "JobWork", "VendorDispatch", "Others"] as const;

interface SalesOrderHit { id: number; docNo: string; customerName: string; itemCount: number; netAmount: number }
interface StdHit { id: number; dispatchNo: string; source?: string; destination?: string; totalDispatchQty: number; totalValue: number }

export function DispatchExecutionList() {
  const router = useRouter();
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("All");
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]>("All");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  const [dialog, setDialog] = useState<null | "so" | "direct" | "std">(null);
  const [soQ, setSoQ] = useState(""); const [soHits, setSoHits] = useState<SalesOrderHit[] | null>(null); const [soBusy, setSoBusy] = useState(false);
  const [stdHits, setStdHits] = useState<StdHit[] | null>(null); const [stdBusy, setStdBusy] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const u = new URLSearchParams();
        if (status !== "All") u.set("status", status);
        if (docType !== "All") u.set("docType", docType);
        if (query.trim()) u.set("q", query.trim());
        const res = await fetch(`/api/transport/dispatch-execution?${u}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, status, docType]);

  async function searchSalesOrders(q: string) {
    setSoBusy(true);
    try { const j = await fetch(`/api/sales/order/lookup?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setSoHits(j.rows ?? []); }
    catch { toast.error("Could not search sales orders."); }
    finally { setSoBusy(false); }
  }
  async function pickSalesOrder(so: SalesOrderHit) {
    setSoBusy(true);
    try {
      const j = await fetch("/api/transport/dispatch-execution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docType: "Customer", salesOrderId: so.id, docDate: new Date().toISOString().slice(0, 10) }) }).then((r) => r.json());
      if (j.ok) { toast.success(j.message || "Dispatch execution created."); router.push(`/transport/dispatch-execution/${j.id}`); }
      else toast.error(j.message || "Could not load this Sales Order.");
    } finally { setSoBusy(false); }
  }

  async function loadDraftStockTransfers() {
    setStdBusy(true);
    try { const j = await fetch("/api/warehouse/dispatch?status=Draft", { cache: "no-store" }).then((r) => r.json()); if (j.ok) setStdHits(j.rows ?? []); }
    catch { toast.error("Could not load Stock Transfer Dispatches."); }
    finally { setStdBusy(false); }
  }
  async function pickStockTransfer(std: StdHit) {
    setStdBusy(true);
    try {
      const j = await fetch("/api/transport/dispatch-execution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docType: "StockTransfer", stockTransferDispatchId: std.id, docDate: new Date().toISOString().slice(0, 10) }) }).then((r) => r.json());
      if (j.ok) { toast.success(j.message || "Dispatch execution created."); router.push(`/transport/dispatch-execution/${j.id}`); }
      else toast.error(j.message || "Could not load this Stock Transfer Dispatch.");
    } finally { setStdBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Dispatch Execution</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageCheck className="h-5 w-5 text-primary" /> Dispatch Execution</h1>
          <p className="mt-0.5 text-sm text-muted">Load a Customer or Stock Transfer dispatch and carry it through gate / weighment / loading to completion.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="md" onClick={() => { setDialog("so"); setSoQ(""); setSoHits(null); searchSalesOrders(""); }}><ShoppingCart className="h-4 w-4" /> From Sales Order</Button>
          <Button size="md" variant="outline" onClick={() => setDialog("direct")}><ClipboardEdit className="h-4 w-4" /> Direct Customer Dispatch</Button>
          <Button size="md" variant="outline" onClick={() => { setDialog("std"); loadDraftStockTransfers(); }}><ArrowLeftRight className="h-4 w-4" /> From Stock Transfer</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileStack} label="Total" value={String(stats.total)} tone="primary" />
        <Stat icon={Package} label="Draft" value={String(stats.draft)} tone="neutral" />
        <Stat icon={Send} label="Vehicle Assigned" value={String(stats.vehicleAssigned)} tone="info" />
        <Stat icon={PackageCheck} label="Completed" value={String(stats.completed)} tone="success" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search doc no, party or source ref…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={docType} onChange={(e) => setDocType(e.target.value as (typeof DOC_TYPES)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
              {DOC_TYPES.map((f) => <option key={f} value={f}>{f === "All" ? "All types" : f}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as (typeof FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
              {FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : f}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Doc No</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Party / Source</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><Link href={`/transport/dispatch-execution/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.docNo}</Link><div className="mt-0.5"><Badge tone="neutral">{r.docType}</Badge></div></td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.docDate || "—"}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.partyName || r.sourceRefNo || "—"}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.warehouse || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt.qty(r.totalQty)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{inr(r.totalValue)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center justify-end">
                    <Link href={`/transport/dispatch-execution/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                  </div></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8"><AppLoader label="Loading dispatch executions…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : "No dispatch executions yet. Use one of the buttons above to create one."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {dialog === "so" && (
        <Modal title="New Dispatch — From Sales Order" icon={ShoppingCart} onClose={() => setDialog(null)}>
          <input value={soQ} onChange={(e) => setSoQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchSalesOrders(soQ); }} placeholder="Search sales order no / customer…" className="mb-3 h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none" autoFocus />
          {soBusy && <AppLoader label="Loading…" size="sm" />}
          {!soBusy && soHits && (soHits.length ? (
            <div className="max-h-72 space-y-1.5 overflow-auto">
              {soHits.map((so) => (
                <button key={so.id} onClick={() => pickSalesOrder(so)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-primary-subtle/30">
                  <span><span className="block font-semibold text-foreground">{so.docNo}</span><span className="block text-2xs text-subtle">{so.customerName || "—"} · {so.itemCount} item(s)</span></span>
                  <span className="font-semibold text-foreground">{inr(so.netAmount)}</span>
                </button>
              ))}
            </div>
          ) : <p className="py-6 text-center text-sm text-muted">No billable sales orders matched.</p>)}
        </Modal>
      )}

      {dialog === "direct" && <DirectDispatchEditor onClose={() => setDialog(null)} onCreated={(id) => router.push(`/transport/dispatch-execution/${id}`)} />}

      {dialog === "std" && (
        <Modal title="New Dispatch — From Stock Transfer" icon={ArrowLeftRight} onClose={() => setDialog(null)}>
          {stdBusy && <AppLoader label="Loading…" size="sm" />}
          {!stdBusy && stdHits && (stdHits.length ? (
            <div className="max-h-72 space-y-1.5 overflow-auto">
              {stdHits.map((std) => (
                <button key={std.id} onClick={() => pickStockTransfer(std)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-primary-subtle/30">
                  <span><span className="block font-semibold text-foreground">{std.dispatchNo}</span><span className="block text-2xs text-subtle">{std.source || "—"} → {std.destination || "—"}</span></span>
                  <span className="font-semibold text-foreground">{inr(std.totalValue)}</span>
                </button>
              ))}
            </div>
          ) : <p className="py-6 text-center text-sm text-muted">No Draft Stock Transfer Dispatches found.</p>)}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, icon: Icon, onClose, children }: { title: string; icon: typeof FileText; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-fade-in flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</div>
          <button onClick={onClose} className="text-subtle hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", info: "bg-info text-white", neutral: "bg-surface-2 text-muted" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof FileStack; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
