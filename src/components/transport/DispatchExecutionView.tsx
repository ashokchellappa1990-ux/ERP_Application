"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, PackageCheck, CalendarClock, Boxes, FileText, XCircle, MessageSquare, Send, ScanLine, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { DispatchExecutionDetail as Exec } from "@/lib/contracts/transport";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const STATUS_TONE: Record<string, Tone> = { Draft: "neutral", "Vehicle Assigned": "primary", "Gate In": "info", Loading: "warning", Loaded: "warning", "Gate Out": "info", Completed: "success", Cancelled: "danger" };

export function DispatchExecutionView({ id }: { id: number }) {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const toast = useToast();
  const [data, setData] = useState<Exec | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<null | "assign-vehicle" | "cancel">(null);
  const [vehicleId, setVehicleId] = useState(""); const [driverId, setDriverId] = useState(""); const [transportCompanyId, setTransportCompanyId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const [scanCode, setScanCode] = useState(""); const [scanBusy, setScanBusy] = useState(false);
  const [highlightItemId, setHighlightItemId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const j = await fetch(`/api/transport/dispatch-execution/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!action) return;
    if (action === "assign-vehicle" && !vehicleId.trim()) { toast.error("Enter a vehicle id."); return; }
    setBusy(true);
    const payload: Record<string, unknown> = { action, remarks: remarks.trim() || undefined };
    if (action === "assign-vehicle") { payload.vehicleId = Number(vehicleId); if (driverId.trim()) payload.driverId = Number(driverId); if (transportCompanyId.trim()) payload.transportCompanyId = Number(transportCompanyId); }
    const j = await fetch(`/api/transport/dispatch-execution/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j?.ok) { toast.success(j.message); setAction(null); setRemarks(""); setVehicleId(""); setDriverId(""); setTransportCompanyId(""); await load(); } else toast.error(j?.message || "Action failed.");
  }

  async function scan() {
    if (!scanCode.trim()) return;
    setScanBusy(true);
    const j = await fetch(`/api/transport/dispatch-execution/${id}/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: scanCode.trim() }) }).then((r) => r.json()).catch(() => ({}));
    setScanBusy(false);
    if (j?.ok && j.resolved) {
      setHighlightItemId(j.matchedItemId ?? null);
      toast.success(j.matchedItemId ? "Matched an item on this dispatch." : "Code resolved, but no matching item on this dispatch.");
    } else toast.error(j?.message || "Code not recognised.");
    setScanCode("");
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading dispatch execution…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Dispatch execution not found. <Link href="/transport/dispatch-execution" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const x = data;

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between print:hidden">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/transport/dispatch-execution" className="hover:text-foreground">Dispatch Execution</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{x.docNo}</span></div>
          <div className="flex flex-wrap items-center gap-2.5"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageCheck className="h-5 w-5 text-primary" /> {x.docNo}</h1><Badge tone={STATUS_TONE[x.status] ?? "neutral"}>{x.status}</Badge><Badge tone="neutral">{x.docType}</Badge></div>
          <p className="mt-1 text-xs text-subtle">{x.partyName || x.sourceRefNo || "—"}{x.warehouse ? ` · ${x.warehouse}` : ""} — {x.items.length} item(s), {fmt.qty(x.totalQty)} qty.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/transport/dispatch-execution"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {x.status === "Draft" && action === null && <Button size="md" onClick={() => { setAction("assign-vehicle"); setRemarks(""); }}><Send className="h-4 w-4" /> Assign Vehicle</Button>}
          {!["Completed", "Cancelled"].includes(x.status) && action === null && <Button variant="danger" size="md" onClick={() => { setAction("cancel"); setRemarks(""); }}><XCircle className="h-4 w-4" /> Cancel</Button>}
        </div>
      </div>

      {action !== null && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">{action === "cancel" ? <XCircle className="h-4 w-4 text-danger" /> : <Send className="h-4 w-4 text-primary" />}{action === "assign-vehicle" ? "Assign a vehicle to this dispatch" : "Cancel this dispatch execution"}</div>
          {action === "assign-vehicle" && (
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <Fld label="Vehicle ID *"><input type="number" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={inp} /></Fld>
              <Fld label="Driver ID"><input type="number" value={driverId} onChange={(e) => setDriverId(e.target.value)} className={inp} /></Fld>
              <Fld label="Transport Company ID"><input type="number" value={transportCompanyId} onChange={(e) => setTransportCompanyId(e.target.value)} className={inp} /></Fld>
            </div>
          )}
          <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle"><MessageSquare className="h-3 w-3" /> Remarks{action === "cancel" ? " (reason)" : " (optional)"}</label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => setAction(null)} disabled={busy}>Dismiss</Button>
            <Button variant={action === "cancel" ? "danger" : "primary"} size="md" onClick={submit} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Working…" : "Confirm"}</Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Source" icon={FileText}>
          <KV k="Doc Type" v={x.docType} />
          <KV k="Source Ref" v={x.sourceRefNo ?? ""} />
          <KV k="Party" v={x.partyName ?? ""} />
          <KV k="Delivery Address" v={x.deliveryAddress ?? ""} />
        </Card>
        <Card title="Logistics" icon={CalendarClock}>
          <KV k="Doc Date" v={x.docDate} />
          <KV k="Warehouse" v={x.warehouse ?? ""} />
          <KV k="Vehicle ID" v={x.vehicleId != null ? String(x.vehicleId) : ""} />
          <KV k="Driver ID" v={x.driverId != null ? String(x.driverId) : ""} />
        </Card>
        <Card title="Value" icon={Boxes}>
          <KV k="Total Qty" v={fmt.qty(x.totalQty)} />
          <KV k="Total Value" v={inr(x.totalValue)} strong />
          <KV k="Created By" v={x.createdByName ?? ""} />
        </Card>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><ScanLine className="h-3.5 w-3.5" /> Scan / Verify Item</p>
        <div className="flex items-center gap-2">
          <input value={scanCode} onChange={(e) => setScanCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") scan(); }} placeholder="Scan a barcode / QR code to verify against this dispatch…" className="h-9 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none" autoFocus />
          <Button size="md" onClick={scan} disabled={scanBusy}>{scanBusy ? "Checking…" : "Scan"}</Button>
        </div>
        <p className="mt-1.5 text-2xs text-subtle">Lookup only — scanning does not post or change quantities.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><Boxes className="h-4 w-4 text-primary" /> Items</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Product</th><th className="px-4 py-3">Batch No</th><th className="px-4 py-3 text-right">Ordered</th><th className="px-4 py-3 text-right">Dispatched</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Value</th></tr></thead>
            <tbody>
              {x.items.map((l) => (
                <tr key={l.id} className={cn("border-b border-border last:border-0", highlightItemId === l.id && "bg-success-subtle/40")}>
                  <td className="px-4 py-3"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}{l.uom ? ` · ${l.uom}` : ""}</div></td>
                  <td className="px-4 py-3 text-2xs text-muted">{l.batchNo || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.qty(l.orderedQty)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt.qty(l.dispatchedQty)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{l.rate != null ? inr(l.rate) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{inr(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(x.remarks || x.cancelReason) && (
        <div className="grid gap-4 sm:grid-cols-2 print:hidden">
          {x.remarks && <NoteCard title="Remarks" body={x.remarks} />}
          {x.cancelReason && <NoteCard title="Cancellation Reason" body={x.cancelReason} />}
        </div>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
function Card({ title, icon: Icon, children }: { title: string; icon: typeof Boxes; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Icon className="h-3.5 w-3.5" /> {title}</p><div className="space-y-1 text-xs">{children}</div></div>;
}
function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  if (!v) return null;
  return <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span><span className={cn("text-right", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v}</span></div>;
}
function NoteCard({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</p><p className="whitespace-pre-line text-xs text-muted">{body}</p></div>;
}
