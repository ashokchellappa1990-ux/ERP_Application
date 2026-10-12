"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fuel, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { FUEL_TYPE_OPTS, fuelPurchaseInput, type FuelPurchaseInput, type TankRow } from "@/lib/contracts/fuelManagement";

interface SupplierOption { id: number; name: string }
const BLANK: FuelPurchaseInput = { purchaseDate: new Date().toISOString().slice(0, 10), supplierId: null, supplierName: "", fuelType: "Diesel", tankId: 0, quantity: 0, rate: 0, invoiceNo: "", invoiceDate: "", remarks: "" };

export function FuelPurchaseForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tanks, setTanks] = useState<TankRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [f, setF] = useState<FuelPurchaseInput>(BLANK);
  const set = <K extends keyof FuelPurchaseInput>(k: K, v: FuelPurchaseInput[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      const [tk, s] = await Promise.all([
        fetch("/api/transport/fuel-tank?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/masters/suppliers", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (tk?.ok) setTanks(tk.rows);
      if (s?.ok) setSuppliers(s.suppliers);
      setLoading(false);
    })();
  }, []);

  const selectedTank = tanks.find((t) => t.id === f.tankId);
  useEffect(() => { if (selectedTank) set("fuelType", selectedTank.fuelType as FuelPurchaseInput["fuelType"]); }, [f.tankId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const parsed = fuelPurchaseInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/fuel-purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Recorded."); router.push("/masters/transport/fuel-management"); }
    else toast.error(j.message || "Could not save.");
  }

  const amount = f.quantity * f.rate;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/fuel-management" className="hover:text-foreground">Fuel Management</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New Fuel Purchase</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Fuel className="h-5 w-5 text-primary" /> New Fuel Purchase</h1>
          <p className="mt-0.5 text-sm text-muted">Replenishes an internal fuel tank. Referenced supplier by id — no duplicate purchase/GL entries created here.</p>
        </div>
        <Link href="/masters/transport/fuel-management"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          <SectionCard icon={Fuel} title="Purchase Details">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={lbl}>Purchase Date *</label><input type="date" value={f.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Supplier</label><select value={f.supplierId ?? ""} onChange={(e) => set("supplierId", Number(e.target.value) || null)} className={inp}><option value="">— None —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className={lbl}>Supplier Name (if not listed)</label><input value={f.supplierName ?? ""} onChange={(e) => set("supplierName", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Fuel Tank *</label><select value={f.tankId || ""} onChange={(e) => set("tankId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{tanks.map((t) => <option key={t.id} value={t.id}>{t.tankName} ({t.currentQty}L current)</option>)}</select></div>
              <div><label className={lbl}>Fuel Type</label><select value={f.fuelType} onChange={(e) => set("fuelType", e.target.value as FuelPurchaseInput["fuelType"])} className={inp}>{FUEL_TYPE_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Invoice No.</label><input value={f.invoiceNo ?? ""} onChange={(e) => set("invoiceNo", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Invoice Date</label><input type="date" value={f.invoiceDate ?? ""} onChange={(e) => set("invoiceDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Quantity (L) *</label><input type="number" min={0} value={f.quantity || ""} onChange={(e) => set("quantity", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Rate (₹/L)</label><input type="number" min={0} value={f.rate || ""} onChange={(e) => set("rate", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="text-muted">Total Amount</span><span className="font-bold text-foreground">₹{amount.toFixed(2)}</span></div>
          </SectionCard>

          <div className="flex items-center justify-end gap-2">
            <Link href="/masters/transport/fuel-management"><Button variant="outline" size="md">Cancel</Button></Link>
            <Button size="md" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Record Purchase"}</Button>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
