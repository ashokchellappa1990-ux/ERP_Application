"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Waypoints, ArrowLeft, CheckCircle2, Clock, PlayCircle, Truck as TruckIcon, MapPin,
  PauseCircle, PlayCircle as ResumeIcon, Ban, Undo2, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { TRIP_STATUS_LABEL, type TripDetail } from "@/lib/contracts/vehicleTrip";
import { TRIP_STATUS_TONE } from "@/components/transport/masters/VehicleTripList";

interface DriverOption { id: number; name: string }

const ACTION_TITLE: Record<string, string> = {
  start: "Start Trip", transit: "Mark In Transit", arrive: "Mark Arrived", complete: "Complete Trip",
  hold: "Put On Hold", resume: "Resume Trip", cancel: "Cancel Trip", return: "Return Trip",
};

function actionsFor(status: string): string[] {
  const list: string[] = [];
  if (status === "PLANNED" || status === "ASSIGNED") list.push("start");
  if (status === "STARTED") list.push("transit");
  if (status === "STARTED" || status === "IN_TRANSIT") list.push("arrive");
  if (status === "ARRIVED" || status === "IN_TRANSIT") list.push("complete");
  if (["ASSIGNED", "STARTED", "IN_TRANSIT", "ARRIVED"].includes(status)) list.push("hold");
  if (status === "ON_HOLD") list.push("resume");
  if (["PLANNED", "ASSIGNED", "STARTED", "IN_TRANSIT"].includes(status)) list.push("cancel");
  if (["STARTED", "IN_TRANSIT", "ARRIVED"].includes(status)) list.push("return");
  return list;
}

export function VehicleTripDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [startOdometer, setStartOdometer] = useState("");
  const [endOdometer, setEndOdometer] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [location, setLocation] = useState("");
  const [driverId, setDriverId] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");

  function resetActionForm() { setStartOdometer(""); setEndOdometer(""); setActualQty(""); setLocation(""); setDriverId(""); setRemarks(""); }

  const load = () => {
    fetch(`/api/transport/vehicle-trip/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { setDetail(j.row); setDriverId(j.row.driverId ?? ""); } }).catch(() => {});
  };
  useEffect(() => { load(); fetch("/api/transport/masters/driver?status=Active", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setDrivers(j.rows); }).catch(() => {}); }, [id]);

  async function submitAction() {
    if (!activeAction || !detail) return;
    if ((activeAction === "cancel" || activeAction === "return") && !remarks.trim()) { toast.error("A reason is required."); return; }
    setBusy(true);
    const body: Record<string, unknown> = { action: activeAction, remarks: remarks || undefined };
    if (activeAction === "start") { body.startOdometer = startOdometer ? Number(startOdometer) : undefined; body.sourceLocation = location || undefined; body.driverId = driverId || undefined; }
    if (activeAction === "transit") body.currentLocation = location || undefined;
    if (activeAction === "arrive") body.destinationLocation = location || undefined;
    if (activeAction === "complete") { body.endOdometer = endOdometer ? Number(endOdometer) : undefined; body.actualQty = actualQty ? Number(actualQty) : undefined; }
    const j = await fetch(`/api/transport/vehicle-trip/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Updated."); setActiveAction(null); resetActionForm(); load(); }
    else toast.error(j.message || "Could not update the trip.");
  }

  if (!detail) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>;

  const available = actionsFor(detail.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/vehicle-trip" className="hover:text-foreground">Vehicle Trip Management</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{detail.tripNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Waypoints className="h-5 w-5 text-primary" /> {detail.tripNo}<Badge tone={TRIP_STATUS_TONE[detail.status] ?? "neutral"}>{TRIP_STATUS_LABEL[detail.status as keyof typeof TRIP_STATUS_LABEL] ?? detail.status}</Badge></h1>
          <p className="mt-0.5 text-sm text-muted">{detail.tripType}{detail.tripPurpose ? ` · ${detail.tripPurpose}` : ""} · {detail.vehicleNo}{detail.driverName ? ` · ${detail.driverName}` : ""}</p>
        </div>
        <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/vehicle-trip")}><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>

      <SectionCard icon={Waypoints} title="Trip Details">
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadKV k="Vehicle" v={detail.vehicleNo} />
          <ReadKV k="Driver" v={detail.driverName ?? "—"} />
          <ReadKV k="Transporter" v={detail.transportCompanyName ?? "—"} />
          <ReadKV k="Material" v={detail.materialName ?? "—"} />
          <ReadKV k="Planned Qty" v={detail.plannedQty != null ? `${detail.plannedQty} ${detail.uom ?? ""}` : "—"} />
          <ReadKV k="Actual Qty" v={detail.actualQty != null ? `${detail.actualQty} ${detail.uom ?? ""}` : "—"} />
          <ReadKV k="Source → Destination" v={`${detail.sourceLocation ?? "—"} → ${detail.destinationLocation ?? "—"}`} />
          <ReadKV k="Start Odometer (KM)" v={detail.startOdometer != null ? String(detail.startOdometer) : "—"} />
          <ReadKV k="End Odometer (KM)" v={detail.endOdometer != null ? String(detail.endOdometer) : "—"} />
          <ReadKV k="Trip Distance" v={detail.tripDistance != null ? `${detail.tripDistance} KM` : "—"} />
          <ReadKV k="Planned Start" v={detail.plannedStartAt ? new Date(detail.plannedStartAt).toLocaleString() : "—"} />
        </div>
        {detail.remarks && <p className="mt-3 text-xs text-muted">Remarks: {detail.remarks}</p>}
      </SectionCard>

      {(detail.linked.gateEntryNo || detail.linked.salesOrderNo || detail.linked.loadDispatchNo || detail.linked.grnNo || detail.linked.weighmentNetWeight != null) && (
        <SectionCard icon={Waypoints} title="Linked Documents">
          <div className="flex flex-wrap gap-2 text-2xs">
            {detail.linked.gateEntryNo && <Badge tone="neutral">Gate Entry {detail.linked.gateEntryNo}</Badge>}
            {detail.linked.salesOrderNo && <Badge tone="neutral">Sales Order {detail.linked.salesOrderNo}</Badge>}
            {detail.linked.loadDispatchNo && detail.linked.loadDispatchId && <Link href={`/warehouse/transfer/load-dispatch/${detail.linked.loadDispatchId}`} className="inline-block"><Badge tone="info">View Dispatch {detail.linked.loadDispatchNo}</Badge></Link>}
            {detail.linked.grnNo && detail.linked.grnId && <Link href={`/purchase/grn/${detail.linked.grnId}`} className="inline-block"><Badge tone="info">View GRN {detail.linked.grnNo}</Badge></Link>}
            {detail.linked.weighmentNetWeight != null && <Badge tone="neutral">Weighment Net {detail.linked.weighmentNetWeight} {detail.linked.weighmentUom}</Badge>}
          </div>
        </SectionCard>
      )}

      <SectionCard icon={Clock} title="Timeline">
        <div className="space-y-2">
          {detail.timeline.map((ev, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {ev.done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" /> : <Clock className="h-3.5 w-3.5 shrink-0 text-subtle" />}
              <span className={ev.done ? "font-medium text-foreground" : "text-subtle"}>{ev.label}</span>
              {ev.at && <span className="ml-auto text-2xs text-subtle">{new Date(ev.at).toLocaleString()}</span>}
            </div>
          ))}
        </div>
      </SectionCard>

      {available.length > 0 && (
        <SectionCard icon={PlayCircle} title="Manage Trip">
          <div className="flex flex-wrap gap-2">
            {available.map((a) => (
              <Button key={a} size="sm" variant={activeAction === a ? "primary" : "outline"} onClick={() => { setActiveAction(a === activeAction ? null : a); resetActionForm(); }}>
                {a === "start" && <PlayCircle className="h-4 w-4" />}
                {a === "transit" && <TruckIcon className="h-4 w-4" />}
                {a === "arrive" && <MapPin className="h-4 w-4" />}
                {a === "complete" && <CheckCircle2 className="h-4 w-4" />}
                {a === "hold" && <PauseCircle className="h-4 w-4" />}
                {a === "resume" && <ResumeIcon className="h-4 w-4" />}
                {a === "cancel" && <Ban className="h-4 w-4" />}
                {a === "return" && <Undo2 className="h-4 w-4" />}
                {ACTION_TITLE[a]}
              </Button>
            ))}
          </div>

          {activeAction && (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-2 p-4">
              <p className="text-sm font-bold text-foreground">{ACTION_TITLE[activeAction]}</p>
              {activeAction === "start" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label className={lbl}>Driver</label><select value={driverId} onChange={(e) => setDriverId(Number(e.target.value) || "")} className={inp}><option value="">— None —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <div><label className={lbl}>Starting Location</label><input value={location} onChange={(e) => setLocation(e.target.value)} className={inp} /></div>
                  <div><label className={lbl}><Gauge className="mr-1 inline h-3 w-3" />Start Odometer (KM)</label><input type="number" min={0} value={startOdometer} onChange={(e) => setStartOdometer(e.target.value)} className={inp} /></div>
                </div>
              )}
              {activeAction === "transit" && <div className="sm:w-1/2"><label className={lbl}>Current Location</label><input value={location} onChange={(e) => setLocation(e.target.value)} className={inp} /></div>}
              {activeAction === "arrive" && <div className="sm:w-1/2"><label className={lbl}>Destination</label><input value={location} onChange={(e) => setLocation(e.target.value)} className={inp} /></div>}
              {activeAction === "complete" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={lbl}><Gauge className="mr-1 inline h-3 w-3" />End Odometer (KM)</label><input type="number" min={0} value={endOdometer} onChange={(e) => setEndOdometer(e.target.value)} className={inp} /></div>
                  {detail.plannedQty != null && detail.actualQty == null && <div><label className={lbl}>Actual Quantity</label><input type="number" min={0} value={actualQty} onChange={(e) => setActualQty(e.target.value)} placeholder={`Planned: ${detail.plannedQty}`} className={inp} /></div>}
                </div>
              )}
              {activeAction !== "resume" && (
                <div><label className={lbl}>{(activeAction === "cancel" || activeAction === "return") ? "Reason *" : "Remarks"}</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></div>
              )}
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setActiveAction(null); resetActionForm(); }}>Cancel</Button>
                <Button size="sm" variant={activeAction === "cancel" || activeAction === "return" ? "danger" : "primary"} onClick={submitAction} disabled={busy}>{busy ? "Saving…" : ACTION_TITLE[activeAction]}</Button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard icon={Clock} title="Audit">
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadKV k="Created By" v={detail.createdByName ? `${detail.createdByName} · ${new Date(detail.createdAt).toLocaleString()}` : "—"} />
          <ReadKV k="Updated" v={detail.updatedByName ? `${detail.updatedByName} · ${new Date(detail.updatedAt).toLocaleString()}` : "—"} />
        </div>
      </SectionCard>
    </div>
  );
}

function ReadKV({ k, v }: { k: string; v: string }) {
  return <div><p className="text-2xs font-semibold text-muted">{k}</p><p className="text-sm text-foreground">{v}</p></div>;
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:bg-surface-2/40 disabled:text-muted";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
