"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, ArrowLeft, Save, CheckCircle2, ShieldCheck, X, Info, Boxes, Building2, FileText, Search, Trash2, ListChecks, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { PRIORITIES, validateDispatchHeader } from "@/lib/contracts/stockDispatch";

interface Item { productId: number; productName: string; sku: string | null; uom: string | null; batchNo: string | null; mfgDate: string | null; expiryDate: string | null; serials: string[]; availableQty: number; requestedQty: number; allocatedQty: number; dispatchQty: number; unitCost: number; policy?: string; remarks: string | null }
interface ReqRow { requestId: number; requestNo: string; requestDate: string; fulfiller: string; receiver: string; priority: string; itemCount: number; requestedQty: number; allocatedQty: number; hasAllocation: boolean }
interface Header { referenceId: number | null; referenceNo: string | null; allocationId: number | null; sourceBranchId: number; sourceName: string; sourceWarehouse: string | null; destinationBranchId: number; destinationName: string; destinationWarehouse: string | null; transferType?: string | null; priority?: string }
interface Options { sourceBranchId: number | null; sourceName: string; destinationBranches: { id: number; name: string; code: string }[]; config: any }

const inp2 = "h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none";
const n = (v: unknown) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const Fld = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;

export function DispatchEditor() {
  const router = useRouter();
  const [dispatchType, setDispatchType] = useState<"Transfer Request Based" | "Direct Dispatch">("Transfer Request Based");
  const [header, setHeader] = useState<Header | null>(null);   // Mode 1 (loaded from request)
  const [options, setOptions] = useState<Options | null>(null); // Mode 2 (direct)
  const [destBranchId, setDestBranchId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState({ dispatchDate: today(), vehicleNo: "", driverName: "", transportName: "", lrNumber: "", expectedDeliveryDate: "", priority: "Normal", remarks: "" });
  const [reqQuery, setReqQuery] = useState("");
  const [reqHits, setReqHits] = useState<ReqRow[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [validateMsg, setValidateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [serialModal, setSerialModal] = useState<number | null>(null);
  const [serialPool, setSerialPool] = useState<Record<number, { serialNo: string; batchNo: string | null }[]>>({});

  // Mode 2 direct-dispatch options.
  useEffect(() => { if (dispatchType === "Direct Dispatch" && !options) fetch("/api/warehouse/dispatch/options", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setOptions(j); }); }, [dispatchType, options]);
  // Mode 1 request search.
  useEffect(() => {
    if (dispatchType !== "Transfer Request Based") return;
    const t = setTimeout(() => { fetch(`/api/warehouse/dispatch/requests?q=${encodeURIComponent(reqQuery)}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setReqHits(j.ok ? j.rows : [])); }, 200);
    return () => clearTimeout(t);
  }, [reqQuery, dispatchType]);

  async function loadRequest(requestId: number) {
    setBusy("load"); setErr("");
    const j = await fetch(`/api/warehouse/dispatch/load-request?requestId=${requestId}`, { cache: "no-store" }).then((r) => r.json());
    setBusy("");
    if (!j.ok) { setErr(j.message || "Could not load request."); return; }
    setHeader(j.header); setItems(j.items.map((i: any) => ({ ...i, remarks: i.remarks ?? null }))); setReqHits([]); setReqQuery("");
    if (j.header.priority) setMeta((m) => ({ ...m, priority: j.header.priority }));
  }

  const source = dispatchType === "Transfer Request Based" ? { name: header?.sourceName, wh: header?.sourceWarehouse } : { name: options?.sourceName, wh: null };
  const destName = dispatchType === "Transfer Request Based" ? header?.destinationName : options?.destinationBranches.find((b) => b.id === destBranchId)?.name;
  const totals = useMemo(() => ({ qty: items.reduce((s, i) => s + n(i.dispatchQty), 0), value: items.reduce((s, i) => s + n(i.dispatchQty) * n(i.unitCost), 0) }), [items]);

  const setItem = (i: number, patch: Partial<Item>) => setItems((it) => it.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const removeItem = (i: number) => setItems((it) => it.filter((_, k) => k !== i));

  async function addProduct(p: { id: number; name: string; sku: string | null; baseUom: string | null }) {
    if (!options?.sourceBranchId || items.some((x) => x.productId === p.id)) return;
    const av = await fetch(`/api/warehouse/dispatch/availability?productId=${p.id}&branchId=${options.sourceBranchId}`, { cache: "no-store" }).then((r) => r.json());
    const item: Item = { productId: p.id, productName: p.name, sku: p.sku ?? null, uom: av.uom ?? p.baseUom ?? null, batchNo: null, mfgDate: null, expiryDate: null, serials: [], availableQty: av.ok ? av.available : 0, requestedQty: 0, allocatedQty: 0, dispatchQty: av.ok && av.policy !== "Serial" ? Math.min(1, av.available) : 0, unitCost: av.ok ? av.unitCost : 0, policy: av.ok ? av.policy : "Qty", remarks: null };
    setItems((it) => [...it, item]);
    if (av.ok && av.policy === "Serial") { setSerialPool((sp) => ({ ...sp, [p.id]: av.serials })); setTimeout(() => setSerialModal(items.length), 0); }
  }

  function buildBody() {
    const destinationBranchId = dispatchType === "Transfer Request Based" ? header?.destinationBranchId : destBranchId;
    return {
      dispatchType, dispatchDate: meta.dispatchDate, referenceId: header?.referenceId ?? null,
      destinationBranchId, destinationWarehouse: dispatchType === "Transfer Request Based" ? header?.destinationWarehouse : null, sourceWarehouse: dispatchType === "Transfer Request Based" ? header?.sourceWarehouse : null,
      vehicleNo: meta.vehicleNo || null, driverName: meta.driverName || null, transportName: meta.transportName || null, lrNumber: meta.lrNumber || null, expectedDeliveryDate: meta.expectedDeliveryDate || null, priority: meta.priority, remarks: meta.remarks || null,
      items: items.filter((i) => i.productId > 0).map((i) => ({ ...i })),
    };
  }

  function clientValidate(): string | null {
    const destinationBranchId = dispatchType === "Transfer Request Based" ? header?.destinationBranchId : destBranchId;
    const v = validateDispatchHeader({ destinationBranchId: destinationBranchId ?? 0, items });
    if (v) return v;
    for (const i of items) {
      if (n(i.dispatchQty) > n(i.availableQty) + 0.001) return `${i.productName}: dispatch ${i.dispatchQty} exceeds available ${i.availableQty}.`;
      if (n(i.allocatedQty) > 0 && n(i.dispatchQty) > n(i.allocatedQty) + 0.001) return `${i.productName}: dispatch ${i.dispatchQty} exceeds allocated ${i.allocatedQty}.`;
    }
    return null;
  }

  async function save(thenDispatch: boolean) {
    setErr(""); setValidateMsg(null);
    const v = clientValidate();
    if (v) { setErr(v); return; }
    setBusy(thenDispatch ? "dispatch" : "draft");
    try {
      const j = await fetch("/api/warehouse/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildBody()) }).then((r) => r.json());
      if (!j.ok) { setErr(j.message || "Failed to save."); setBusy(""); return; }
      if (thenDispatch) {
        const d = await fetch(`/api/warehouse/dispatch/${j.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "dispatch" }) }).then((r) => r.json());
        if (!d.ok) { setErr(d.message || "Saved as draft, but dispatch failed."); router.push(`/warehouse/transfer/dispatch/${j.id}`); return; }
      }
      router.push(`/warehouse/transfer/dispatch/${j.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); setBusy(""); }
  }

  function validate() { const v = clientValidate(); setValidateMsg(v ? { ok: false, text: v } : { ok: true, text: `All ${items.length} item(s) valid — ready to dispatch ${totals.qty} qty.` }); }

  const ready = dispatchType === "Transfer Request Based" ? !!header : !!destBranchId;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/dispatch" className="hover:text-foreground">Stock Transfer Dispatch</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> New Dispatch</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/warehouse/transfer/dispatch"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button variant="outline" size="md" disabled={!ready || !!busy} onClick={validate}><ShieldCheck className="h-4 w-4" /> Validate</Button>
          <Button variant="secondary" size="md" disabled={!ready || !!busy} onClick={() => save(false)}><Save className="h-4 w-4" /> Save Draft</Button>
          <Button size="md" disabled={!ready || !!busy} onClick={() => save(true)}><CheckCircle2 className="h-4 w-4" /> {busy === "dispatch" ? "Dispatching…" : "Dispatch"}</Button>
        </div>
      </div>

      <div className="flex items-start gap-1.5 rounded-lg border border-info/30 bg-info-subtle/40 px-3 py-2 text-2xs text-info">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Dispatch <strong>reduces the source branch&apos;s stock</strong>, creates in-transit stock at the destination, writes the stock ledger and posts <strong>only internal-movement accounting</strong> (Inventory In-Transit Dr / Inventory Cr). No sales, GST, customer or supplier entries.</span>
      </div>

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{err}</div>}
      {validateMsg && <div className={cn("rounded-lg px-3 py-2 text-2xs font-medium", validateMsg.ok ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning")}>{validateMsg.text}</div>}

      {/* Dispatch type */}
      <SectionCard icon={Truck} title="Dispatch Type" bodyClass="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {([["Transfer Request Based", "From an approved transfer request"], ["Direct Dispatch", "Ad-hoc — pick destination & products"]] as const).map(([t, sub]) => (
            <button key={t} onClick={() => { setDispatchType(t); setHeader(null); setItems([]); setDestBranchId(null); }} className={cn("rounded-xl border p-3 text-left transition", dispatchType === t ? "border-primary bg-primary-subtle/40 ring-1 ring-primary" : "border-border hover:bg-surface-2")}>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground"><span className={cn("grid h-4 w-4 place-items-center rounded-full border", dispatchType === t ? "border-primary" : "border-border-strong")}>{dispatchType === t && <span className="h-2 w-2 rounded-full bg-primary" />}</span>{t}</div>
              <p className="mt-1 pl-6 text-2xs text-muted">{sub}</p>
            </button>
          ))}
          <div className="rounded-xl border border-border bg-surface-2/50 p-3 text-left opacity-70">
            <div className="flex items-center gap-2 text-sm font-bold text-muted"><Lock className="h-3.5 w-3.5" /> Packing Slip Based</div>
            <p className="mt-1 pl-6 text-2xs text-subtle">Coming soon — available after the Packing module.</p>
          </div>
        </div>
      </SectionCard>

      {/* Mode 1: request lookup */}
      {dispatchType === "Transfer Request Based" && !header && (
        <SectionCard icon={FileText} title="Select Transfer Request" bodyClass="p-4" allowOverflow>
          <div className="relative max-w-xl">
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-subtle/20 px-2"><Search className="h-4 w-4 text-primary" /><input value={reqQuery} onChange={(e) => setReqQuery(e.target.value)} placeholder="Search approved requests you can fulfil (request no)…" className="h-10 w-full bg-transparent text-sm focus:outline-none" /></div>
            {reqHits.length > 0 && (
              <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
                {reqHits.map((r) => (
                  <button key={r.requestId} onClick={() => loadRequest(r.requestId)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary-subtle/50">
                    <span className="min-w-0"><span className="block font-mono text-xs font-semibold text-primary">{r.requestNo}</span><span className="block text-2xs text-subtle">{r.fulfiller} → {r.receiver} · {r.requestDate} · {r.itemCount} item(s)</span></span>
                    <span className="shrink-0 text-right"><span className="block text-xs font-semibold text-foreground">{r.hasAllocation ? `Alloc ${r.allocatedQty}` : `Req ${r.requestedQty}`}</span><span className="block text-2xs text-subtle">{r.priority}</span></span>
                  </button>
                ))}
              </div>
            )}
            {reqQuery && reqHits.length === 0 && <p className="mt-2 text-2xs text-muted">No approved requests found for your branch to fulfil.</p>}
          </div>
          {busy === "load" && <div className="mt-3"><AppLoader label="Loading request…" size="sm" /></div>}
        </SectionCard>
      )}

      {/* Mode 2: direct destination */}
      {dispatchType === "Direct Dispatch" && (
        <SectionCard icon={Building2} title="Direct Dispatch" bodyClass="p-5">
          {!options ? <AppLoader label="Loading…" size="sm" /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label="Source Branch (your branch)"><input readOnly value={options.sourceName || "—"} className={cn(inp2, "bg-surface-2")} /></Fld>
              <Fld label={<>Destination Branch <span className="text-danger">*</span></>}>
                <select value={destBranchId ?? ""} onChange={(e) => setDestBranchId(Number(e.target.value) || null)} className={inp2}><option value="">— Select —</option>{options.destinationBranches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</select>
              </Fld>
            </div>
          )}
        </SectionCard>
      )}

      {ready && (<>
        {/* Header */}
        <SectionCard icon={FileText} title="Dispatch Details" bodyClass="p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fld label="Dispatch No."><input readOnly value="Auto on save" className={cn(inp2, "bg-surface-2 font-mono text-primary")} /></Fld>
            <Fld label="Dispatch Date"><input type="date" value={meta.dispatchDate} onChange={(e) => setMeta({ ...meta, dispatchDate: e.target.value })} className={inp2} /></Fld>
            {header?.referenceNo && <Fld label="Reference (Request)"><input readOnly value={header.referenceNo} className={cn(inp2, "bg-surface-2 font-mono text-primary")} /></Fld>}
            <Fld label="Priority"><select value={meta.priority} onChange={(e) => setMeta({ ...meta, priority: e.target.value })} className={inp2}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Fld>
            <Fld label="Source (From)"><input readOnly value={`${source.name || "—"}${source.wh ? ` · ${source.wh}` : ""}`} className={cn(inp2, "bg-surface-2")} /></Fld>
            <Fld label="Destination (To)"><input readOnly value={destName || "—"} className={cn(inp2, "bg-surface-2")} /></Fld>
            <Fld label="Vehicle No."><input value={meta.vehicleNo} onChange={(e) => setMeta({ ...meta, vehicleNo: e.target.value })} placeholder="TN01AB1234" className={inp2} /></Fld>
            <Fld label="Driver Name"><input value={meta.driverName} onChange={(e) => setMeta({ ...meta, driverName: e.target.value })} className={inp2} /></Fld>
            <Fld label="Transport Name"><input value={meta.transportName} onChange={(e) => setMeta({ ...meta, transportName: e.target.value })} className={inp2} /></Fld>
            <Fld label="LR Number"><input value={meta.lrNumber} onChange={(e) => setMeta({ ...meta, lrNumber: e.target.value })} className={inp2} /></Fld>
            <Fld label="Expected Delivery"><input type="date" value={meta.expectedDeliveryDate} onChange={(e) => setMeta({ ...meta, expectedDeliveryDate: e.target.value })} className={inp2} /></Fld>
            <div className="sm:col-span-2 lg:col-span-2"><Fld label="Remarks"><input value={meta.remarks} onChange={(e) => setMeta({ ...meta, remarks: e.target.value })} placeholder="Notes…" className={inp2} /></Fld></div>
          </div>
        </SectionCard>

        {/* Mode 2 product search */}
        {dispatchType === "Direct Dispatch" && (
          <div className="rounded-2xl border border-primary/30 bg-primary-subtle/20 p-3 shadow-sm">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary"><Search className="h-3.5 w-3.5" /> Add product (name · SKU · barcode)</label>
            <ProductPicker disabledIds={items.map((i) => i.productId)} onPick={addProduct} />
          </div>
        )}

        {/* Item grid */}
        <SectionCard icon={Boxes} title={<>Items <span className="text-2xs font-normal text-muted">· available at {source.name}</span></>} action={<span className="text-2xs font-medium text-muted">Qty <span className="font-bold text-foreground tabular-nums">{totals.qty}</span> · Value <span className="font-bold text-foreground tabular-nums">₹{totals.value.toLocaleString()}</span></span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">Batch / Serial</th><th className="px-3 py-2.5">UoM</th><th className="px-3 py-2.5 text-right">Available</th>{header && <th className="px-3 py-2.5 text-right">Allocated</th>}<th className="px-3 py-2.5 text-center">Dispatch</th><th className="px-3 py-2.5 text-right">Unit Cost</th><th className="px-3 py-2.5 text-right">Value</th><th className="px-3 py-2.5" /></tr></thead>
              <tbody>
                {items.map((it, i) => {
                  const over = n(it.dispatchQty) > n(it.availableQty) + 0.001 || (n(it.allocatedQty) > 0 && n(it.dispatchQty) > n(it.allocatedQty) + 0.001);
                  const isSerial = it.policy === "Serial";
                  return (
                    <tr key={it.productId} className="border-b border-border last:border-0 align-top">
                      <td className="px-3 py-2"><div className="font-medium text-foreground">{it.productName}</div>{it.sku && <div className="font-mono text-2xs text-subtle">{it.sku}</div>}{it.policy && <span className="mt-0.5 inline-block rounded-full bg-surface-2 px-1.5 text-[10px] font-semibold text-muted">{it.policy}</span>}</td>
                      <td className="px-3 py-2 text-2xs">{isSerial ? (dispatchType === "Direct Dispatch" ? <button onClick={() => setSerialModal(i)} className="rounded border border-border px-2 py-1 font-semibold text-primary hover:bg-primary-subtle">{it.serials.length ? `${it.serials.length} serial(s)` : "Pick serials"}</button> : <span className="text-muted">{it.serials.length} serial(s)</span>) : it.batchNo ? <span className="font-mono text-foreground">{it.batchNo}{it.expiryDate ? ` · exp ${it.expiryDate}` : ""}</span> : <span className="text-subtle">Auto ({it.policy || "FIFO"})</span>}</td>
                      <td className="px-3 py-2 text-muted">{it.uom || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{it.availableQty}</td>
                      {header && <td className="px-3 py-2 text-right tabular-nums text-muted">{it.allocatedQty || "—"}</td>}
                      <td className="px-3 py-2 text-center">{isSerial ? <span className="tabular-nums font-semibold text-foreground">{it.serials.length}</span> : <input type="number" min={0} step="any" value={it.dispatchQty} onChange={(e) => setItem(i, { dispatchQty: n(e.target.value) })} className={cn("h-8 w-20 rounded border bg-surface-2 text-center text-xs focus:outline-none", over ? "border-danger" : "border-border focus:border-primary")} />}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{it.unitCost ? it.unitCost.toLocaleString() : "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{(n(it.dispatchQty) * n(it.unitCost)).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{dispatchType === "Direct Dispatch" && <button onClick={() => removeItem(i)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button>}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={header ? 9 : 8} className="px-4 py-10 text-center text-sm text-muted">{dispatchType === "Direct Dispatch" ? "Search a product above to add dispatch lines." : "Select a transfer request to load items."}</td></tr>}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </>)}

      {/* Serial picker */}
      {serialModal != null && items[serialModal] && (() => {
        const it = items[serialModal];
        const pool = serialPool[it.productId] ?? [];
        const chosen = new Set(it.serials);
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setSerialModal(null)} />
            <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><ListChecks className="h-4 w-4" /></span><div className="flex-1"><h3 className="text-sm font-bold text-foreground">Pick Serials — {it.productName}</h3><p className="text-2xs text-muted">{chosen.size} selected</p></div><button onClick={() => setSerialModal(null)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
              <div className="flex-1 overflow-auto p-3">
                {pool.length === 0 ? <p className="py-8 text-center text-sm text-muted">No available serials at the source.</p> : <div className="space-y-1">{pool.map((s) => { const on = chosen.has(s.serialNo); return (
                  <label key={s.serialNo} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", on ? "border-primary bg-primary-subtle/40" : "border-border hover:bg-surface-2")}>
                    <input type="checkbox" checked={on} onChange={(e) => setItem(serialModal, { serials: e.target.checked ? [...it.serials, s.serialNo] : it.serials.filter((x) => x !== s.serialNo) })} />
                    <span className="font-mono text-xs text-foreground">{s.serialNo}</span>{s.batchNo && <span className="ml-auto text-2xs text-subtle">{s.batchNo}</span>}
                  </label>); })}</div>}
              </div>
              <div className="flex items-center justify-end border-t border-border px-5 py-3"><Button size="md" onClick={() => setSerialModal(null)}><CheckCircle2 className="h-4 w-4" /> Done ({chosen.size})</Button></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ProductPicker({ onPick, disabledIds }: { onPick: (p: { id: number; name: string; sku: string | null; baseUom: string | null }) => void; disabledIds: number[] }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => { fetch(`/api/pos/products?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()).then((j) => { setRes(j.ok ? j.products : []); setOpen(true); }).catch(() => {}); }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);
  return (
    <div className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => res.length && setOpen(true)} placeholder="Type or scan…" className="h-10 w-full rounded-lg border border-primary/40 bg-card px-3 text-sm focus:border-primary focus:outline-none" />
      {open && q && res.length > 0 && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
          {res.map((p) => { const added = disabledIds.includes(p.id); return (
            <button key={p.id} disabled={added} onClick={() => { onPick(p); setQ(""); setRes([]); setOpen(false); }} className={cn("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left", added ? "cursor-not-allowed opacity-50" : "hover:bg-primary-subtle/50")}>
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{p.name}</span><span className="font-mono text-2xs text-subtle">{p.sku || "—"}</span></span>
              <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-2xs font-semibold text-muted">{added ? "Added" : `Stock ${p.stock ?? 0}`}</span>
            </button>); })}
        </div>
      )}
    </div>
  );
}
