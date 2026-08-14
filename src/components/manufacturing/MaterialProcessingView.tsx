"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Factory, ArrowLeft, Pencil, Play, CheckCircle2, Ban, Gauge, ScrollText, Clock, Layers, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { MaterialProcessingDto, MaterialProcessingStatus } from "@/lib/contracts/materialProcessing";

const STATUS_TONE: Record<MaterialProcessingStatus, "neutral" | "warning" | "success" | "danger"> = {
  Draft: "neutral", InProgress: "warning", Completed: "success", Cancelled: "danger",
};
const STATUS_LABEL: Record<MaterialProcessingStatus, string> = { Draft: "Draft", InProgress: "In Progress", Completed: "Completed", Cancelled: "Cancelled" };
const n = (v: string) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r3 = (v: number) => +v.toFixed(3);

export function MaterialProcessingView() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const toast = useToast();
  const [data, setData] = useState<MaterialProcessingDto | null>(null);
  const [loading, setLoading] = useState(true);

  const [initiateOpen, setInitiateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [finalQty, setFinalQty] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const j = await fetch(`/api/manufacturing/material-processing/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data); else toast.error(j?.message || "Could not load this transaction.");
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function openComplete() {
    if (!data) return;
    const init: Record<number, string> = {};
    for (const o of data.outputs) init[o.id] = String(o.actualQuantity);
    setFinalQty(init);
    setCompleteOpen(true);
  }

  async function doInitiate() {
    setBusy(true);
    const j = await fetch(`/api/manufacturing/material-processing/${id}/initiate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()).catch(() => ({}));
    setBusy(false); setInitiateOpen(false);
    if (j.ok) { toast.success(j.message || "Initiated."); load(); } else toast.error(j.message || "Could not initiate.");
  }
  async function doCancel() {
    setBusy(true);
    const j = await fetch(`/api/manufacturing/material-processing/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: cancelReason || null }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false); setCancelOpen(false); setCancelReason("");
    if (j.ok) { toast.success(j.message || "Cancelled."); load(); } else toast.error(j.message || "Could not cancel.");
  }
  async function doComplete() {
    if (!data) return;
    setBusy(true);
    const payload = { outputs: data.outputs.map((o) => ({ id: o.id, finalActualQuantity: n(finalQty[o.id] ?? "0") })) };
    const j = await fetch(`/api/manufacturing/material-processing/${id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Completed."); setCompleteOpen(false); load(); } else toast.error(j.message || "Could not complete.");
  }

  const completeTotals = useMemo(() => {
    if (!data) return { input: 0, output: 0, loss: 0 };
    const output = r3(data.outputs.reduce((s, o) => s + n(finalQty[o.id] ?? "0"), 0));
    return { input: data.inputQuantity, output, loss: r3(data.inputQuantity - output) };
  }, [data, finalQty]);

  if (loading) return <div className="py-16"><AppLoader label="Loading Material Processing…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Transaction not found. <Link href="/manufacturing/material-processing" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  const wipMovements = data.ledgerMovements.filter((m) => m.txnType.startsWith("MP_WIP"));
  const otherMovements = data.ledgerMovements.filter((m) => !m.txnType.startsWith("MP_WIP"));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/manufacturing/material-processing" className="hover:text-foreground">Material Processing</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{data.processingNumber}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Factory className="h-5 w-5 text-primary" /> {data.processingNumber} <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/manufacturing/material-processing"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {data.status === "Draft" && (
            <>
              <Link href={`/manufacturing/material-processing/new?id=${data.id}`}><Button variant="outline" size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>
              <Button size="md" onClick={() => setInitiateOpen(true)}><Play className="h-4 w-4" /> Initiate Process</Button>
              <Button variant="danger" size="md" onClick={() => setCancelOpen(true)}><Ban className="h-4 w-4" /> Cancel</Button>
            </>
          )}
          {data.status === "InProgress" && (
            <>
              <Button size="md" onClick={openComplete}><CheckCircle2 className="h-4 w-4" /> Complete Process</Button>
              <Button variant="danger" size="md" onClick={() => setCancelOpen(true)}><Ban className="h-4 w-4" /> Cancel</Button>
            </>
          )}
        </div>
      </div>

      <SectionCard icon={Factory} title="Processing Summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KV k="Branch" v={data.branchName} />
          <KV k="Processing Area" v={data.processingAreaName} />
          <KV k="Processing Unit" v={data.processingUnit || "—"} />
          <KV k="Processing Date" v={data.processingDate} />
          <KV k="Processing Set" v={`${data.processingSetCode} - ${data.processingSetName}`} />
          <KV k="Status" v="" custom={<Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>} />
          {data.fgReceiptNo && <KV k="FG Receipt No" v={data.fgReceiptNo} />}
        </div>
      </SectionCard>

      <SectionCard icon={Gauge} title="Raw Material Input">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KV k="Raw Material" v={`${data.rawMaterialName}${data.rawMaterialSku ? ` (${data.rawMaterialSku})` : ""}`} />
          <KV k="Source Storage Area" v={data.sourceAreaName} />
          <KV k="Processing / Input Quantity" v={`${data.inputQuantity} ${data.inputUom}`} />
          {data.status !== "Draft" && <KV k="WIP" v={data.status === "InProgress" ? `${data.inputQuantity} ${data.inputUom}` : "0 (cleared)"} />}
        </div>
      </SectionCard>

      <SectionCard icon={Layers} title="Output Configuration / Actual Output" allowOverflow>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-2.5">Finished Good</th>
                <th className="px-4 py-2.5 text-right">Configured %</th>
                <th className="px-4 py-2.5 text-right">Actual %</th>
                <th className="px-4 py-2.5 text-right">Actual Qty</th>
                {data.status === "Completed" && <th className="px-4 py-2.5 text-right">Final Qty</th>}
                {data.status === "Completed" && <th className="px-4 py-2.5 text-right">Variance</th>}
                <th className="px-4 py-2.5">Output Area</th>
              </tr>
            </thead>
            <tbody>
              {data.outputs.map((o) => {
                const variance = o.finalActualQuantity != null ? r3(o.finalActualQuantity - o.actualQuantity) : null;
                return (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5"><div className="font-medium text-foreground">{o.productName}</div><div className="font-mono text-2xs text-subtle">{o.productSku}</div></td>
                    <td className="px-4 py-2.5 text-right text-muted">{o.configuredPercentage != null ? `${o.configuredPercentage}%` : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{o.actualPercentage}%</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground">{o.actualQuantity}</td>
                    {data.status === "Completed" && <td className="px-4 py-2.5 text-right font-semibold text-foreground">{o.finalActualQuantity}</td>}
                    {data.status === "Completed" && <td className={cn("px-4 py-2.5 text-right font-semibold", variance == null || variance === 0 ? "text-muted" : variance > 0 ? "text-success" : "text-danger")}>{variance != null ? (variance > 0 ? `+${variance}` : variance) : "—"}</td>}
                    <td className="px-4 py-2.5 text-muted">{o.outputAreaName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>Total Actual Output Qty: <strong className="text-foreground">{r3(data.outputs.reduce((s, o) => s + o.actualQuantity, 0))}</strong></span>
          {data.status === "Completed" && <span>Total Input: <strong className="text-foreground">{data.inputQuantity}</strong></span>}
          {data.status === "Completed" && <span>Total Output: <strong className="text-foreground">{data.finalOutputQty}</strong></span>}
          {data.status === "Completed" && <span>Process Loss / Unaccounted: <strong className={cn(data.processLossQty && data.processLossQty > 0 ? "text-warning" : "text-foreground")}>{data.processLossQty}</strong></span>}
        </div>
      </SectionCard>

      {(wipMovements.length > 0 || otherMovements.length > 0) && (
        <SectionCard icon={ScrollText} title="Inventory Movement">
          <MovementTable rows={otherMovements} empty="No inventory movement yet." />
        </SectionCard>
      )}
      {wipMovements.length > 0 && (
        <SectionCard icon={Gauge} title="WIP Movement">
          <MovementTable rows={wipMovements} empty="No WIP movement yet." />
        </SectionCard>
      )}

      {data.fgReceiptNo && (
        <SectionCard icon={ReceiptText} title="Finished Goods Receipt">
          <p className="mb-2 text-sm text-muted">Receipt <span className="font-mono font-semibold text-foreground">{data.fgReceiptNo}</span> — Reference <span className="font-mono font-semibold text-foreground">{data.processingNumber}</span> — Source: Material Processing.</p>
          <MovementTable rows={data.ledgerMovements.filter((m) => m.txnType === "MP_RECEIPT")} empty="No receipt yet." />
        </SectionCard>
      )}

      <SectionCard icon={Clock} title="Processing Timeline">
        <ol className="space-y-2 text-sm">
          <TimelineStep done label="Created" who={data.createdByName} at={data.createdAt} />
          <TimelineStep done={!!data.initiatedAt} label="Initiated — Raw Material moved to WIP" who={data.initiatedByName} at={data.initiatedAt} />
          <TimelineStep done={!!data.completedAt} label="Processing Completed — WIP cleared, FG Receipt created" who={data.completedByName} at={data.completedAt} />
          {data.cancelledAt && <TimelineStep done label="Cancelled" who={data.cancelledByName} at={data.cancelledAt} tone="danger" />}
        </ol>
      </SectionCard>

      <SectionCard icon={ScrollText} title="Audit Trail">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KV k="Created By" v={`${data.createdByName ?? "—"} — ${new Date(data.createdAt).toLocaleString()}`} />
          <KV k="Initiated By" v={data.initiatedAt ? `${data.initiatedByName ?? "—"} — ${new Date(data.initiatedAt).toLocaleString()}` : "—"} />
          <KV k="Completed By" v={data.completedAt ? `${data.completedByName ?? "—"} — ${new Date(data.completedAt).toLocaleString()}` : "—"} />
          {data.cancelledAt && <KV k="Cancelled By" v={`${data.cancelledByName ?? "—"} — ${new Date(data.cancelledAt).toLocaleString()}`} />}
          {data.cancelReason && <KV k="Cancel Reason" v={data.cancelReason} />}
          <KV k="Last Updated" v={new Date(data.updatedAt).toLocaleString()} />
        </div>
      </SectionCard>

      {initiateOpen && (
        <ConfirmModal title="Initiate Material Processing?" busy={busy} confirmLabel="Initiate Process" onCancel={() => setInitiateOpen(false)} onConfirm={doInitiate}>
          <SummaryBlock data={data} />
          <p className="mt-2 text-2xs text-subtle">Raw material stock will move from the source area into WIP.</p>
        </ConfirmModal>
      )}

      {cancelOpen && (
        <ConfirmModal title="Cancel Material Processing?" busy={busy} confirmLabel="Confirm Cancel" danger onCancel={() => setCancelOpen(false)} onConfirm={doCancel}>
          <p className="text-sm text-muted">{data.status === "InProgress" ? "Any raw material already moved to WIP will be returned to its source area." : "This draft has no stock impact yet."}</p>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (optional)" rows={2} className="mt-2 h-auto w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </ConfirmModal>
      )}

      {completeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !busy && setCompleteOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-5 py-3"><h3 className="text-base font-bold text-foreground">Complete Process — {data.processingNumber}</h3><p className="text-2xs text-muted">Enter the final actual output for each Finished Good.</p></div>
            <div className="p-5">
              <div className="mb-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"><span className="text-muted">Input: </span><strong className="text-foreground">{data.inputQuantity} {data.inputUom}</strong></div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                      <th className="px-3 py-2">FG Product</th><th className="px-3 py-2 text-right">Planned Qty</th><th className="px-3 py-2 text-right w-32">Actual Qty</th><th className="px-3 py-2 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outputs.map((o) => {
                      const val = n(finalQty[o.id] ?? "0");
                      const variance = r3(val - o.actualQuantity);
                      return (
                        <tr key={o.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground">{o.productName}</td>
                          <td className="px-3 py-2 text-right text-muted">{o.actualQuantity}</td>
                          <td className="px-3 py-2"><input type="number" min={0} step="any" value={finalQty[o.id] ?? ""} onChange={(e) => setFinalQty((p) => ({ ...p, [o.id]: e.target.value }))} className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                          <td className={cn("px-3 py-2 text-right font-semibold", variance === 0 ? "text-muted" : variance > 0 ? "text-success" : "text-danger")}>{variance > 0 ? `+${variance}` : variance}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
                <span>Total Input: <strong className="text-foreground">{completeTotals.input}</strong></span>
                <span>Total Output: <strong className="text-foreground">{completeTotals.output}</strong></span>
                <span className={cn("font-semibold", completeTotals.loss > 0.001 ? "text-warning" : "text-muted")}>Process Loss / Unaccounted: {completeTotals.loss}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
              <Button variant="outline" size="md" disabled={busy} onClick={() => setCompleteOpen(false)}>Cancel</Button>
              <Button size="md" disabled={busy} onClick={doComplete}>{busy ? "Please wait…" : "Complete Process"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBlock({ data }: { data: MaterialProcessingDto }) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-surface-2 p-3 text-sm">
      <div className="flex justify-between"><span className="text-muted">Raw Material</span><span className="font-semibold text-foreground">{data.rawMaterialName}</span></div>
      <div className="flex justify-between"><span className="text-muted">Processing Quantity</span><span className="font-semibold text-foreground">{data.inputQuantity} {data.inputUom}</span></div>
      <div className="flex justify-between"><span className="text-muted">Processing Area</span><span className="font-semibold text-foreground">{data.processingAreaName}</span></div>
      <div className="flex justify-between"><span className="text-muted">Expected/Actual Outputs</span><span className="font-semibold text-foreground">{data.outputs.length} products</span></div>
    </div>
  );
}

function ConfirmModal({ title, children, busy, confirmLabel, danger, onCancel, onConfirm }: { title: string; children: React.ReactNode; busy: boolean; confirmLabel: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !busy && onCancel()}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4"><h3 className="text-base font-bold text-foreground">{title}</h3><div className="mt-2">{children}</div></div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="outline" size="md" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} size="md" disabled={busy} onClick={onConfirm}>{busy ? "Please wait…" : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function MovementTable({ rows, empty }: { rows: MaterialProcessingDto["ledgerMovements"]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
            <th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Warehouse / Area</th><th className="px-3 py-2 text-right">In</th><th className="px-3 py-2 text-right">Out</th><th className="px-3 py-2 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2 text-muted">{m.txnDate}</td>
              <td className="px-3 py-2"><Badge tone="info">{m.txnType.replace(/^MP_/, "").replace(/_/g, " ")}</Badge></td>
              <td className="px-3 py-2 text-foreground">{m.productName}</td>
              <td className="px-3 py-2 text-muted">{m.warehouse}{m.areaName ? ` · ${m.areaName}` : ""}</td>
              <td className="px-3 py-2 text-right text-success">{m.direction === "IN" ? m.qty : "—"}</td>
              <td className="px-3 py-2 text-right text-danger">{m.direction === "OUT" ? m.qty : "—"}</td>
              <td className="px-3 py-2 text-right text-muted">{m.value != null ? m.value.toFixed(2) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineStep({ done, label, who, at, tone }: { done: boolean; label: string; who: string | null; at: string | null; tone?: "danger" }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-2xs font-bold", done ? (tone === "danger" ? "bg-danger text-white" : "bg-success text-white") : "bg-surface-2 text-subtle")}>{done ? "✓" : "—"}</span>
      <div><p className={cn("font-medium", done ? "text-foreground" : "text-subtle")}>{label}</p>{at && <p className="text-2xs text-subtle">{who ?? "—"} — {new Date(at).toLocaleString()}</p>}</div>
    </li>
  );
}

function KV({ k, v, custom }: { k: string; v: string; custom?: React.ReactNode }) {
  return <div><p className="text-2xs font-semibold uppercase tracking-wide text-subtle">{k}</p>{custom ?? <p className="text-sm font-medium text-foreground">{v}</p>}</div>;
}
