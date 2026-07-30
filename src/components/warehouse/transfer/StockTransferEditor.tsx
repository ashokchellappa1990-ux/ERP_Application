"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ArrowLeft, Search, Trash2, Save, Send, Info, Boxes, FileText, ClipboardList, Building2, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { validateHeader } from "@/lib/contracts/stockTransfer";

interface BranchOpt { id: number; name: string; code: string; warehouses: string[] }
interface Options { defaultSourceBranchId: number | null; sourceBranches: BranchOpt[]; destinationBranches: BranchOpt[]; transferTypes: string[]; priorities: string[] }
interface Line { productId: number; productName: string; sku: string | null; uom: string | null; availableSource: number; availableDest: number; requestedQty: number; minStockQty: number | null; maxStockQty: number | null; remarks: string | null }
interface Existing { header: any; lines: Line[] }

const inp2 = "h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none";
const n = (v: unknown) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);

export function StockTransferEditor({ id, existing }: { id?: number; existing?: Existing }) {
  const router = useRouter();
  const [opt, setOpt] = useState<Options | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const h0 = existing?.header;
  const [transferType, setTransferType] = useState(h0?.transferType || "Internal Transfer");
  const [sourceBranchId, setSourceBranchId] = useState<number | null>(h0?.sourceBranchId ?? null);
  const [sourceWarehouse, setSourceWarehouse] = useState(h0?.sourceWarehouse || "");
  const [destinationBranchId, setDestinationBranchId] = useState<number | null>(h0?.destinationBranchId ?? null);
  const [destinationWarehouse, setDestinationWarehouse] = useState(h0?.destinationWarehouse || "");
  const [priority, setPriority] = useState(h0?.priority || "Normal");
  const [requestDate, setRequestDate] = useState((h0?.requestDate || today()).slice(0, 10));
  const [requiredDate, setRequiredDate] = useState(h0?.requiredDate || "");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(h0?.expectedDeliveryDate || "");
  const [referenceDoc, setReferenceDoc] = useState(h0?.referenceDoc || "");
  const [remarks, setRemarks] = useState(h0?.remarks || "");
  const [lines, setLines] = useState<Line[]>(existing?.lines ?? []);

  useEffect(() => {
    fetch("/api/warehouse/transfer/options", { cache: "no-store" }).then((r) => r.json()).then((j: any) => {
      if (!j.ok) return;
      setOpt(j);
      if (sourceBranchId == null) setSourceBranchId(j.defaultSourceBranchId ?? j.sourceBranches[0]?.id ?? null);
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const sourceBranch = useMemo(() => opt?.sourceBranches.find((b) => b.id === sourceBranchId) || opt?.destinationBranches.find((b) => b.id === sourceBranchId), [opt, sourceBranchId]);
  const destBranch = useMemo(() => opt?.destinationBranches.find((b) => b.id === destinationBranchId), [opt, destinationBranchId]);
  const destOptions = useMemo(() => opt?.destinationBranches.filter((b) => b.id !== sourceBranchId) ?? [], [opt, sourceBranchId]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, x) => (x === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, x) => x !== i));
  const totalQty = lines.reduce((s, l) => s + n(l.requestedQty), 0);

  async function refreshAvailability(i: number, productId: number) {
    const p = new URLSearchParams({ productId: String(productId) });
    if (sourceBranchId) p.set("sourceBranchId", String(sourceBranchId));
    if (sourceWarehouse) p.set("sourceWarehouse", sourceWarehouse);
    if (destinationBranchId) p.set("destBranchId", String(destinationBranchId));
    if (destinationWarehouse) p.set("destWarehouse", destinationWarehouse);
    const j = await fetch(`/api/warehouse/transfer/availability?${p.toString()}`, { cache: "no-store" }).then((r) => r.json());
    if (j.ok) setLine(i, { availableSource: j.availableSource, availableDest: j.availableDest, minStockQty: j.minStockQty, maxStockQty: j.maxStockQty, uom: j.uom || null });
  }

  async function save(thenSubmit: boolean) {
    setErr("");
    const payloadLines = lines.filter((l) => l.productId > 0);
    const v = validateHeader({ sourceBranchId: sourceBranchId ?? 0, destinationBranchId: destinationBranchId ?? 0, lines: payloadLines });
    if (v) { setErr(v); return; }
    setSaving(true);
    try {
      const body = { transferType, sourceBranchId, sourceWarehouse: sourceWarehouse || null, destinationBranchId, destinationWarehouse: destinationWarehouse || null, priority, requestDate, requiredDate: requiredDate || null, expectedDeliveryDate: expectedDeliveryDate || null, referenceDoc: referenceDoc || null, remarks: remarks || null, lines: payloadLines };
      const url = id ? `/api/warehouse/transfer/request/${id}` : "/api/warehouse/transfer/request";
      const j = await fetch(url, { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (!j.ok) { setErr(j.message || "Failed to save."); setSaving(false); return; }
      const newId = j.id ?? id;
      if (thenSubmit && newId) {
        const s = await fetch(`/api/warehouse/transfer/request/${newId}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit" }) }).then((r) => r.json());
        if (!s.ok) { setErr(s.message || "Saved, but submit failed."); setSaving(false); return; }
      }
      router.push(`/warehouse/transfer/request/${newId}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); setSaving(false); }
  }

  if (!opt) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/request" className="hover:text-foreground">Stock Transfer Request</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{id ? "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ArrowLeftRight className="h-5 w-5 text-primary" /> {id ? "Edit Transfer Request" : "New Transfer Request"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/warehouse/transfer/request"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button variant="secondary" size="md" onClick={() => save(false)} disabled={saving}><Save className="h-4 w-4" /> Save Draft</Button>
          <Button size="md" onClick={() => save(true)} disabled={saving}><Send className="h-4 w-4" /> {saving ? "Saving…" : "Save & Submit"}</Button>
        </div>
      </div>

      <div className="flex items-start gap-1.5 rounded-lg border border-info/30 bg-info-subtle/40 px-3 py-2 text-2xs text-info">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span><strong>Source</strong> is your login branch. <strong>Destination</strong> is any same-business branch except Office locations. Approval routing follows the source warehouse configuration. No inventory or GL is posted at this stage.</span>
      </div>

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{err}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* LEFT */}
        <div className="space-y-4">
          <SectionCard icon={Building2} title="Transfer Details" bodyClass="p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label="Transfer Type"><select value={transferType} onChange={(e) => setTransferType(e.target.value)} className={inp2}>{opt.transferTypes.map((t) => <option key={t}>{t}</option>)}</select></Fld>
              <Fld label={<>Source Branch <span className="text-primary">(your branch)</span></>}>
                <select value={sourceBranchId ?? ""} onChange={(e) => { setSourceBranchId(Number(e.target.value)); setSourceWarehouse(""); }} disabled={opt.sourceBranches.length <= 1} className={cn(inp2, opt.sourceBranches.length <= 1 && "bg-surface-2")}>
                  {opt.sourceBranches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              </Fld>
              <Fld label="Source Warehouse"><select value={sourceWarehouse} onChange={(e) => setSourceWarehouse(e.target.value)} className={inp2}><option value="">— Any —</option>{(sourceBranch?.warehouses ?? []).map((w) => <option key={w}>{w}</option>)}</select></Fld>
              <Fld label={<>Destination Branch <span className="text-danger">*</span></>}>
                <select value={destinationBranchId ?? ""} onChange={(e) => { setDestinationBranchId(Number(e.target.value) || null); setDestinationWarehouse(""); }} className={inp2}>
                  <option value="">— Select —</option>
                  {destOptions.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              </Fld>
              <Fld label="Destination Warehouse"><select value={destinationWarehouse} onChange={(e) => setDestinationWarehouse(e.target.value)} className={inp2}><option value="">— Any —</option>{(destBranch?.warehouses ?? []).map((w) => <option key={w}>{w}</option>)}</select></Fld>
              <Fld label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value)} className={inp2}>{opt.priorities.map((p) => <option key={p}>{p}</option>)}</select></Fld>
            </div>
          </SectionCard>

          {/* Product search */}
          <div className="relative rounded-2xl border border-primary/30 bg-primary-subtle/20 p-3 shadow-sm">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary"><Search className="h-3.5 w-3.5" /> Add product (name · SKU · barcode)</label>
            <ProductPicker
              disabledIds={lines.map((l) => l.productId)}
              onPick={(p) => {
                if (lines.some((l) => l.productId === p.id)) return;
                const i = lines.length;
                setLines((ls) => [...ls, { productId: p.id, productName: p.name, sku: p.sku ?? null, uom: p.baseUom ?? null, availableSource: 0, availableDest: 0, requestedQty: 1, minStockQty: null, maxStockQty: null, remarks: null }]);
                setTimeout(() => refreshAvailability(i, p.id), 0);
              }}
            />
          </div>

          {/* Items */}
          <SectionCard icon={Boxes} title="Items" action={<span className="text-2xs font-medium text-muted">Total Qty: <span className="font-bold text-foreground tabular-nums">{totalQty}</span></span>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Item</th><th className="px-3 py-2.5">UoM</th><th className="px-3 py-2.5 text-right">Avail. Src</th><th className="px-3 py-2.5 text-right">Avail. Dest</th><th className="px-3 py-2.5 text-right">Min</th><th className="px-3 py-2.5 text-right">Max</th><th className="px-3 py-2.5 text-center">Requested *</th><th className="px-3 py-2.5">Remarks</th><th className="px-3 py-2.5" /></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.productId} className="border-b border-border last:border-0">
                      <td className="px-3 py-2"><div className="font-medium text-foreground">{l.productName}</div>{l.sku && <div className="font-mono text-2xs text-subtle">{l.sku}</div>}</td>
                      <td className="px-3 py-2 text-muted">{l.uom || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{l.availableSource}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{l.availableDest}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-subtle">{l.minStockQty ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-subtle">{l.maxStockQty ?? "—"}</td>
                      <td className="px-3 py-2 text-center"><input type="number" min={0} step="any" value={l.requestedQty} onChange={(e) => setLine(i, { requestedQty: n(e.target.value) })} className="h-8 w-20 rounded border border-border bg-surface-2 text-center text-xs focus:border-primary focus:outline-none" /></td>
                      <td className="px-3 py-2"><input value={l.remarks ?? ""} onChange={(e) => setLine(i, { remarks: e.target.value })} placeholder="—" className="h-8 w-full min-w-[8rem] rounded border border-border bg-surface-2 px-2 text-xs focus:border-primary focus:outline-none" /></td>
                      <td className="px-3 py-2 text-right"><button onClick={() => removeLine(i)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                  {lines.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted">Search a product above to add request lines.</td></tr>}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard icon={FileText} title="Reference & Notes" bodyClass="p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label="Required Date"><input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className={inp2} /></Fld>
              <Fld label="Expected Delivery"><input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className={inp2} /></Fld>
              <Fld label="Reference Doc"><input value={referenceDoc} onChange={(e) => setReferenceDoc(e.target.value)} placeholder="PO / Indent no." className={inp2} /></Fld>
              <div className="sm:col-span-2 lg:col-span-3"><Fld label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Notes for the destination branch…" className={cn(inp2, "h-auto py-2")} /></Fld></div>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT */}
        <aside className="space-y-4">
          <SectionCard icon={ClipboardList} title="Document">
            <div className="space-y-3">
              <Fld label="Request No."><input readOnly value="Auto on save" className={cn(inp2, "bg-surface-2 font-mono text-primary")} /></Fld>
              <Fld label="Request Date"><input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} className={inp2} /></Fld>
            </div>
          </SectionCard>

          <SectionCard icon={Warehouse} title="Summary">
            <div className="space-y-1.5 text-sm">
              <Row k="Items" v={String(lines.filter((l) => l.productId > 0).length)} />
              <Row k="Total Requested Qty" v={String(totalQty)} />
              <div className="my-1.5 h-px bg-border" />
              <Row k="Source" v={sourceBranch ? sourceBranch.name : "—"} />
              <Row k="Destination" v={destBranch ? destBranch.name : "—"} />
              <Row k="Priority" v={priority} />
            </div>
            {err && <p className="mt-2 rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{err}</p>}
            <div className="mt-3 space-y-2">
              <Button size="lg" className="w-full" onClick={() => save(true)} disabled={saving}><Send className="h-4 w-4" /> {saving ? "Saving…" : "Save & Submit"}</Button>
              <Button size="md" variant="outline" className="w-full" onClick={() => save(false)} disabled={saving}><Save className="h-4 w-4" /> Save as Draft</Button>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

/* ---- inline product search ---- */
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
          {res.map((p) => {
            const added = disabledIds.includes(p.id);
            return (
              <button key={p.id} disabled={added} onClick={() => { onPick(p); setQ(""); setRes([]); setOpen(false); }} className={cn("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left", added ? "cursor-not-allowed opacity-50" : "hover:bg-primary-subtle/50")}>
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{p.name}</span><span className="font-mono text-2xs text-subtle">{p.sku || "—"}{p.baseUom ? ` · ${p.baseUom}` : ""}</span></span>
                <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-2xs font-semibold text-muted">{added ? "Added" : `Stock ${p.stock ?? 0}`}</span>
              </button>
            );
          })}
        </div>
      )}
      {open && q && res.length === 0 && <div className="absolute left-0 right-0 z-30 mt-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted shadow-xl">No product found.</div>}
    </div>
  );
}

function Fld({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>;
}
