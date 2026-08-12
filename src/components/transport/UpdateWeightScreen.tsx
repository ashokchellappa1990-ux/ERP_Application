"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Scale, ArrowLeft, Loader2, Save, Search, X, Plus, CheckCircle2, FileText, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/transport/VehicleGateEntryScreen";
import { cn } from "@/lib/cn";

interface ProductHit { id: number; name: string; sku?: string; uom?: string }
interface Data {
  id: number; gateEntryNo: string; status: string; entryType: string; vehicleNo: string;
  driverName: string | null; driverMobile: string | null; transportCompanyName: string | null; transportMode: string | null;
  supplierName: string | null; supplierGstin: string | null; arrivalTime: string | null; grnId: number | null;
  grossWeight: number | null; tareWeight: number | null; netWeight: number | null; weightSlipRefNo: string | null;
  inventoryMovement: string | null;
  items: { productId: number; productName: string; sku: string | null; uom: string | null }[];
}

const INVENTORY_MOVEMENTS = ["Move to Raw Material Main Stock", "Move to Production Plant Stock"];
const n = (v: unknown) => Number(v) || 0;
const inp = "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";

export function UpdateWeightScreen() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posted, setPosted] = useState(false);

  const [product, setProduct] = useState<{ productId: number; productName: string; sku: string; uom: string } | null>(null);
  const [pq, setPq] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[] | null>(null);
  const [searchingProduct, setSearchingProduct] = useState(false);
  const [tareWeight, setTareWeight] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  // Net Weight (calculated) is always Gross − Tare — read-only, never stored
  // as its own input. Net Weight as per Slip is the manually-entered figure
  // from the physical weight slip, captured separately (kept independent, same
  // pattern as the GRN's own calculated Net Weight vs Net Weight as per Bill).
  const netCalc = (n(grossWeight) > 0 || n(tareWeight) > 0) ? +(n(grossWeight) - n(tareWeight)).toFixed(3) : null;
  const [netWeightSlip, setNetWeightSlip] = useState("");
  const [inventoryMovement, setInventoryMovement] = useState("");

  useEffect(() => {
    fetch(`/api/transport/gate-entry/${id}/weighment`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return;
        const d: Data = j.data;
        setData(d);
        setTareWeight(d.tareWeight != null ? String(d.tareWeight) : "");
        setGrossWeight(d.grossWeight != null ? String(d.grossWeight) : "");
        setNetWeightSlip(d.netWeight != null ? String(d.netWeight) : "");
        setInventoryMovement(d.inventoryMovement ?? "");
        const it = d.items[0];
        if (it) setProduct({ productId: it.productId, productName: it.productName, sku: it.sku ?? "", uom: it.uom ?? "" });
      })
      .finally(() => setLoading(false));
  }, [id]);

  const prodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchProducts = async (q: string) => {
    if (!q.trim()) { setProductHits(null); setSearchingProduct(false); return; }
    try {
      const j = await fetch(`/api/pos/products?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setProductHits(j.products ?? []);
    } catch { setProductHits(null); } finally { setSearchingProduct(false); }
  };
  const onPq = (v: string) => {
    setPq(v);
    if (prodTimer.current) clearTimeout(prodTimer.current);
    if (!v.trim()) { setProductHits(null); setSearchingProduct(false); return; }
    setSearchingProduct(true);
    prodTimer.current = setTimeout(() => searchProducts(v), 250);
  };
  const pickProduct = (p: ProductHit) => {
    setProduct({ productId: p.id, productName: p.name, sku: p.sku ?? "", uom: p.uom ?? "" });
    setPq(""); setProductHits(null);
  };

  async function submit() {
    setSaving(true);
    try {
      const j = await fetch(`/api/transport/gate-entry/${id}/weighment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tareWeight: tareWeight || null, grossWeight: grossWeight || null, netWeight: netWeightSlip || null,
          inventoryMovement: inventoryMovement || null,
          items: product ? [{ productId: product.productId, productName: product.productName, sku: product.sku, uom: product.uom }] : [],
        }),
      }).then((r) => r.json()).catch(() => ({}));
      if (!j.ok) { toast.error(j.message || "Could not save the weighment."); return; }
      toast.success("Weighment recorded.");
      setPosted(true);
    } finally { setSaving(false); }
  }

  function postGrnNow() {
    if (!data) return;
    const p = new URLSearchParams({ gateEntryId: String(id), vehicleNo: data.vehicleNo });
    if (data.supplierName) p.set("supplier", data.supplierName);
    if (grossWeight) p.set("grossWeight", grossWeight);
    router.push(`/purchase/grn/new?${p}`);
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading gate entry…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Gate entry not found. <Link href="/transport/gate-entry" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/transport/gate-entry" className="hover:text-foreground">Vehicle Gate Entry</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Update Weight</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> Update Weight</h1>
          <p className="mt-0.5 text-sm text-muted">{data.gateEntryNo} — {data.vehicleNo}{data.supplierName ? ` — ${data.supplierName}` : ""}</p>
        </div>
        <Link href="/transport/gate-entry"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <SectionCard icon={Truck} title="Vehicle Entry Details">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KV k="Vehicle No" v={data.vehicleNo} />
          <KV k="Driver" v={data.driverName ? `${data.driverName}${data.driverMobile ? ` — ${data.driverMobile}` : ""}` : "—"} />
          <KV k="Transport Company" v={data.transportCompanyName ?? "—"} />
          <KV k="Transport Mode" v={data.transportMode ?? "—"} />
          <KV k="Supplier" v={data.supplierName ?? "—"} />
          <KV k="Supplier GSTIN" v={data.supplierGstin ?? "—"} />
          <KV k="Arrival Time" v={data.arrivalTime ? new Date(data.arrivalTime).toLocaleString() : "—"} />
          <KV k="Weight Slip Ref Number" v={data.weightSlipRefNo ?? "—"} />
        </div>
      </SectionCard>

      <SectionCard icon={Plus} title="Product" allowOverflow>
        {!product ? (
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60" />
            <input value={pq} onChange={(e) => onPq(e.target.value)} placeholder="Search product to add…" className="h-10 w-full rounded-lg border border-primary/40 bg-card pl-10 pr-9 text-sm shadow-sm placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" />
            {searchingProduct && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
            {productHits !== null && (productHits.length ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                {productHits.map((p) => (
                  <button key={p.id} onClick={() => pickProduct(p)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40">
                    <span className="min-w-0"><span className="block font-medium text-foreground">{p.name}</span><span className="block text-2xs text-subtle">{p.sku || "—"}</span></span>
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  </button>
                ))}
              </div>
            ) : <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted shadow-lg">No products matched.</div>)}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{product.productName}</p><p className="font-mono text-2xs text-subtle">{product.sku || "—"} · {product.uom || "—"}</p></div>
            <button onClick={() => setProduct(null)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Scale} title="Weighment Details">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tare Weight (Kg)"><input type="number" min={0} value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} placeholder="0" className={inp} /></Field>
          <Field label="Gross Weight (Kg)"><input type="number" min={0} value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} placeholder="0" className={inp} /></Field>
          <Field label="Net Weight (Kg)"><input readOnly value={netCalc != null ? String(netCalc) : ""} placeholder="0" className={cn(inp, "bg-surface-2 font-semibold text-primary")} /></Field>
          <Field label="Net Weight as per Slip (Kg)"><input type="number" min={0} value={netWeightSlip} onChange={(e) => setNetWeightSlip(e.target.value)} placeholder="Optional" className={inp} /></Field>
          <Field label="Inventory Movement">
            <select value={inventoryMovement} onChange={(e) => setInventoryMovement(e.target.value)} className={inp}>
              <option value="">— Select —</option>
              {INVENTORY_MOVEMENTS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <p className="mt-2 text-2xs text-subtle">Net Weight is calculated as Gross − Tare. If the physical weight slip states a different net weight, enter it separately above.</p>
      </SectionCard>

      <div className="flex items-center justify-end gap-2">
        <Button size="lg" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Submit Weighment"}</Button>
      </div>

      {posted && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-6 w-6" /></span>
              <h2 className="text-sm font-bold text-foreground">Weighment Recorded</h2>
              <p className="text-sm text-muted">Post the GRN now, or do it later from the gate entry list?</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-border bg-surface-2 px-5 py-4">
              <Button size="md" onClick={postGrnNow}><FileText className="h-4 w-4" /> Post GRN Now</Button>
              <Button variant="outline" size="md" onClick={() => router.push("/transport/gate-entry?entryType=RawMaterial")}>Do It Later</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return <div><p className="text-2xs font-semibold uppercase tracking-wide text-subtle">{k}</p><p className="text-sm font-medium text-foreground">{v}</p></div>;
}
