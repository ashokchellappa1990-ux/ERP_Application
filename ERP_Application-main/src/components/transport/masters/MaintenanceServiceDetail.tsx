"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Wrench, ArrowLeft, CheckCircle2, Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { MaintenanceDetail } from "@/lib/contracts/vehicleMaintenance";

const SERVICE_TONE: Record<string, "neutral" | "info" | "success" | "danger"> = { Draft: "neutral", InProgress: "info", Completed: "success", Cancelled: "danger" };
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";

export function MaintenanceServiceDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<MaintenanceDetail | null>(null);
  const [action, setAction] = useState<"complete" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [endOdometer, setEndOdometer] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [nextDueKm, setNextDueKm] = useState("");
  const [reason, setReason] = useState("");

  const load = () => fetch(`/api/transport/vehicle-maintenance/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setDetail(j.row); }).catch(() => {});
  useEffect(() => { load(); }, [id]);

  async function complete() {
    setBusy(true);
    const j = await fetch(`/api/transport/vehicle-maintenance/${id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ odometer: endOdometer ? Number(endOdometer) : undefined, nextDueDate: nextDueDate || undefined, nextDueKm: nextDueKm ? Number(nextDueKm) : undefined }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Completed."); setAction(null); load(); } else toast.error(j.message || "Could not complete.");
  }
  async function cancel() {
    if (!reason.trim()) { toast.error("A reason is required."); return; }
    setBusy(true);
    const j = await fetch(`/api/transport/vehicle-maintenance/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancellationReason: reason }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Cancelled."); setAction(null); load(); } else toast.error(j.message || "Could not cancel.");
  }

  if (!detail) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>;
  const canAct = detail.status === "Draft" || detail.status === "InProgress";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/vehicle-maintenance" className="hover:text-foreground">Vehicle Maintenance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{detail.maintenanceNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wrench className="h-5 w-5 text-primary" /> {detail.maintenanceNo}<Badge tone={SERVICE_TONE[detail.status] ?? "neutral"}>{detail.status}</Badge></h1>
          <p className="mt-0.5 text-sm text-muted">{detail.vehicleNo} · {detail.maintenanceType} ({detail.maintenanceCategory})</p>
        </div>
        <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/vehicle-maintenance")}><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>

      <SectionCard icon={Wrench} title="Service Details">
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadKV k="Vehicle" v={detail.vehicleNo} />
          <ReadKV k="Service Date" v={detail.serviceDate} />
          <ReadKV k="Odometer" v={detail.odometer != null ? `${detail.odometer} KM` : "—"} />
          <ReadKV k="Workshop" v={detail.workshopName ?? "—"} />
          <ReadKV k="Mechanic" v={detail.mechanic ?? "—"} />
          <ReadKV k="Next Due" v={`${detail.nextDueDate ?? "—"}${detail.nextDueKm != null ? ` · ${detail.nextDueKm} KM` : ""}`} />
        </div>
        {detail.description && <p className="mt-3 text-xs text-muted">Description: {detail.description}</p>}
        {detail.workPerformed && <p className="mt-1 text-xs text-muted">Work Performed: {detail.workPerformed}</p>}
      </SectionCard>

      {detail.items.length > 0 && (
        <SectionCard icon={Wrench} title="Spare Parts">
          <table className="w-full text-xs"><thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted"><th className="py-1.5 text-left">Item</th><th className="py-1.5 text-right">Qty</th><th className="py-1.5 text-right">Rate</th><th className="py-1.5 text-right">Amount</th></tr></thead>
            <tbody>{detail.items.map((i) => <tr key={i.id} className="border-b border-border/50 last:border-0"><td className="py-1.5">{i.itemName}</td><td className="py-1.5 text-right">{i.qty} {i.uom ?? ""}</td><td className="py-1.5 text-right">{i.rate}</td><td className="py-1.5 text-right font-semibold">{i.amount.toFixed(2)}</td></tr>)}</tbody>
          </table>
        </SectionCard>
      )}
      {detail.labour.length > 0 && (
        <SectionCard icon={Wrench} title="Labour Charges">
          <table className="w-full text-xs"><thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted"><th className="py-1.5 text-left">Description</th><th className="py-1.5 text-right">Hours</th><th className="py-1.5 text-right">Rate</th><th className="py-1.5 text-right">Amount</th></tr></thead>
            <tbody>{detail.labour.map((l) => <tr key={l.id} className="border-b border-border/50 last:border-0"><td className="py-1.5">{l.description}</td><td className="py-1.5 text-right">{l.hours ?? "—"}</td><td className="py-1.5 text-right">{l.rate}</td><td className="py-1.5 text-right font-semibold">{l.amount.toFixed(2)}</td></tr>)}</tbody>
          </table>
        </SectionCard>
      )}

      <SectionCard icon={Wrench} title="Cost Summary">
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <div className="flex justify-between text-muted"><span>Parts Cost</span><span>₹{detail.partsCost.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted"><span>Labour Cost</span><span>₹{detail.labourCost.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted"><span>Workshop Cost</span><span>₹{detail.workshopCost.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted"><span>Other Cost</span><span>₹{detail.otherCost.toFixed(2)}</span></div>
          <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold text-foreground"><span>Total Cost</span><span>₹{detail.totalCost.toFixed(2)}</span></div>
        </div>
      </SectionCard>

      {canAct && (
        <SectionCard icon={CheckCircle2} title="Manage Service Entry">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={action === "complete" ? "primary" : "outline"} onClick={() => setAction(action === "complete" ? null : "complete")}><CheckCircle2 className="h-4 w-4" /> Complete</Button>
            <Button size="sm" variant={action === "cancel" ? "danger" : "outline"} onClick={() => setAction(action === "cancel" ? null : "cancel")}><Ban className="h-4 w-4" /> Cancel</Button>
          </div>
          {action === "complete" && (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-2 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className={lbl}>Completion Odometer (KM)</label><input type="number" min={0} value={endOdometer} onChange={(e) => setEndOdometer(e.target.value)} placeholder={detail.odometer != null ? String(detail.odometer) : ""} className={inp} /></div>
                <div><label className={lbl}>Next Due Date</label><input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Next Due KM</label><input type="number" min={0} value={nextDueKm} onChange={(e) => setNextDueKm(e.target.value)} className={inp} /></div>
              </div>
              <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setAction(null)}>Close</Button><Button size="sm" onClick={complete} disabled={busy}>{busy ? "Saving…" : "Mark Completed"}</Button></div>
            </div>
          )}
          {action === "cancel" && (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-2 p-4">
              <div><label className={lbl}>Cancellation Reason *</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></div>
              <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setAction(null)}>Close</Button><Button size="sm" variant="danger" onClick={cancel} disabled={busy}>{busy ? "Saving…" : "Cancel Entry"}</Button></div>
            </div>
          )}
        </SectionCard>
      )}

      {detail.cancelledAt && (
        <SectionCard icon={Ban} title="Cancellation">
          <ReadKV k="Cancelled" v={`${detail.cancelledByName ?? "—"} · ${new Date(detail.cancelledAt).toLocaleString()}${detail.cancellationReason ? ` — ${detail.cancellationReason}` : ""}`} />
        </SectionCard>
      )}
    </div>
  );
}

function ReadKV({ k, v }: { k: string; v: string }) {
  return <div><p className="text-2xs font-semibold text-muted">{k}</p><p className="text-sm text-foreground">{v}</p></div>;
}
