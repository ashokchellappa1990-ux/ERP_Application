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
import type { FuelIssueDetail as FuelIssueDetailT } from "@/lib/contracts/fuelManagement";

const TXN_TONE: Record<string, "neutral" | "success" | "danger"> = { Draft: "neutral", Confirmed: "success", Cancelled: "danger" };
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";

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
          <p className="mt-0.5 text-sm text-muted">{detail.vehicleNo} · {detail.tankName} · Internal</p>
        </div>
        <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/fuel-management")}><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>

      <SectionCard icon={Fuel} title="Fuel Issue Details">
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadKV k="Date" v={detail.issueDate} />
          <ReadKV k="Tank" v={detail.tankName} />
          <ReadKV k="Vehicle" v={detail.vehicleNo} />
          <ReadKV k="Driver" v={detail.driverName ?? "—"} />
          <ReadKV k="Trip Reference" v={detail.tripNo ?? "—"} />
          <ReadKV k="Quantity" v={`${detail.quantity} L`} />
          <ReadKV k="Rate" v={`₹${detail.rate}`} />
          <ReadKV k="Amount" v={`₹${detail.amount.toLocaleString()}`} />
          <ReadKV k="Odometer" v={detail.odometer != null ? `${detail.odometer} KM` : "—"} />
          <ReadKV k="Dispenser" v={detail.dispenser ?? "—"} />
          <ReadKV k="Operator" v={detail.operator ?? "—"} />
        </div>
      </SectionCard>

      <SectionCard icon={Fuel} title="Fuel Efficiency">
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadKV k="Distance Since Previous Fill" v={detail.distanceSincePrev != null ? `${detail.distanceSincePrev} KM` : "Insufficient data"} />
          <ReadKV k="Efficiency" v={detail.efficiency != null ? `${detail.efficiency} KM/L` : "Insufficient data"} />
        </div>
      </SectionCard>

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
      {detail.cancelledAt && <SectionCard icon={Ban} title="Cancellation"><ReadKV k="Cancelled" v={`${detail.cancelledByName ?? "—"} · ${new Date(detail.cancelledAt).toLocaleString()}${detail.cancellationReason ? ` — ${detail.cancellationReason}` : ""}`} /></SectionCard>}
    </div>
  );
}

function ReadKV({ k, v }: { k: string; v: string }) {
  return <div><p className="text-2xs font-semibold text-muted">{k}</p><p className="text-sm text-foreground">{v}</p></div>;
}
