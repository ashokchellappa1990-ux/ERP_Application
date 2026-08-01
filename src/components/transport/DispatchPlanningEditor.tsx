"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, ArrowLeft, PackagePlus, Plus, X, Save, Loader2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { DispatchPlanningDetail } from "@/lib/contracts/transport";

const n = (v: unknown) => Number(v) || 0;
const SOURCES = ["Sales Order", "Stock Transfer", "Direct", "Other"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const TRANSPORT_MODES = ["", "Road", "Rail", "Air", "Courier", "Own Vehicle", "Third Party"];

interface ProductHit { id: number; name: string; sku?: string; uom?: string }
interface Line { id: string; productId: number | null; productName: string; sku: string; batchNo: string; qty: string; uom: string; remarks: string }
const blankLine = (i: number): Line => ({ id: `l-${i}-${Math.random().toString(36).slice(2, 7)}`, productId: null, productName: "", sku: "", batchNo: "", qty: "1", uom: "", remarks: "" });

export function DispatchPlanningEditor({ planId }: { planId?: number }) {
  const router = useRouter();
  const toast = useToast();

  const [loadingDoc, setLoadingDoc] = useState(!!planId);
  const [submitting, setSubmitting] = useState(false);
  const [lines, setLines] = useState<Line[]>([blankLine(0)]);
  const [pq, setPq] = useState(""); const [hits, setHits] = useState<ProductHit[] | null>(null);

  const [planningDate, setPlanningDate] = useState(new Date().toISOString().slice(0, 10));
  const [dispatchSource, setDispatchSource] = useState("Sales Order");
  const [referenceNo, setReferenceNo] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [expectedDispatchDate, setExpectedDispatchDate] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [transportMode, setTransportMode] = useState("");
  const [estimatedWeight, setEstimatedWeight] = useState("");
  const [estimatedVolume, setEstimatedVolume] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!planId) return;
    fetch(`/api/transport/dispatch-planning/${planId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) { toast.error(j.message || "Could not load dispatch plan."); return; }
      const d: DispatchPlanningDetail = j.data;
      setPlanningDate(d.planningDate); setDispatchSource(d.dispatchSource); setReferenceNo(d.referenceNo ?? "");
      setWarehouse(d.warehouse ?? ""); setExpectedDispatchDate(d.expectedDispatchDate ?? ""); setPriority(d.priority);
      setTransportMode(d.transportMode ?? ""); setEstimatedWeight(d.estimatedWeight ? String(d.estimatedWeight) : "");
      setEstimatedVolume(d.estimatedVolume ? String(d.estimatedVolume) : ""); setRemarks(d.remarks ?? "");
      setLines(d.items.map((it, i) => ({ id: `e-${i}`, productId: it.productId, productName: it.productName, sku: it.sku ?? "", batchNo: it.batchNo ?? "", qty: String(it.qty), uom: it.uom ?? "", remarks: it.remarks ?? "" })));
      setLoadingDoc(false);
    });
  }, [planId, toast]);

  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchProducts = async (q: string) => { if (!q.trim()) { setHits(null); return; } try { const j = await fetch(`/api/pos/products?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setHits(j.products ?? []); } catch { toast.error("Could not search products."); } };
  const onPq = (v: string) => { setPq(v); if (prodTimer.current) clearTimeout(prodTimer.current); if (!v.trim()) { setHits(null); return; } prodTimer.current = setTimeout(() => searchProducts(v), 250); };
  const addProductLine = (p: ProductHit) => { setLines((prev) => [...prev, { ...blankLine(prev.length), productId: p.id, productName: p.name, sku: p.sku ?? "", uom: p.uom ?? "" }]); setHits(null); setPq(""); };
  const updLine = (id: string, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((p) => (p.length > 1 ? p.filter((l) => l.id !== id) : p));

  const save = async () => {
    const valid = lines.filter((l) => l.productId && n(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one item with a valid quantity."); return; }
    setSubmitting(true);
    const payload = {
      planningDate, dispatchSource, referenceNo: referenceNo || undefined, warehouse: warehouse || undefined,
      expectedDispatchDate: expectedDispatchDate || undefined, priority, transportMode: transportMode || undefined,
      estimatedWeight: estimatedWeight ? n(estimatedWeight) : 0, estimatedVolume: estimatedVolume ? n(estimatedVolume) : 0,
      remarks: remarks || undefined,
      items: valid.map((l) => ({ productId: l.productId, productName: l.productName || undefined, sku: l.sku || undefined, batchNo: l.batchNo || undefined, qty: n(l.qty), uom: l.uom || undefined, remarks: l.remarks || undefined })),
    };
    try {
      const res = await fetch(planId ? `/api/transport/dispatch-planning/${planId}` : "/api/transport/dispatch-planning", { method: planId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Saved."); router.push(`/warehouse/transfer/dispatch-planning/${planId ?? j.id}`); }
      else { toast.error(j.message || "Could not save the dispatch plan."); setSubmitting(false); }
    } catch { toast.error("Network error — could not save."); setSubmitting(false); }
  };

  if (loadingDoc) return <div className="py-16"><AppLoader label="Loading dispatch plan…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/dispatch-planning" className="hover:text-foreground">Dispatch Planning</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{planId ? "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> {planId ? "Edit Dispatch Plan" : "New Dispatch Plan"}</h1>
          <p className="mt-0.5 text-sm text-muted">Plan the items, priority &amp; transport mode for an upcoming outbound dispatch.</p>
        </div>
        <Link href={planId ? `/warehouse/transfer/dispatch-planning/${planId}` : "/warehouse/transfer/dispatch-planning"}><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <SectionCard icon={ClipboardList} title="Plan Details" allowOverflow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Planning Date"><input type="date" value={planningDate} onChange={(e) => setPlanningDate(e.target.value)} className={inp} /></Fld>
          <Fld label="Dispatch Source"><select value={dispatchSource} onChange={(e) => setDispatchSource(e.target.value)} className={inp}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Fld>
          <Fld label="Reference No"><input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="SO/STR number, if any" className={inp} /></Fld>
          <Fld label="Warehouse"><input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className={inp} /></Fld>
          <Fld label="Expected Dispatch Date"><input type="date" value={expectedDispatchDate} onChange={(e) => setExpectedDispatchDate(e.target.value)} className={inp} /></Fld>
          <Fld label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value)} className={inp}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Fld>
          <Fld label="Transport Mode"><select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className={inp}>{TRANSPORT_MODES.map((t) => <option key={t} value={t}>{t || "—"}</option>)}</select></Fld>
          <Fld label="Estimated Weight (kg)"><input type="number" value={estimatedWeight} onChange={(e) => setEstimatedWeight(e.target.value)} className={inp} placeholder="0.000" /></Fld>
          <Fld label="Estimated Volume (cft)"><input type="number" value={estimatedVolume} onChange={(e) => setEstimatedVolume(e.target.value)} className={inp} placeholder="0.000" /></Fld>
        </div>
      </SectionCard>

      <SectionCard icon={PackagePlus} title="Items" allowOverflow>
        <div className="relative mb-3 flex flex-wrap items-end gap-2">
          <div className="relative min-w-[240px] flex-1">
            <label className="mb-1 block text-2xs font-semibold text-muted">Add product</label>
            <input value={pq} onChange={(e) => onPq(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchProducts(pq); } }} placeholder="Search product to add…" className={inp} />
            {hits !== null && (hits.length ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                {hits.map((p) => <button key={p.id} onClick={() => addProductLine(p)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40"><span className="min-w-0"><span className="block font-medium text-foreground">{p.name}</span><span className="block text-2xs text-subtle">{p.sku || "—"}</span></span><Plus className="h-3.5 w-3.5 text-primary" /></button>)}
              </div>
            ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No products matched.</div>)}
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <colgroup><col /><col className="w-28" /><col className="w-24" /><col className="w-20" /><col className="w-40" /><col className="w-10" /></colgroup>
            <thead><tr className="border-b border-border bg-surface-2 text-2xs font-semibold uppercase tracking-wider text-subtle">
              <th className="px-2 py-2 text-left">Product</th><th className="px-2 py-2 text-left">Batch No</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-left">UOM</th><th className="px-2 py-2 text-left">Remarks</th><th className="px-2 py-2"></th>
            </tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 align-middle">
                  <td className="px-2 py-1.5"><div className="font-medium text-foreground">{l.productName || <span className="text-subtle">Search &amp; pick a product above</span>}</div>{l.sku ? <div className="text-2xs text-subtle">{l.sku}</div> : null}</td>
                  <td className="px-2 py-1.5"><input value={l.batchNo} onChange={(e) => updLine(l.id, { batchNo: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                  <td className="px-2 py-1.5"><input type="number" value={l.qty} onChange={(e) => updLine(l.id, { qty: e.target.value })} className={cn(inpSm, "w-full text-right")} /></td>
                  <td className="px-2 py-1.5"><input value={l.uom} onChange={(e) => updLine(l.id, { uom: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                  <td className="px-2 py-1.5"><input value={l.remarks} onChange={(e) => updLine(l.id, { remarks: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                  <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(l.id)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button></td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted">Search &amp; add a product.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard icon={ClipboardList} title="Remarks">
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} />
      </SectionCard>

      <div className="flex items-center justify-end gap-2">
        <Button size="lg" onClick={save} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {planId ? "Save Changes" : "Save as Draft"}</Button>
      </div>
      <p className="text-center text-2xs text-subtle">A dispatch plan is a planning document only — approve it, then assign a vehicle, to move it toward execution.</p>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const inpSm = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
