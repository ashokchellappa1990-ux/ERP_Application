"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, CalendarClock, Hash, Search, ScanSearch, X, Boxes, AlertTriangle, PackageCheck, Loader2, History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { BatchTrackRow, ExpiryTrackRow, SerialTrackRow, SerialHistoryResponse, TrackingStats } from "@/lib/contracts/inventoryTracking";

type TabId = "batch" | "expiry" | "serial";
const TABS: { id: TabId; label: string; icon: typeof Layers }[] = [
  { id: "batch", label: "Batch Management", icon: Layers },
  { id: "expiry", label: "Expiry Management", icon: CalendarClock },
  { id: "serial", label: "Serial Numbers", icon: Hash },
];
const EXP_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { Normal: "success", "Near Expiry": "warning", Expired: "danger" };
const SERIAL_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = { Available: "success", Sold: "info", Returned: "warning", Quarantine: "warning", Damaged: "danger", Lost: "danger", Scrapped: "danger", Transferred: "neutral", ReturnedToSupplier: "neutral" };

export function InventoryTrackingConsole() {
  const fmt = useFmt();
  const [tab, setTab] = useState<TabId>("batch");
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<TrackingStats | null>(null);

  useEffect(() => { fetch("/api/inventory/tracking/stats", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setStats(j.stats); }).catch(() => {}); }, []);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Inventory</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Inventory Tracking</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ScanSearch className="h-5 w-5 text-primary" /> Inventory Tracking</h1>
        <p className="mt-0.5 text-sm text-muted">Batch, expiry and serial-number traceability across purchase, sales, returns & exchanges.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile icon={Boxes} label="Total Batches" value={String(stats.totalBatches)} tone="primary" />
          <Tile icon={CalendarClock} label="Near Expiry" value={String(stats.nearExpiry)} tone="warning" />
          <Tile icon={AlertTriangle} label="Expired" value={String(stats.expired)} tone="danger" />
          <Tile icon={PackageCheck} label="Serials Available" value={String(stats.serialAvailable)} tone="success" />
          <Tile icon={Hash} label="Serials Sold" value={String(stats.serialSold)} tone="info" />
          <Tile icon={History} label="Serials Returned" value={String(stats.serialReturned)} tone="warning" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border">
        <div className="flex flex-wrap items-center gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        <div className="relative mb-1.5 min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product / batch / serial / invoice / customer…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
        </div>
      </div>

      {tab === "batch" && <BatchTab q={q} fmt={fmt} />}
      {tab === "expiry" && <ExpiryTab q={q} fmt={fmt} />}
      {tab === "serial" && <SerialTab q={q} fmt={fmt} />}
    </div>
  );
}

/* ----------------------------------------------------------------- Batch */
function BatchTab({ q, fmt }: { q: string; fmt: ReturnType<typeof useFmt> }) {
  const [rows, setRows] = useState<BatchTrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/inventory/tracking/batches?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setRows(j.rows);
    setLoading(false);
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  if (loading) return <div className="py-12"><AppLoader label="Loading batches…" size="sm" /></div>;
  return (
    <TableWrap cols={["Batch", "Product", "Supplier", "Mfg", "Expiry", "Pur. Rate", "Sell. Rate", "Received", "Available", "Sold", "Returned", "Dispatched", "Damaged", "Status"]}>
      {rows.map((r) => (
        <tr key={r.key} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
          <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{r.batchNo}</td>
          <td className="px-3 py-2"><div className="font-medium text-foreground">{r.product}</div><div className="font-mono text-2xs text-subtle">{r.sku || "—"}</div></td>
          <td className="px-3 py-2 text-muted">{r.supplier || "—"}</td>
          <td className="px-3 py-2 text-2xs text-muted">{r.mfgDate || "—"}</td>
          <td className="px-3 py-2 text-2xs text-muted">{r.expiryDate || "—"}</td>
          <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt.money(r.purchaseRate)}</td>
          <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt.money(r.sellingRate)}</td>
          <td className="px-3 py-2 text-right tabular-nums text-foreground">{fmt.qty(r.received)}</td>
          <td className="px-3 py-2 text-right font-semibold tabular-nums text-success">{fmt.qty(r.available)}</td>
          <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt.qty(r.sold)}</td>
          <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt.qty(r.returned)}</td>
          <td className="px-3 py-2 text-right tabular-nums text-primary">{fmt.qty(r.dispatched)}</td>
          <td className="px-3 py-2 text-right tabular-nums text-muted">{fmt.qty(r.damaged)}</td>
          <td className="px-3 py-2 text-center"><Badge tone={r.status === "Active" ? "success" : "neutral"}>{r.status}</Badge></td>
        </tr>
      ))}
      {!rows.length && <EmptyRow span={14} text="No batch-tracked stock found." />}
    </TableWrap>
  );
}

/* ---------------------------------------------------------------- Expiry */
function ExpiryTab({ q, fmt }: { q: string; fmt: ReturnType<typeof useFmt> }) {
  const [rows, setRows] = useState<ExpiryTrackRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/inventory/tracking/expiry?q=${encodeURIComponent(q)}&filter=${filter}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setRows(j.rows);
    setLoading(false);
  }, [q, filter]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {[["all", "All"], ["near", "Near Expiry"], ["expired", "Expired"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={cn("rounded-md border px-3 py-1 text-xs font-semibold transition", filter === v ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:text-foreground")}>{l}</button>
        ))}
      </div>
      {loading ? <div className="py-12"><AppLoader label="Loading expiry…" size="sm" /></div> : (
        <TableWrap cols={["Product", "Batch", "Mfg", "Expiry", "Remaining", "Available", "Warehouse", "Status"]}>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
              <td className="px-3 py-2"><div className="font-medium text-foreground">{r.product}</div><div className="font-mono text-2xs text-subtle">{r.sku || "—"}</div></td>
              <td className="px-3 py-2 font-mono text-xs text-muted">{r.batchNo || "—"}</td>
              <td className="px-3 py-2 text-2xs text-muted">{r.mfgDate || "—"}</td>
              <td className="px-3 py-2 text-2xs text-muted">{r.expiryDate || "—"}</td>
              <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", r.remainingDays != null && r.remainingDays < 0 ? "text-danger" : r.remainingDays != null && r.remainingDays <= 30 ? "text-warning" : "text-muted")}>{r.remainingDays == null ? "—" : r.remainingDays < 0 ? `${-r.remainingDays}d ago` : `${r.remainingDays}d`}</td>
              <td className="px-3 py-2 text-right tabular-nums text-foreground">{fmt.qty(r.available)}</td>
              <td className="px-3 py-2 text-muted">{r.warehouse}</td>
              <td className="px-3 py-2 text-center"><Badge tone={EXP_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
            </tr>
          ))}
          {!rows.length && <EmptyRow span={8} text="No expiry-tracked stock found." />}
        </TableWrap>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Serial */
function SerialTab({ q, fmt: _fmt }: { q: string; fmt: ReturnType<typeof useFmt> }) {
  const [rows, setRows] = useState<SerialTrackRow[]>([]);
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const STATUSES = ["All", "Available", "Sold", "Returned", "Quarantine", "Damaged", "Scrapped", "ReturnedToSupplier"];
  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/inventory/tracking/serials?q=${encodeURIComponent(q)}&status=${status}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setRows(j.rows);
    setLoading(false);
  }, [q, status]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  return (
    <div className="space-y-3">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none">
        {STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
      </select>
      {loading ? <div className="py-12"><AppLoader label="Loading serials…" size="sm" /></div> : (
        <TableWrap cols={["Serial No", "Product", "Batch", "Purchase", "Sales Invoice", "Customer", "Warehouse", "Warranty", "Status", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
              <td className="px-3 py-2 font-mono text-xs font-semibold text-foreground">{r.serialNo || "—"}<div className="text-2xs font-normal text-subtle" title="Shop-generated tracking QR">QR: {r.code}</div></td>
              <td className="px-3 py-2"><div className="font-medium text-foreground">{r.product}</div><div className="font-mono text-2xs text-subtle">{r.sku || "—"}</div></td>
              <td className="px-3 py-2 font-mono text-2xs text-muted">{r.batchNo || "—"}</td>
              <td className="px-3 py-2 font-mono text-2xs text-muted">{r.purchaseRef || "—"}</td>
              <td className="px-3 py-2 font-mono text-2xs text-muted">{r.salesInvoice || "—"}</td>
              <td className="px-3 py-2 text-muted">{r.customer || "—"}</td>
              <td className="px-3 py-2 text-muted">{r.warehouse || "—"}</td>
              <td className="px-3 py-2 text-2xs text-muted">{r.warrantyEnd ? `${r.warrantyStart || "?"} → ${r.warrantyEnd}` : "—"}</td>
              <td className="px-3 py-2 text-center"><Badge tone={SERIAL_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
              <td className="px-3 py-2 text-right"><button onClick={() => setHistoryId(r.id)} title="Serial history" className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><History className="h-3.5 w-3.5" /></button></td>
            </tr>
          ))}
          {!rows.length && <EmptyRow span={10} text="No serial-managed pieces found." />}
        </TableWrap>
      )}
      {historyId != null && <SerialHistoryDrawer id={historyId} onClose={() => setHistoryId(null)} />}
    </div>
  );
}

function SerialHistoryDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<SerialHistoryResponse | null>(null);
  useEffect(() => { fetch(`/api/inventory/tracking/serials/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j); }).catch(() => {}); }, [id]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground"><History className="h-4 w-4 text-primary" /> Serial History</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {!data ? <div className="py-16"><AppLoader label="Loading…" size="sm" /></div> : (
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <KV k="Serial No" v={data.serial.serialNo || "—"} mono />
              <KV k="Tracking QR" v={data.serial.code} mono />
              <KV k="Product" v={data.serial.product} />
              <KV k="Batch" v={data.serial.batchNo || "—"} />
              <KV k="Warehouse" v={data.serial.warehouse || "—"} />
              <KV k="Status" v={data.serial.status} />
              <KV k="Customer" v={data.serial.customer || "—"} />
              <KV k="Warranty" v={data.serial.warrantyEnd ? `${data.serial.warrantyStart} → ${data.serial.warrantyEnd}` : "—"} />
              <KV k="Expiry" v={data.serial.expiryDate || "—"} />
            </div>
            <div>
              <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Timeline</p>
              <ol className="relative space-y-3 border-l border-border pl-4">
                {data.events.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[1.30rem] top-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex items-center gap-2 text-sm"><span className="font-semibold text-foreground">{e.action}</span><span className="text-2xs text-subtle">{e.at}</span></div>
                    {e.detail && <div className="text-2xs text-muted">{e.detail}</div>}
                  </li>
                ))}
                {!data.events.length && <li className="text-2xs text-muted">No events.</li>}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ bits */
function TableWrap({ cols, children }: { cols: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">{cols.map((c, i) => <th key={i} className={cn("px-3 py-2.5", ["Pur. Rate", "Sell. Rate", "Received", "Available", "Sold", "Returned", "Dispatched", "Damaged", "Remaining"].includes(c) && "text-right", ["Status", ""].includes(c) && "text-center")}>{c}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function EmptyRow({ span, text }: { span: number; text: string }) {
  return <tr><td colSpan={span} className="px-4 py-12 text-center text-sm text-muted">{text}</td></tr>;
}
function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{k}</div><div className={cn("mt-0.5 text-sm font-medium text-foreground", mono && "font-mono")}>{v}</div></div>;
}
const TILE_TONES = { primary: "bg-primary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", info: "bg-secondary text-white" } as const;
function Tile({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: string; tone: keyof typeof TILE_TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3 shadow-sm"><div className="flex items-center gap-2"><span className={cn("grid h-8 w-8 place-items-center rounded-lg", TILE_TONES[tone])}><Icon className="h-4 w-4" /></span><p className="text-lg font-bold text-foreground">{value}</p></div><p className="mt-1.5 text-2xs font-medium text-muted">{label}</p></div>;
}
