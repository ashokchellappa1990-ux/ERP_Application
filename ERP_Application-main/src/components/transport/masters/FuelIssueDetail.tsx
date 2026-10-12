"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fuel, ArrowLeft, Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { TRANSFER_TYPE_OPTS, type FuelIssueDetail as FuelIssueDetailT } from "@/lib/contracts/fuelManagement";

const TXN_TONE: Record<string, "neutral" | "success" | "danger"> = { Draft: "neutral", Confirmed: "success", Cancelled: "danger" };
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";

/** Fuel Issue's own view page — mirrors FuelIssueForm.tsx's section layout
 * and fields exactly (Basic Details / Quantity & Cost), rendered read-only. */
export function FuelIssueDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<FuelIssueDetailT | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => fetch(`/api/transport/fuel-issue/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setDetail(j.row); }).catch(() => {});
  useEffect(() => { load(); }, [id]);

  async function cancel() {
    if (!reason.trim()) { toast.error("A reason is required."); return; }
    setBusy(true);
    const j = await fetch(`/api/transport/fuel-issue/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancellationReason: reason }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Cancelled."); setCancelling(false); load(); } else toast.error(j.message || "Could not cancel.");
  }

  if (!detail) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/fuel-management" className="hover:text-foreground">Fuel Management</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{detail.issueNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Fuel className="h-5 w-5 text-primary" /> {detail.issueNo}<Badge tone={TXN_TONE[detail.status] ?? "neutral"}>{detail.status}</Badge></h1>
          <p className="mt-0.5 text-sm text-muted">{detail.transferType === "tank_tank" ? `${detail.tankName} → ${detail.toTankName}` : `${detail.vehicleNo} · ${detail.tankName}`} · Internal</p>
        </div>
        <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/fuel-management")}><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>

      <SectionCard icon={Fuel} title="Basic Details">
        <div className="mb-3">
          <label className={lbl}>Transfer Type</label>
          <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
            {(TRANSFER_TYPE_OPTS).map((tt) => (
              <span key={tt} className={cn("px-3 py-2 font-semibold", detail.transferType === tt ? "bg-primary text-white" : "bg-surface text-muted")}>
                {tt === "tank_vehicle" ? "Tank to Vehicle" : "Tank to Tank"}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RO label="Date *" value={detail.issueDate} />
          <RO label={detail.transferType === "tank_tank" ? "From Tank *" : "Fuel Tank *"} value={detail.tankName} />
          {detail.transferType === "tank_tank" ? (
            <RO label="To Tank *" value={detail.toTankName ?? "—"} />
          ) : (
            <>
              <RO label="Vehicle *" value={detail.vehicleNo ?? "—"} />
              <RO label="Driver" value={detail.driverName ?? "— None —"} />
              <RO label="Trip (optional)" value={detail.tripNo ?? "— None —"} />
              <RO label="Odometer Reading (KM)" value={detail.odometer != null ? `${detail.odometer}` : "—"} />
              <RO label="Dispenser/Pump" value={detail.dispenser ?? "—"} />
              <RO label="Operator" value={detail.operator ?? "—"} />
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard icon={Fuel} title="Quantity & Cost">
        <div className="grid gap-3 sm:grid-cols-3">
          <RO label="Fuel Quantity (L) *" value={`${detail.quantity}`} />
          <RO label="Rate (₹/L)" value={`${detail.rate}`} />
          <RO label="Remarks" value={detail.remarks ?? "—"} />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="text-muted">Total Amount</span><span className="font-bold text-foreground">₹{detail.amount.toFixed(2)}</span></div>
      </SectionCard>

      {detail.transferType !== "tank_tank" && (
        <SectionCard icon={Fuel} title="Fuel Efficiency">
          <div className="grid gap-3 sm:grid-cols-2">
            <RO label="Distance Since Previous Fill" value={detail.distanceSincePrev != null ? `${detail.distanceSincePrev} KM` : "Insufficient data"} />
            <RO label="Efficiency" value={detail.efficiency != null ? `${detail.efficiency} KM/L` : "Insufficient data"} />
          </div>
        </SectionCard>
      )}

      {detail.status === "Confirmed" && (
        <SectionCard icon={Ban} title="Cancel Issue">
          {!cancelling ? <Button size="sm" variant="danger" onClick={() => setCancelling(true)}><Ban className="h-4 w-4" /> Cancel</Button> : (
            <div className="space-y-3">
              <div><label className={lbl}>Cancellation Reason *</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></div>
              <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setCancelling(false)}>Close</Button><Button size="sm" variant="danger" onClick={cancel} disabled={busy}>{busy ? "Saving…" : "Confirm Cancel"}</Button></div>
            </div>
          )}
        </SectionCard>
      )}
      {detail.cancelledAt && <SectionCard icon={Ban} title="Cancellation"><RO label="Cancelled" value={`${detail.cancelledByName ?? "—"} · ${new Date(detail.cancelledAt).toLocaleString()}${detail.cancellationReason ? ` — ${detail.cancellationReason}` : ""}`} /></SectionCard>}
    </div>
  );
}

/** Read-only field styled to match the add page's input boxes exactly. */
function RO({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <div className={cn(inp, "flex items-center bg-surface-2/40 text-foreground")}>{value}</div>
    </div>
  );
}
