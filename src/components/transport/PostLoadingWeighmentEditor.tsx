"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Weight, ArrowLeft, Truck, Save, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { FetchWeightButton } from "@/components/shared/FetchWeightButton";
import { WeighbridgeReadout } from "@/components/shared/WeighbridgeReadout";
import { useWeighbridgeContext } from "@/components/shared/WeighbridgeProvider";
import { WEIGHMENT_COPY, WeighmentTypeToggle, typeOfEntry, type WeighmentType } from "@/components/transport/weighmentType";

interface GateRow {
  id: number; gateEntryNo: string; vehicleNo: string; status: string; entryType: string;
  customerName: string | null; supplierName: string | null; grossWeight: number | null; grnId: number | null; tareWeight: number | null;
}
interface PreRow { id: number; gateEntryId: number; tareWeight: number; grossWeight: number | null }

// Second Weighment — Sales: loaded (gross) weight after loading, tare from the
// First Weighment. Purchase: empty (tare) weight after unloading, gross from the
// First Weighment; the server also syncs it onto the GRN if one exists.
export function PostLoadingWeighmentEditor() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const preselectId = searchParams.get("gateEntryId");
  // Optional return path for hand-offs (e.g. the GRN page's "Update Tare Weight").
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  const [type, setType] = useState<WeighmentType>(searchParams.get("type") === "Purchase" ? "Purchase" : "Sales");
  const isPurchase = type === "Purchase";
  const copy = WEIGHMENT_COPY[type];
  const listHref = `/transport/post-weighment${isPurchase ? "?type=Purchase" : ""}`;
  const backHref = safeNext ?? listHref;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eligibleByType, setEligibleByType] = useState<Record<WeighmentType, GateRow[]>>({ Sales: [], Purchase: [] });
  const eligible = eligibleByType[type];
  // gateEntryId → the weight captured at the First Weighment (tare for Sales, gross for Purchase).
  const [firstWeight, setFirstWeight] = useState<Map<number, number>>(new Map());

  const [gateEntryId, setGateEntryId] = useState<number | "">("");
  const [weight, setWeight] = useState("");
  const [operator, setOperator] = useState("");
  const [remarks, setRemarks] = useState("");
  const [enableWeighbridgeFetch, setEnableWeighbridgeFetch] = useState(false);
  const wb = useWeighbridgeContext();

  useEffect(() => {
    (async () => {
      const j = await fetch("/api/settings/purchase", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok && j.config) setEnableWeighbridgeFetch(!!j.config.flags?.enableWeighbridgeFetch);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [pw, geSales, gePurchase, pre] = await Promise.all([
        fetch("/api/transport/post-weighment", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/gate-entry?entryType=Dispatch", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/gate-entry?entryType=RawMaterial", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/pre-weighment", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);
      const postedGateIds = new Set((pw.ok ? pw.rows : []).map((r: { gateEntryId: number }) => r.gateEntryId));
      const preByGate = new Map<number, PreRow>((pre.ok ? pre.rows as PreRow[] : []).map((p) => [p.gateEntryId, p]));

      // "Completed" too: a "Capture Later" dispatch completes before the loaded truck is weighed.
      const sales: GateRow[] = (geSales.ok ? geSales.rows : []).filter((g: GateRow) => (g.status === "Loading" || g.status === "Inside Factory" || g.status === "Completed") && preByGate.has(g.id) && !postedGateIds.has(g.id));
      // Purchase gross may also live only on the gate entry (weighed through the
      // old "Update Weight" step); skip GRNs whose tare was already captured there.
      const purchase: GateRow[] = (gePurchase.ok ? gePurchase.rows : []).filter((g: GateRow) => g.status !== "Exited" && !postedGateIds.has(g.id) && !(g.tareWeight && g.tareWeight > 0) && ((preByGate.get(g.id)?.grossWeight ?? g.grossWeight ?? 0) > 0));
      setEligibleByType({ Sales: sales, Purchase: purchase });

      const fw = new Map<number, number>();
      sales.forEach((g) => fw.set(g.id, preByGate.get(g.id)?.tareWeight ?? 0));
      purchase.forEach((g) => fw.set(g.id, preByGate.get(g.id)?.grossWeight ?? g.grossWeight ?? 0));
      setFirstWeight(fw);

      const pick = preselectId ? [...sales, ...purchase].find((r) => r.id === Number(preselectId)) : undefined;
      if (pick) { setType(typeOfEntry(pick.entryType)); setGateEntryId(pick.id); }
      else {
        const first = (type === "Purchase" ? purchase : sales)[0];
        if (first) setGateEntryId(first.id);
        if (preselectId) toast.error("That gate entry isn't waiting for a second weighment.");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchType(t: WeighmentType) {
    if (t === type) return;
    setType(t); setWeight("");
    setGateEntryId(eligibleByType[t][0]?.id ?? "");
  }

  const first = gateEntryId ? (firstWeight.get(gateEntryId) ?? 0) : 0;
  const w = Number(weight) || 0;
  const gross = isPurchase ? first : w;
  const tare = isPurchase ? w : first;
  const netWeight = Math.round((gross - tare) * 1000) / 1000;
  const selected = gateEntryId !== "" ? eligible.find((g) => g.id === gateEntryId) : undefined;

  async function save() {
    if (!gateEntryId) { toast.error("Select a vehicle."); return; }
    if (!weight || w <= 0) { toast.error(`Enter a valid ${copy.second.weight.toLowerCase()} weight.`); return; }
    if (isPurchase && w > first) { toast.error("Tare weight can't exceed the gross weight."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/transport/post-weighment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateEntryId, ...(isPurchase ? { tareWeight: w } : { grossWeight: w }), operator: operator || null, weighDate: new Date().toISOString().slice(0, 10), remarks: remarks || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Second weighment recorded."); router.push(backHref); }
      else { toast.error(j.message || "Could not save the weighment."); setSaving(false); }
    } catch { toast.error("Network error — could not save."); setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href={listHref} className="hover:text-foreground">Second Weighment</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Weight className="h-5 w-5 text-primary" /> New Second Weighment</h1>
          <p className="mt-0.5 text-sm text-muted">{copy.second.hint}</p>
        </div>
        <Link href={backHref}><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <WeighmentTypeToggle value={type} onChange={switchType} disabled={loading || !!preselectId} />

      {!loading && eligible.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Weight className="mx-auto h-8 w-8 text-subtle" />
          <p className="mt-3 text-sm font-semibold text-foreground">No {type.toLowerCase()} vehicles are ready for second weighment.</p>
          <p className="mt-1 text-sm text-muted">
            {isPurchase
              ? "A Raw Material vehicle needs its First Weighment (gross) recorded, and not yet weighed empty."
              : "A Stock Dispatch vehicle needs its First Weighment (tare) recorded, not yet weighed after loading, and not yet exited."}
          </p>
          <Link href={`/transport/pre-weighment/new?type=${type}`}><Button size="md" className="mt-4">Go to First Weighment</Button></Link>
        </div>
      )}

      {(loading || eligible.length > 0) && (
        <>
          <SectionCard icon={Truck} title="Vehicle" allowOverflow>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label="Vehicle Number *">
                <select value={gateEntryId} onChange={(e) => setGateEntryId(e.target.value ? Number(e.target.value) : "")} className={inp} disabled={loading}>
                  <option value="">{loading ? "Loading…" : "Select vehicle…"}</option>
                  {eligible.map((g) => <option key={g.id} value={g.id}>{g.vehicleNo} — {g.gateEntryNo} ({g.status})</option>)}
                </select>
              </Fld>
              {selected && <Fld label={copy.party}><input value={(isPurchase ? selected.supplierName : selected.customerName) ?? "—"} disabled className={cn(inp, "text-subtle")} /></Fld>}
              {selected && isPurchase && <Fld label="GRN"><input value={selected.grnId ? "Created — tare will be updated on it" : "Not created yet — will prefill tare"} disabled className={cn(inp, "text-subtle")} /></Fld>}
            </div>
          </SectionCard>

          <SectionCard icon={Weight} title="Weighment Details" allowOverflow action={enableWeighbridgeFetch ? <WeighbridgeReadout state={wb.state} liveWeight={wb.liveWeight} /> : undefined}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-2xs font-semibold text-muted">{copy.second.label} *</label>
                <div className="flex gap-1.5">
                  <input type="number" min={0} step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} className={inp} />
                  {enableWeighbridgeFetch && <FetchWeightButton connected={wb.state === "connected"} liveWeight={wb.liveWeight} onFetch={(kg) => setWeight(String(kg))} />}
                </div>
              </div>
              <Fld label="Operator"><input value={operator} onChange={(e) => setOperator(e.target.value)} className={inp} /></Fld>
            </div>
            <div className="mt-3 rounded-lg bg-surface-2 p-3">
              <div className="flex items-center justify-between text-xs text-muted"><span>{copy.first.weight} Weight (from First Weighment, In Kgs)</span><span className="font-semibold tabular-nums text-foreground">{first.toLocaleString()}</span></div>
              <div className="mt-1 flex items-center justify-between text-sm font-bold"><span className="text-foreground">Net Weight (In Kgs)</span><span className="tabular-nums text-primary">{gateEntryId && weight ? netWeight.toLocaleString() : "—"}</span></div>
            </div>
            {isPurchase && weight !== "" && w > first && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning-subtle px-3 py-2 text-2xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Tare weight is more than the gross weight — check the reading.</p>
            )}
            <div className="mt-3"><Fld label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>
          </SectionCard>

          <div className="flex items-center justify-end gap-2">
            <Button size="lg" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Record Weighment</Button>
          </div>
        </>
      )}
      {/* Covers the gap between clicking "Record Weighment" and either
          navigating away on success or an error toast. */}
      {saving && <AppLoader fullScreen label="Recording weighment…" />}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
