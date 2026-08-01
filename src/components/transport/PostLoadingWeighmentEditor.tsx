"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Weight, ArrowLeft, Truck, Save, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

interface GateRow { id: number; gateEntryNo: string; vehicleNo: string; status: string }
interface PreRow { id: number; gateEntryId: number; tareWeight: number }

export function PostLoadingWeighmentEditor() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const preselectId = searchParams.get("gateEntryId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eligible, setEligible] = useState<GateRow[]>([]);
  const [preMap, setPreMap] = useState<Map<number, number>>(new Map());

  const [gateEntryId, setGateEntryId] = useState<number | "">("");
  const [grossWeight, setGrossWeight] = useState("");
  const [operator, setOperator] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    (async () => {
      const [pw, ge, pre] = await Promise.all([
        fetch("/api/transport/post-weighment", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/gate-entry", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/transport/pre-weighment", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);
      const postedGateIds = new Set((pw.ok ? pw.rows : []).map((r: { gateEntryId: number }) => r.gateEntryId));
      const preRows: PreRow[] = pre.ok ? pre.rows : [];
      const preGateIds = new Set(preRows.map((p) => p.gateEntryId));
      const rows: GateRow[] = (ge.ok ? ge.rows : []).filter((g: { status: string; id: number }) => (g.status === "Loading" || g.status === "Inside Factory") && preGateIds.has(g.id) && !postedGateIds.has(g.id));
      setEligible(rows);
      setPreMap(new Map(preRows.map((p) => [p.gateEntryId, p.tareWeight])));

      const initial = preselectId ? rows.find((r) => r.id === Number(preselectId)) : rows[0];
      if (initial) setGateEntryId(initial.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tareWeight = gateEntryId ? (preMap.get(gateEntryId) ?? 0) : 0;
  const gross = Number(grossWeight) || 0;
  const netWeight = Math.round((gross - tareWeight) * 1000) / 1000;

  async function save() {
    if (!gateEntryId) { toast.error("Select a vehicle."); return; }
    if (!grossWeight || gross <= 0) { toast.error("Enter a valid gross weight."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/transport/post-weighment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateEntryId, grossWeight: gross, operator: operator || null, weighDate: new Date().toISOString().slice(0, 10), remarks: remarks || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Post-loading weighment recorded."); router.push("/transport/post-weighment"); }
      else { toast.error(j.message || "Could not save the weighment."); setSaving(false); }
    } catch { toast.error("Network error — could not save."); setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/transport/post-weighment" className="hover:text-foreground">Post Loading Weighment</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Weight className="h-5 w-5 text-primary" /> New Post Loading Weighment</h1>
          <p className="mt-0.5 text-sm text-muted">Gross weight after loading — net weight is computed live against the pre-loading tare.</p>
        </div>
        <Link href="/transport/post-weighment"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {!loading && eligible.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Weight className="mx-auto h-8 w-8 text-subtle" />
          <p className="mt-3 text-sm font-semibold text-foreground">No vehicles are ready for post-loading weighment.</p>
          <p className="mt-1 text-sm text-muted">A vehicle must be Loading/Inside Factory with a Pre-Loading Weighment already recorded, and not yet weighed after loading.</p>
          <Link href="/transport/pre-weighment/new"><Button size="md" className="mt-4">Go to Pre-Loading Weighment</Button></Link>
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
            </div>
          </SectionCard>

          <SectionCard icon={Weight} title="Weighment Details" allowOverflow>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-2xs font-semibold text-muted">Gross Weight (In Kgs) *</label>
                <input type="number" min={0} step="0.001" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} className={inp} />
              </div>
              <Fld label="Operator"><input value={operator} onChange={(e) => setOperator(e.target.value)} className={inp} /></Fld>
            </div>
            <div className="mt-3 rounded-lg bg-surface-2 p-3">
              <div className="flex items-center justify-between text-xs text-muted"><span>Tare Weight (from Pre-Loading Weighment, In Kgs)</span><span className="font-semibold tabular-nums text-foreground">{tareWeight.toLocaleString()}</span></div>
              <div className="mt-1 flex items-center justify-between text-sm font-bold"><span className="text-foreground">Net Weight (In Kgs)</span><span className="tabular-nums text-primary">{gateEntryId ? netWeight.toLocaleString() : "—"}</span></div>
            </div>
            {gateEntryId !== "" && !preMap.has(gateEntryId) && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning-subtle px-3 py-2 text-2xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> No pre-loading weighment found for this vehicle yet — recording will fail until one exists.</p>
            )}
            <div className="mt-3"><Fld label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>
          </SectionCard>

          <div className="flex items-center justify-end gap-2">
            <Button size="lg" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Record Weighment</Button>
          </div>
        </>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
