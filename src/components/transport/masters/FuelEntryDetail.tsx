"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fuel, ArrowLeft, Ban, FileText, Calculator } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { USAGE_TYPE_OPTS, type FuelEntryDetail as FuelEntryDetailT } from "@/lib/contracts/fuelManagement";

const TXN_TONE: Record<string, "neutral" | "success" | "danger"> = { Draft: "neutral", Confirmed: "success", Cancelled: "danger" };
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";

/** New Fuel Purchase's own view page — mirrors FuelEntryForm.tsx's section
 * layout and fields exactly (Basic Details / Quantity & Cost / Additional
 * Costs / Accounting + Payment side by side), just rendered read-only. */
export function FuelEntryDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<FuelEntryDetailT | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => fetch(`/api/transport/fuel-entry/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setDetail(j.row); }).catch(() => {});
  useEffect(() => { load(); }, [id]);

  async function cancel() {
    if (!reason.trim()) { toast.error("A reason is required."); return; }
    setBusy(true);
    const j = await fetch(`/api/transport/fuel-entry/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancellationReason: reason }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Cancelled."); setCancelling(false); load(); } else toast.error(j.message || "Could not cancel.");
  }

  if (!detail) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/masters/transport/fuel-management" className="hover:text-foreground">Fuel Management</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{detail.entryNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Fuel className="h-5 w-5 text-primary" /> {detail.entryNo}<Badge tone={TXN_TONE[detail.status] ?? "neutral"}>{detail.status}</Badge></h1>
          <p className="mt-0.5 text-sm text-muted">{detail.usageType === "storage" ? `Storage (Barrel/Drum) · ${detail.tankName}` : detail.vehicleNo} · {detail.fuelType}</p>
        </div>
        <Button variant="outline" size="md" onClick={() => router.push("/masters/transport/fuel-management")}><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>

      <SectionCard icon={Fuel} title="Basic Details">
        <div className="mb-3">
          <label className={lbl}>Purchased For</label>
          <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
            {(USAGE_TYPE_OPTS).map((u) => (
              <span key={u} className={cn("px-3 py-2 font-semibold", detail.usageType === u ? "bg-primary text-white" : "bg-surface text-muted")}>
                {u === "vehicle" ? "Vehicle Usage" : "Storage (Barrel/Drum)"}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RO label="Date *" value={detail.entryDate} />
          {detail.usageType === "vehicle" ? (
            <>
              <RO label="Vehicle *" value={detail.vehicleNo ?? "—"} />
              <RO label="Driver" value={detail.driverName ?? "— None —"} />
              <RO label="Trip (optional)" value={detail.tripNo ?? "— None —"} />
              <RO label="Odometer Reading (KM)" value={detail.odometer != null ? `${detail.odometer}` : "—"} />
            </>
          ) : (
            <RO label="Tank *" value={detail.tankName ?? "—"} />
          )}
          <RO label="Fuel Type" value={detail.fuelType} />
          <RO label="Supplier / Vendor" value={detail.fuelStationName ?? "— None —"} />
        </div>
      </SectionCard>

      <SectionCard icon={Fuel} title="Quantity & Cost">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RO label="Fuel Quantity *" value={`${detail.quantity}`} />
          <RO label="UOM" value={detail.uom} />
          <RO label="Rate (₹/L)" value={`${detail.rate}`} />
          <RO label="Expense Head" value={detail.headName ?? "— Default (Fuel Expense) —"} />
          <RO label="Remarks" value={detail.remarks ?? "—"} />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="text-muted">Fuel Amount</span><span className="font-bold text-foreground">₹{detail.amount.toFixed(2)}</span></div>
      </SectionCard>

      <SectionCard icon={Fuel} title="Additional Costs">
        {detail.lines.length === 0 ? <p className="text-2xs text-muted">No additional cost lines.</p> : (
          <div className="space-y-2">
            {detail.lines.map((l) => (
              <div key={l.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-2/30 p-2">
                <div className="min-w-[160px] flex-1"><RO label="Expense Head" value={l.headName ?? "—"} /></div>
                <div className="min-w-[180px] flex-1"><RO label="Description" value={l.description ?? "—"} /></div>
                <div className="w-32"><RO label="Amount (₹)" value={`${l.amount}`} /></div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard icon={FileText} title="Accounting">
          <div className="grid gap-3 sm:grid-cols-2">
            <RO label="Invoice/Bill No." value={detail.invoiceNo ?? "—"} />
            <RO label="Invoice Date" value={detail.invoiceDate ?? "—"} />
            <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm sm:col-span-2">
              <span className="text-foreground">GST Applicable</span>
              <input type="checkbox" checked={detail.gstApplicable} disabled className="h-4 w-4 accent-primary" />
            </label>
            {detail.gstApplicable && (
              <>
                <RO label="GST %" value={`${detail.gstPct ?? 0}`} />
                <RO label="Supplier GSTIN" value={detail.supplierGstin ?? "—"} />
              </>
            )}
          </div>

          <div className="mt-4">
            <label className={lbl}>Bill / Invoice Copy</label>
            {detail.attachments.length === 0 ? <p className="text-2xs text-muted">No bill copy uploaded.</p> : (
              <div className="space-y-1.5">
                {detail.attachments.map((a, i) => (
                  <a key={i} href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-1.5 text-sm text-foreground hover:text-primary">
                    <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted" /><span className="truncate">{a.fileName}</span></span>
                    {a.size ? <span className="shrink-0 text-2xs text-subtle">{(a.size / 1024).toFixed(0)} KB</span> : null}
                  </a>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={Fuel} title="Payment">
          <div>
            <label className={lbl}>Posting</label>
            <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
              <span className={cn("px-3 py-2 font-semibold", detail.postingType === "paynow" ? "bg-primary text-white" : "bg-surface text-muted")}>Pay Now</span>
              <span className={cn("px-3 py-2 font-semibold", detail.postingType === "ap" ? "bg-primary text-white" : "bg-surface text-muted")}>On Credit (Payable)</span>
            </div>
          </div>

          {detail.postingType === "ap" ? (
            <div className="mt-3 rounded-lg border border-info/30 bg-info-subtle/40 p-3 text-2xs text-info">Posted to Accounts Payable — supplier outstanding of ₹{detail.totalAmount.toFixed(2)}. Settle from Finance › Payables.</div>
          ) : (
            <div className="mt-3">
              <label className={lbl}>Payment Mode(s)</label>
              <div className="space-y-2">
                {detail.payments.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border bg-surface-2/40 p-2 text-sm">
                    <div className="flex items-center justify-between"><span className="font-semibold text-foreground">{p.mode}</span><span className="font-semibold text-foreground">₹{p.amount.toFixed(2)}</span></div>
                    {p.reference && <p className="mt-0.5 text-2xs text-muted">{p.reference}</p>}
                  </div>
                ))}
              </div>
              {detail.bankName && <p className="mt-2 text-2xs text-muted">Bank: {detail.bankName}{detail.bankAccount ? ` · ${detail.bankAccount}` : ""}</p>}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded-lg bg-primary-subtle/40 px-3 py-2.5 text-sm">
            <span className="font-semibold text-foreground">Total Amount</span>
            <span className="text-lg font-bold text-primary">₹{detail.totalAmount.toFixed(2)}</span>
          </div>
          {(detail.otherCost > 0 || detail.taxAmount > 0) && <p className="mt-1 text-2xs text-muted">₹{detail.amount.toFixed(2)} fuel + ₹{detail.taxAmount.toFixed(2)} GST + ₹{detail.otherCost.toFixed(2)} other</p>}

          <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-2xs font-bold text-foreground"><Calculator className="h-3.5 w-3.5 text-primary" /> Accounting Posting Preview</div>
            <div className="space-y-0.5 text-2xs">
              {[
                { a: "Fuel / Expense Head", dr: detail.amount + detail.otherCost, cr: 0 },
                { a: "Input GST (ITC)", dr: detail.taxAmount, cr: 0 },
                detail.postingType === "ap" ? { a: "Supplier Payable", dr: 0, cr: detail.totalAmount } : { a: "Cash / Bank", dr: 0, cr: detail.totalAmount },
              ].filter((x) => x.dr > 0.001 || x.cr > 0.001).map((x, i) => (
                <div key={i} className="flex justify-between"><span className="text-muted">{x.a}</span><span className="tabular-nums text-foreground">{x.dr > 0 ? `Dr ₹${x.dr.toFixed(2)}` : `Cr ₹${x.cr.toFixed(2)}`}</span></div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {detail.usageType === "vehicle" && (
        <SectionCard icon={Fuel} title="Fuel Efficiency">
          <div className="grid gap-3 sm:grid-cols-2">
            <RO label="Distance Since Previous Fill" value={detail.distanceSincePrev != null ? `${detail.distanceSincePrev} KM` : "Insufficient data"} />
            <RO label="Efficiency" value={detail.efficiency != null ? `${detail.efficiency} KM/L` : "Insufficient data"} />
          </div>
        </SectionCard>
      )}

      {detail.status === "Confirmed" && (
        <SectionCard icon={Ban} title="Cancel Entry">
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
