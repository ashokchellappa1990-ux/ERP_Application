"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Search, Wrench, FlaskConical, CheckCircle2, Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ItemLinesEditor, LabourLinesEditor } from "@/components/transport/masters/MaintenanceLineEditors";
import type { BreakdownDetail as BreakdownDetailT, ItemLineInput, LabourLineInput } from "@/lib/contracts/vehicleMaintenance";

const BREAKDOWN_TONE: Record<string, "warning" | "info" | "success" | "danger"> = { Reported: "warning", Inspection: "info", RepairInProgress: "info", Testing: "info", Completed: "success", Cancelled: "danger" };
const ACTION_META: Record<string, { label: string; icon: typeof Search }> = {
  inspect: { label: "Start Inspection", icon: Search },
  startRepair: { label: "Start Repair", icon: Wrench },
  test: { label: "Move to Testing", icon: FlaskConical },
  complete: { label: "Complete & Release Vehicle", icon: CheckCircle2 },
  cancel: { label: "Cancel", icon: Ban },
};
function actionsFor(status: string): string[] {
  if (status === "Reported") return ["inspect", "cancel"];
  if (status === "Inspection") return ["startRepair", "cancel"];
  if (status === "RepairInProgress") return ["test", "complete", "cancel"];
  if (status === "Testing") return ["complete", "cancel"];
  return [];
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";

export function BreakdownDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<BreakdownDetailT | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [items, setItems] = useState<ItemLineInput[]>([]);
  const [labour, setLabour] = useState<LabourLineInput[]>([]);
  const [otherCost, setOtherCost] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reason, setReason] = useState("");

  const load = () => fetch(`/api/transport/vehicle-breakdown/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
    if (j.ok) {
      setDetail(j.row);
      setItems(j.row.items.map((i: { productId: number | null; itemName: string; qty: number; uom: string | null; rate: number; remarks: string | null }) => ({ productId: i.productId, itemName: i.itemName, qty: i.qty, uom: i.uom, rate: i.rate, remarks: i.remarks })));
      setLabour(j.row.labour.map((l: { description: string; hours: number | null; rate: number; technician: string | null; remarks: string | null }) => ({ description: l.description, hours: l.hours, rate: l.rate, technician: l.technician, remarks: l.remarks })));
      setOtherCost(String(j.row.otherCost ?? 0));
    }
  }).catch(() => {});
  useEffect(() => { load(); }, [id]);

  function resetForm() { setDiagnosisNotes(""); setRemarks(""); setReason(""); }

  async function submit(action: string) {
    if (action === "cancel" && !reason.trim()) { toast.error("A reason is required."); return; }
    setBusy(true);
    const body: Record<string, unknown> = { action, remarks: remarks || undefined, diagnosisNotes: diagnosisNotes || undefined, cancellationReason: reason || undefined };
    if (action === "startRepair" || action === "test" || action === "complete") { body.items = items; body.labour = labour; body.otherCost = otherCost ? Number(otherCost) : undefined; }
    const j = await fetch(`/api/transport/vehicle-breakdown/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Updated."); setActiveAction(null); resetForm(); load(); } else toast.error(j.message || "Could not update.");
  }

  if (!detail) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>;
  const available = actionsFor(detail.status);
  const showLines = activeAction === "startRepair" || activeAction === "test" || activeAction === "complete";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/vehicle-maintenance" className="hover:text-foreground">Vehicle Maintenance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{detail.breakdownNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><AlertTriangle className="h-5 w-5 text-danger" /> {detail.breakdownNo}<Badge tone={BREAKDOWN_TONE[detail.status] ?? "neutral"}>{detail.status}</Badge></h1>
          <p className="mt-0.5 text-sm text-muted">{detail.vehicleNo} · {detail.breakdownType} · {detail.priority} Priority{detail.tripNo ? ` · Trip ${detail.tripNo}` : ""}</p>
        </div>
        <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/vehicle-maintenance")}><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>

      <SectionCard icon={AlertTriangle} title="Breakdown Details">
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadKV k="Vehicle" v={detail.vehicleNo} />
          <ReadKV k="Driver" v={detail.driverName ?? "—"} />
          <ReadKV k="Trip Reference" v={detail.tripNo ?? "—"} />
          <ReadKV k="Date" v={new Date(detail.breakdownDate).toLocaleString()} />
          <ReadKV k="Odometer" v={detail.odometer != null ? `${detail.odometer} KM` : "—"} />
          <ReadKV k="Location" v={detail.location ?? "—"} />
          <ReadKV k="Workshop" v={detail.workshopName ?? "—"} />
        </div>
        {detail.problemDescription && <p className="mt-3 text-xs text-muted">Problem: {detail.problemDescription}</p>}
        {detail.diagnosisNotes && <p className="mt-1 text-xs text-muted">Diagnosis: {detail.diagnosisNotes}</p>}
      </SectionCard>

      {(detail.items.length > 0 || detail.labour.length > 0) && (
        <SectionCard icon={Wrench} title="Parts & Labour Used">
          {detail.items.length > 0 && <table className="w-full text-xs"><thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted"><th className="py-1.5 text-left">Item</th><th className="py-1.5 text-right">Qty</th><th className="py-1.5 text-right">Amount</th></tr></thead><tbody>{detail.items.map((i) => <tr key={i.id} className="border-b border-border/50 last:border-0"><td className="py-1.5">{i.itemName}</td><td className="py-1.5 text-right">{i.qty} {i.uom ?? ""}</td><td className="py-1.5 text-right font-semibold">{i.amount.toFixed(2)}</td></tr>)}</tbody></table>}
          {detail.labour.length > 0 && <table className="mt-3 w-full text-xs"><thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted"><th className="py-1.5 text-left">Labour</th><th className="py-1.5 text-right">Hours</th><th className="py-1.5 text-right">Amount</th></tr></thead><tbody>{detail.labour.map((l) => <tr key={l.id} className="border-b border-border/50 last:border-0"><td className="py-1.5">{l.description}</td><td className="py-1.5 text-right">{l.hours ?? "—"}</td><td className="py-1.5 text-right font-semibold">{l.amount.toFixed(2)}</td></tr>)}</tbody></table>}
          <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
            <div className="flex justify-between text-muted"><span>Parts Cost</span><span>₹{detail.partsCost.toFixed(2)}</span></div>
            <div className="flex justify-between text-muted"><span>Labour Cost</span><span>₹{detail.labourCost.toFixed(2)}</span></div>
            <div className="flex justify-between text-muted"><span>Other Cost</span><span>₹{detail.otherCost.toFixed(2)}</span></div>
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold text-foreground"><span>Total Cost</span><span>₹{detail.totalCost.toFixed(2)}</span></div>
          </div>
        </SectionCard>
      )}

      {available.length > 0 && (
        <SectionCard icon={Wrench} title="Breakdown Workflow">
          <div className="flex flex-wrap gap-2">
            {available.map((a) => {
              const meta = ACTION_META[a];
              const Icon = meta.icon;
              return <Button key={a} size="sm" variant={activeAction === a ? (a === "cancel" ? "danger" : "primary") : "outline"} onClick={() => { setActiveAction(a === activeAction ? null : a); resetForm(); }}><Icon className="h-4 w-4" /> {meta.label}</Button>;
            })}
          </div>

          {activeAction && (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-2 p-4">
              <p className="text-sm font-bold text-foreground">{ACTION_META[activeAction].label}</p>
              {activeAction === "inspect" && <div><label className={lbl}>Diagnosis Notes</label><textarea value={diagnosisNotes} onChange={(e) => setDiagnosisNotes(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></div>}
              {showLines && (
                <>
                  <div><p className={lbl}>Spare Parts</p><ItemLinesEditor items={items} onChange={setItems} /></div>
                  <div><p className={lbl}>Labour</p><LabourLinesEditor labour={labour} onChange={setLabour} /></div>
                  <div className="sm:w-1/3"><label className={lbl}>Other Charges (towing/misc)</label><input type="number" min={0} value={otherCost} onChange={(e) => setOtherCost(e.target.value)} className={inp} /></div>
                </>
              )}
              {activeAction !== "cancel" && <div><label className={lbl}>Remarks</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></div>}
              {activeAction === "cancel" && <div><label className={lbl}>Cancellation Reason *</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></div>}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setActiveAction(null); resetForm(); }}>Close</Button>
                <Button size="sm" variant={activeAction === "cancel" ? "danger" : "primary"} onClick={() => submit(activeAction)} disabled={busy}>{busy ? "Saving…" : ACTION_META[activeAction].label}</Button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {detail.cancelledAt && <SectionCard icon={Ban} title="Cancellation"><ReadKV k="Cancelled" v={`${detail.cancelledByName ?? "—"} · ${new Date(detail.cancelledAt).toLocaleString()}${detail.cancellationReason ? ` — ${detail.cancellationReason}` : ""}`} /></SectionCard>}
    </div>
  );
}

function ReadKV({ k, v }: { k: string; v: string }) {
  return <div><p className="text-2xs font-semibold text-muted">{k}</p><p className="text-sm text-foreground">{v}</p></div>;
}
