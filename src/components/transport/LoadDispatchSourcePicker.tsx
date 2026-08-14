"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PackageCheck, ArrowLeft, ClipboardList, Truck, ArrowLeftRight, Undo2,
  Factory, Wrench, MoreHorizontal, Search, Loader2, ArrowRight, Save,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { LOAD_DISPATCH_SOURCES } from "@/lib/contracts/loadDispatch";
import type { LoadDispatchSource } from "@/lib/contracts/loadDispatch";

const SOURCE_ICON: Record<LoadDispatchSource, LucideIcon> = {
  SALES_ORDER: ClipboardList,
  DIRECT_CUSTOMER: Truck,
  STOCK_TRANSFER: ArrowLeftRight,
  PURCHASE_RETURN: Undo2,
  SALES_RETURN_PICKUP: Undo2,
  PRODUCTION_TRANSFER: Factory,
  JOB_WORK: Wrench,
  OTHERS: MoreHorizontal,
};

const SOURCE_DESC: Record<LoadDispatchSource, string> = {
  SALES_ORDER: "Auto-loads pending items from an existing Sales Order.",
  DIRECT_CUSTOMER: "Manual entry — no Sales Order involved.",
  STOCK_TRANSFER: "Auto-loads from an approved branch Transfer Request's Stock Allocation.",
  PURCHASE_RETURN: "Physical dispatch of goods back to a supplier.",
  SALES_RETURN_PICKUP: "Physical pickup of goods returned by a customer.",
  PRODUCTION_TRANSFER: "Movement of goods to/from a production or manufacturing unit.",
  JOB_WORK: "Goods sent out for job work / third-party processing.",
  OTHERS: "Any other outbound movement not covered above.",
};

const OTHER_SOURCES: LoadDispatchSource[] = ["PURCHASE_RETURN", "SALES_RETURN_PICKUP", "PRODUCTION_TRANSFER", "JOB_WORK", "OTHERS"];

interface SalesOrderHit { id: number; docNo: string; customerName: string; itemCount: number; netAmount: number }
interface TransferRequestHit { id: number; requestNo: string; source: string; sourceWarehouse: string | null; destination: string; destinationWarehouse: string | null; totalRequestedQty: number }

const today = () => new Date().toISOString().slice(0, 10);

export function LoadDispatchSourcePicker() {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<LoadDispatchSource | null>(null);
  const [busy, setBusy] = useState(false);

  // Sales Order
  const [soQ, setSoQ] = useState("");
  const [soHits, setSoHits] = useState<SalesOrderHit[] | null>(null);
  const [soBusy, setSoBusy] = useState(false);
  const soTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSalesOrders = async (q: string) => {
    setSoBusy(true);
    try { const j = await fetch(`/api/sales/order/lookup?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setSoHits(j.rows ?? []); }
    catch { toast.error("Could not search sales orders."); }
    finally { setSoBusy(false); }
  };
  const onSoQ = (v: string) => { setSoQ(v); if (soTimer.current) clearTimeout(soTimer.current); soTimer.current = setTimeout(() => searchSalesOrders(v), 250); };
  async function loadFromSalesOrder(so: SalesOrderHit) {
    setBusy(true);
    try {
      const res = await fetch("/api/warehouse/load-dispatch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "SALES_ORDER", salesOrderId: so.id, dispatchDate: today(), warehouse: null }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Loaded from Sales Order."); router.push(`/warehouse/transfer/load-dispatch/${j.id}`); }
      else { toast.error(j.message || "Could not load this Sales Order."); setBusy(false); }
    } catch { toast.error("Network error — could not load."); setBusy(false); }
  }

  // Stock Transfer
  const [trQ, setTrQ] = useState("");
  const [trHits, setTrHits] = useState<TransferRequestHit[] | null>(null);
  const [trBusy, setTrBusy] = useState(false);
  const trTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTransferRequests = async (q: string) => {
    setTrBusy(true);
    try {
      const u = new URLSearchParams({ status: "Approved" });
      if (q.trim()) u.set("q", q.trim());
      const j = await fetch(`/api/warehouse/transfer/request?${u}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setTrHits((j.rows ?? []).slice(0, 25));
    } catch { toast.error("Could not search transfer requests."); }
    finally { setTrBusy(false); }
  };
  const onTrQ = (v: string) => { setTrQ(v); if (trTimer.current) clearTimeout(trTimer.current); trTimer.current = setTimeout(() => searchTransferRequests(v), 250); };
  async function loadFromTransferRequest(tr: TransferRequestHit) {
    setBusy(true);
    try {
      const res = await fetch("/api/warehouse/load-dispatch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "STOCK_TRANSFER", transferRequestId: tr.id, dispatchDate: today() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Loaded from Transfer Request."); router.push(`/warehouse/transfer/load-dispatch/${j.id}`); }
      else { toast.error(j.message || "Could not load this Transfer Request."); setBusy(false); }
    } catch { toast.error("Network error — could not load."); setBusy(false); }
  }

  // Other doc types (Purchase Return / Sales Return Pickup / Production Transfer / Job Work / Others)
  const [partyName, setPartyName] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [areaId, setAreaId] = useState<number | "">("");
  const [areas, setAreas] = useState<{ id: number; name: string; code: string }[]>([]);
  const [remarks, setRemarks] = useState("");
  useEffect(() => {
    (async () => {
      const j = await fetch("/api/system/areas", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setAreas(j.rows.map((a: { id: number; name: string; code: string }) => ({ id: a.id, name: a.name, code: a.code })));
    })();
  }, []);
  async function createOther(source: LoadDispatchSource) {
    setBusy(true);
    try {
      const res = await fetch("/api/warehouse/load-dispatch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, dispatchDate: today(), partyName: partyName.trim() || null, warehouse: warehouse.trim() || null, areaId: areaId || null, remarks: remarks.trim() || null, items: [] }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Dispatch created."); router.push(`/warehouse/transfer/load-dispatch/${j.id}`); }
      else { toast.error(j.message || "Could not create the dispatch."); setBusy(false); }
    } catch { toast.error("Network error — could not create."); setBusy(false); }
  }

  function pickSource(v: LoadDispatchSource) {
    setSelected(v);
    setSoQ(""); setSoHits(null);
    setTrQ(""); setTrHits(null);
    setPartyName(""); setWarehouse(""); setAreaId(""); setRemarks("");
    if (v === "STOCK_TRANSFER") searchTransferRequests("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/load-dispatch" className="hover:text-foreground">Load &amp; Dispatch</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageCheck className="h-5 w-5 text-primary" /> Start Load &amp; Dispatch</h1>
          <p className="mt-0.5 text-sm text-muted">Step 1 — choose the dispatch source.</p>
        </div>
        <Link href="/warehouse/transfer/load-dispatch"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <SectionCard icon={ClipboardList} title="Dispatch Source" allowOverflow>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LOAD_DISPATCH_SOURCES.map((s) => {
            const Icon = SOURCE_ICON[s.value];
            const active = selected === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => pickSource(s.value)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition",
                  active ? "border-primary bg-primary-subtle/40 shadow-sm" : "border-border bg-surface hover:border-primary/40 hover:bg-primary-subtle/20",
                )}
              >
                <span className={cn("grid h-10 w-10 place-items-center rounded-lg shadow-sm", active ? "bg-primary text-white" : "bg-surface-2 text-muted")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-foreground">{s.label}</span>
                <span className="text-2xs text-subtle">{SOURCE_DESC[s.value]}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {selected === "SALES_ORDER" && (
        <SectionCard icon={ClipboardList} title="Pick a Sales Order" allowOverflow>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={soQ} onChange={(e) => onSoQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchSalesOrders(soQ); } }}
              placeholder="Search sales order no / customer…" autoFocus
              className="h-10 w-full rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none"
            />
          </div>
          {soBusy && <div className="mt-3"><AppLoader label="Searching…" size="sm" /></div>}
          {!soBusy && soHits && (soHits.length ? (
            <div className="mt-3 max-h-80 space-y-1.5 overflow-auto">
              {soHits.map((so) => (
                <button
                  key={so.id} disabled={busy} onClick={() => loadFromSalesOrder(so)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm transition hover:border-primary/40 hover:bg-primary-subtle/30 disabled:opacity-50"
                >
                  <span className="min-w-0"><span className="block font-semibold text-foreground">{so.docNo}</span><span className="block text-2xs text-subtle">{so.customerName || "—"} · {so.itemCount} item(s)</span></span>
                  <span className="flex items-center gap-2 font-semibold text-foreground">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 text-primary" />}</span>
                </button>
              ))}
            </div>
          ) : <p className="mt-3 py-6 text-center text-sm text-muted">No billable sales orders matched.</p>)}
        </SectionCard>
      )}

      {selected === "DIRECT_CUSTOMER" && (
        <SectionCard icon={Truck} title="Direct Customer Dispatch">
          <p className="text-sm text-muted">Manual dispatch to a customer without a Sales Order — pick the customer, items and quantities on the next screen.</p>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => router.push("/warehouse/transfer/load-dispatch/new/direct")}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </SectionCard>
      )}

      {selected === "STOCK_TRANSFER" && (
        <SectionCard icon={ArrowLeftRight} title="Pick an Approved Transfer Request" allowOverflow>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={trQ} onChange={(e) => onTrQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchTransferRequests(trQ); } }}
              placeholder="Search transfer request no…" autoFocus
              className="h-10 w-full rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none"
            />
          </div>
          {trBusy && <div className="mt-3"><AppLoader label="Searching…" size="sm" /></div>}
          {!trBusy && trHits && (trHits.length ? (
            <div className="mt-3 max-h-80 space-y-1.5 overflow-auto">
              {trHits.map((tr) => (
                <button
                  key={tr.id} disabled={busy} onClick={() => loadFromTransferRequest(tr)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm transition hover:border-primary/40 hover:bg-primary-subtle/30 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">{tr.requestNo}</span>
                    <span className="block text-2xs text-subtle">{tr.source}{tr.sourceWarehouse ? ` (${tr.sourceWarehouse})` : ""} → {tr.destination}{tr.destinationWarehouse ? ` (${tr.destinationWarehouse})` : ""}</span>
                  </span>
                  <span className="flex items-center gap-2 font-semibold text-foreground">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 text-primary" />}</span>
                </button>
              ))}
            </div>
          ) : <p className="mt-3 py-6 text-center text-sm text-muted">No approved transfer requests matched.</p>)}
        </SectionCard>
      )}

      {selected && OTHER_SOURCES.includes(selected) && (
        <SectionCard icon={SOURCE_ICON[selected]} title={LOAD_DISPATCH_SOURCES.find((s) => s.value === selected)?.label ?? "Dispatch Details"}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fld label="Party Name"><input value={partyName} onChange={(e) => setPartyName(e.target.value)} className={inp} /></Fld>
            <Fld label="Warehouse"><input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className={inp} /></Fld>
            <Fld label="Storage Area">
              <select value={areaId} onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : "")} className={inp}>
                <option value="">— Select —</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </Fld>
            <div className="sm:col-span-2 lg:col-span-1"><Fld label="Remarks"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inp} /></Fld></div>
          </div>
          <p className="mt-2 text-2xs text-subtle">Items are Phase-1 physical tracking only and can be recorded once the dispatch is created.</p>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => createOther(selected)} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Create
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
