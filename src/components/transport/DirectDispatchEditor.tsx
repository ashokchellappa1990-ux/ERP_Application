"use client";

import { useRef, useState } from "react";
import { ClipboardEdit, Plus, X, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const n = (v: unknown) => Number(v) || 0;

interface ProductHit { id: number; name: string; sku?: string; uom?: string; price?: number }
interface Line { id: string; productId: number | null; productName: string; sku: string; uom: string; batchNo: string; qty: string; rate: string }
const blankLine = (i: number): Line => ({ id: `l-${i}-${Math.random().toString(36).slice(2, 7)}`, productId: null, productName: "", sku: "", uom: "", batchNo: "", qty: "1", rate: "" });

export function DirectDispatchEditor({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [remarks, setRemarks] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([blankLine(0)]);
  const [pq, setPq] = useState(""); const [hits, setHits] = useState<ProductHit[] | null>(null);

  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchProducts = async (q: string) => { if (!q.trim()) { setHits(null); return; } try { const j = await fetch(`/api/pos/products?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setHits(j.products ?? []); } catch { toast.error("Could not search products."); } };
  const onPq = (v: string) => { setPq(v); if (prodTimer.current) clearTimeout(prodTimer.current); if (!v.trim()) { setHits(null); return; } prodTimer.current = setTimeout(() => searchProducts(v), 250); };
  const addProductLine = (p: ProductHit) => { setLines((prev) => [...prev, { ...blankLine(prev.length), productId: p.id, productName: p.name, sku: p.sku ?? "", uom: p.uom ?? "", rate: p.price != null ? String(p.price) : "" }]); setHits(null); setPq(""); };
  const updLine = (id: string, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((p) => (p.length > 1 ? p.filter((l) => l.id !== id) : p));

  async function save() {
    const valid = lines.filter((l) => l.productId && n(l.qty) > 0);
    if (!valid.length) { toast.error("Add at least one item with a valid quantity."); return; }
    setSubmitting(true);
    const payload = {
      docType: "Customer", docDate, customerName: customerName.trim() || undefined,
      deliveryAddress: deliveryAddress.trim() || undefined, warehouse: warehouse.trim() || undefined, remarks: remarks.trim() || undefined,
      items: valid.map((l) => ({ productId: l.productId, productName: l.productName || undefined, sku: l.sku || undefined, uom: l.uom || undefined, batchNo: l.batchNo || undefined, dispatchedQty: n(l.qty), rate: l.rate ? n(l.rate) : undefined })),
    };
    try {
      const res = await fetch("/api/transport/dispatch-execution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Direct dispatch created."); onCreated(j.id); }
      else { toast.error(j.message || "Could not create the dispatch."); setSubmitting(false); }
    } catch { toast.error("Network error — could not save."); setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-fade-in flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground"><ClipboardEdit className="h-4 w-4 text-primary" /> New Direct Customer Dispatch</div>
          <button onClick={onClose} className="text-subtle hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fld label="Doc Date"><input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className={inp} /></Fld>
            <Fld label="Warehouse"><input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className={inp} /></Fld>
            <Fld label="Customer"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className={inp} /></Fld>
            <Fld label="Delivery Address"><input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={inp} /></Fld>
          </div>

          <div>
            <label className="mb-1 block text-2xs font-semibold text-muted">Add product</label>
            <div className="relative">
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
              <colgroup><col /><col className="w-28" /><col className="w-20" /><col className="w-24" /><col className="w-10" /></colgroup>
              <thead><tr className="border-b border-border bg-surface-2 text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-2 py-2 text-left">Product</th><th className="px-2 py-2 text-left">Batch No</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Rate</th><th className="px-2 py-2"></th>
              </tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0 align-middle">
                    <td className="px-2 py-1.5"><div className="font-medium text-foreground">{l.productName || <span className="text-subtle">Search &amp; pick above</span>}</div>{l.sku ? <div className="text-2xs text-subtle">{l.sku}</div> : null}</td>
                    <td className="px-2 py-1.5"><input value={l.batchNo} onChange={(e) => updLine(l.id, { batchNo: e.target.value })} className={cn(inpSm, "w-full")} /></td>
                    <td className="px-2 py-1.5"><input type="number" value={l.qty} onChange={(e) => updLine(l.id, { qty: e.target.value })} className={cn(inpSm, "w-full text-right")} /></td>
                    <td className="px-2 py-1.5"><input type="number" value={l.rate} onChange={(e) => updLine(l.id, { rate: e.target.value })} className={cn(inpSm, "w-full text-right")} /></td>
                    <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(l.id)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Fld label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="ghost" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="md" onClick={save} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Create Dispatch</Button>
        </div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const inpSm = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
