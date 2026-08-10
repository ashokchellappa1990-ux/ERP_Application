"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IndianRupee, Plus, Pencil, Trash2, Search, X, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { supplierProductPriceInput, type SupplierProductPriceRow, type SupplierProductPriceDetail } from "@/lib/contracts/supplierProductPrice";

interface SupplierHit { id: number; name: string }
interface ProductHit { id: number; name: string; code?: string; uom?: string }

export function SupplierProductPriceList() {
  const toast = useToast();
  const [rows, setRows] = useState<SupplierProductPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ mode: "add" | "edit"; id?: number } | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const url = q ? `/api/masters/purchase/supplier-product-price?q=${encodeURIComponent(q)}` : "/api/masters/purchase/supplier-product-price";
    const j = await fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setRows(j.rows);
    setLoading(false);
  }, [q]);
  useEffect(() => { load(); }, [load]);

  async function remove(r: SupplierProductPriceRow) {
    if (!window.confirm(`Delete the purchase price for ${r.supplierName} / ${r.productName}?`)) return;
    const j = await fetch(`/api/masters/purchase/supplier-product-price/${r.id}`, { method: "DELETE" }).then((x) => x.json());
    toast.result(j, "Deleted.", "Could not delete.");
    if (j.ok) load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Masters</span><span className="text-subtle">/</span><span>Purchase</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Supplier Product PP Config</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><IndianRupee className="h-5 w-5 text-primary" /> Supplier Product PP Config</h1>
          <p className="mt-0.5 text-sm text-muted">Purchase price per supplier for each product, with a full price-change history.</p>
        </div>
        <Button size="md" onClick={() => setModal({ mode: "add" })}><Plus className="h-4 w-4" /> Add Price</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier, product, code…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>
        : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No purchase prices yet. <button onClick={() => setModal({ mode: "add" })} className="font-semibold text-primary hover:underline">Add one →</button></div>
        : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2.5 text-left">Supplier</th><th className="px-3 py-2.5 text-left">Product</th><th className="px-3 py-2.5 text-left">UOM</th><th className="px-3 py-2.5 text-right">Purchase Price</th><th className="px-3 py-2.5 text-left">Effective From</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  <td className="px-3 py-2 font-medium text-foreground">{r.supplierName}</td>
                  <td className="px-3 py-2 text-2xs text-muted"><span className="font-medium text-foreground">{r.productName}</span>{r.productCode ? ` · ${r.productCode}` : ""}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.uom ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">₹{r.purchasePrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-2xs text-muted">{r.effectiveFrom}</td>
                  <td className="px-3 py-2 text-center"><Badge tone={r.status === "Active" ? "success" : "neutral"}>{r.status}</Badge></td>
                  <td className="px-3 py-2"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => setHistoryId(r.id)} title="View Price History" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><History className="h-4 w-4" /></button>
                    <button onClick={() => setModal({ mode: "edit", id: r.id })} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(r)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/30 hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {modal && <SupplierProductPriceModal mode={modal.mode} id={modal.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {historyId != null && <SupplierProductPriceHistoryModal id={historyId} onClose={() => setHistoryId(null)} />}
    </div>
  );
}

function SupplierProductPriceModal({ mode, id, onClose, onSaved }: { mode: "add" | "edit"; id?: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierHits, setSupplierHits] = useState<SupplierHit[] | null>(null);
  const [productId, setProductId] = useState<number | "">("");
  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[] | null>(null);
  const [productUom, setProductUom] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/masters/purchase/supplier-product-price/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok) {
        const d: SupplierProductPriceDetail = j.row;
        setSupplierId(d.supplierId); setSupplierQuery(d.supplierName);
        setProductId(d.productId); setProductQuery(`${d.productName}${d.productCode ? ` (${d.productCode})` : ""}`); setProductUom(d.uom);
        setPurchasePrice(String(d.purchasePrice)); setEffectiveFrom(d.effectiveFrom); setStatus(d.status); setRemarks(d.remarks ?? "");
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const supplierTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSupplierQuery = (v: string) => {
    setSupplierQuery(v); setSupplierId(""); setSupplierHits(null);
    if (supplierTimer.current) clearTimeout(supplierTimer.current);
    if (!v.trim()) return;
    supplierTimer.current = setTimeout(async () => {
      const j = await fetch(`/api/masters/suppliers?q=${encodeURIComponent(v.trim())}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setSupplierHits((j.suppliers ?? []).slice(0, 20));
    }, 250);
  };
  const pickSupplier = (h: SupplierHit) => { setSupplierId(h.id); setSupplierQuery(h.name); setSupplierHits(null); };

  const productTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onProductQuery = (v: string) => {
    setProductQuery(v); setProductId(""); setProductHits(null); setProductUom(null);
    if (productTimer.current) clearTimeout(productTimer.current);
    if (!v.trim()) return;
    productTimer.current = setTimeout(async () => {
      const j = await fetch(`/api/pos/products?q=${encodeURIComponent(v.trim())}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setProductHits((j.products ?? []).slice(0, 20));
    }, 250);
  };
  const pickProduct = (h: ProductHit) => { setProductId(h.id); setProductQuery(`${h.name}${h.code ? ` (${h.code})` : ""}`); setProductHits(null); setProductUom(h.uom ?? null); };

  async function save() {
    const payload = { supplierId: supplierId || undefined, productId: productId || undefined, purchasePrice: Number(purchasePrice) || 0, effectiveFrom, status, remarks: remarks || null };
    if (mode === "add") {
      const parsed = supplierProductPriceInput.safeParse(payload);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
        setErrors(fieldErrors);
        toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
        return;
      }
    } else if (!purchasePrice.trim() || !effectiveFrom.trim()) {
      toast.error("Purchase price and effective date are required.");
      return;
    }
    setErrors({});
    setBusy(true);
    const j = await fetch(id ? `/api/masters/purchase/supplier-product-price/${id}` : "/api/masters/purchase/supplier-product-price", {
      method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else { toast.error(j.message || "Could not save."); if (j.errors) setErrors(j.errors); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h3 className="text-base font-bold text-foreground">{mode === "add" ? "Add" : "Edit"} Purchase Price</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? <AppLoader label="Loading…" size="sm" /> : (
            <div className="grid gap-3">
              <div className="relative">
                <label className={lbl}>Supplier *</label>
                <input value={supplierQuery} disabled={mode === "edit"} onChange={(e) => onSupplierQuery(e.target.value)} placeholder="Search supplier…" className={cn(inp, mode === "edit" && "bg-surface-2 text-subtle")} />
                {errors.supplierId && <p className={errTxt}>{errors.supplierId}</p>}
                {supplierHits !== null && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                    {supplierHits.length ? supplierHits.map((h) => <button key={h.id} type="button" onClick={() => pickSupplier(h)} className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">{h.name}</button>) : <div className="px-3 py-2 text-sm text-muted">No matching suppliers.</div>}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className={lbl}>Product *</label>
                <input value={productQuery} disabled={mode === "edit"} onChange={(e) => onProductQuery(e.target.value)} placeholder="Search product…" className={cn(inp, mode === "edit" && "bg-surface-2 text-subtle")} />
                {errors.productId && <p className={errTxt}>{errors.productId}</p>}
                {productHits !== null && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                    {productHits.length ? productHits.map((h) => <button key={h.id} type="button" onClick={() => pickProduct(h)} className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">{h.name}{h.code ? <span className="ml-1.5 text-2xs text-subtle">{h.code}</span> : null}</button>) : <div className="px-3 py-2 text-sm text-muted">No matching products.</div>}
                  </div>
                )}
              </div>
              {productId !== "" && <div className="max-w-[10rem]"><label className={lbl}>UOM</label><input readOnly value={productUom || "—"} className={cn(inp, "bg-surface-2 text-subtle")} /></div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={lbl}>Purchase Price *</label><input type="number" min={0} step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className={inp} />{errors.purchasePrice && <p className={errTxt}>{errors.purchasePrice}</p>}</div>
                <div><label className={lbl}>Effective From *</label><input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Status</label><select value={status} onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")} className={inp}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
              </div>
              <div><label className={lbl}>Remarks</label><input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inp} /></div>
              {mode === "edit" && <p className="text-2xs text-subtle">Changing Purchase Price records a new entry in this price's history.</p>}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3"><Button size="sm" variant="ghost" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy || loading}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}

function SupplierProductPriceHistoryModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [detail, setDetail] = useState<SupplierProductPriceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/masters/purchase/supplier-product-price/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setDetail(j.row); }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h3 className="flex items-center gap-1.5 text-base font-bold text-foreground"><History className="h-4 w-4 text-primary" /> Purchase Price History</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? <AppLoader label="Loading…" size="sm" /> : !detail ? <p className="text-sm text-muted">Not found.</p> : (
            <>
              <div className="mb-3 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
                <div className="font-semibold text-foreground">{detail.supplierName} — {detail.productName}{detail.productCode ? ` (${detail.productCode})` : ""}</div>
                <div className="mt-0.5 text-2xs text-muted">Current price: <span className="font-bold text-foreground">₹{detail.purchasePrice.toFixed(2)}</span> · effective {detail.effectiveFrom}</div>
              </div>
              {detail.history.length === 0 ? <p className="py-4 text-center text-sm text-muted">No price changes recorded yet.</p> : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-2xs">
                    <thead><tr className="border-b border-border bg-surface-2 text-left uppercase tracking-wide text-subtle"><th className="px-3 py-2">Old Price</th><th className="px-3 py-2">New Price</th><th className="px-3 py-2">Effective From</th><th className="px-3 py-2">Changed By</th><th className="px-3 py-2">Changed At</th></tr></thead>
                    <tbody>
                      {detail.history.map((h) => (
                        <tr key={h.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-muted">{h.oldPrice != null ? `₹${h.oldPrice.toFixed(2)}` : "—"}</td>
                          <td className="px-3 py-2 font-semibold text-foreground">₹{h.newPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-muted">{h.effectiveFrom}</td>
                          <td className="px-3 py-2 text-muted">{h.changedByName ?? "—"}</td>
                          <td className="px-3 py-2 text-muted">{new Date(h.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3"><Button size="sm" variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}

function cn(...parts: (string | false | undefined)[]) { return parts.filter(Boolean).join(" "); }
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const errTxt = "mt-1 text-2xs font-medium text-danger";
