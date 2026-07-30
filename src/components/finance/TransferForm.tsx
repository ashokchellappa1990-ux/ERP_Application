"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Check, X, Paperclip, FileText, ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { TransferDetail, BudgetLogEntry } from "@/lib/contracts/budgetTxn";
import { BudgetTimeline, SnapshotCards, ApprovalBar, useTxnAttachments } from "@/components/finance/budgetTxnShared";

interface Snapshot { original: number; current: number; committed: number; actual: number; available: number }
interface Plan { id: number; label: string; status: string }
interface HeadSnap { headId: number; headName: string; snapshot: Snapshot | null }
const today = () => new Date().toISOString().slice(0, 10);

export function TransferForm({ id, mode }: { id?: number; mode: "add" | "view" }) {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const toast = useToast();
  const router = useRouter();

  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [timeline, setTimeline] = useState<BudgetLogEntry[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [headSnaps, setHeadSnaps] = useState<HeadSnap[]>([]);
  const [headerId, setHeaderId] = useState<number | null>(null);
  const [fromHeadId, setFromHeadId] = useState<number | null>(null);
  const [toHeadId, setToHeadId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [transferDate, setTransferDate] = useState(today);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const { attachments, uploading, upload, remove } = useTxnAttachments();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadView = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/finance/budget/transfer/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setDetail(j.detail); setTimeline(j.timeline); } else toast.show(j?.message || "Not found.", { type: "error" });
    setLoading(false);
  }, [id, toast]);
  const loadContext = useCallback(async (hid?: number) => {
    const url = hid ? `/api/finance/budget/txn-context?headerId=${hid}` : "/api/finance/budget/txn-context";
    const j = await fetch(url, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setPlans(j.plans); if (j.heads) setHeadSnaps(j.heads); }
    setLoading(false);
  }, []);
  useEffect(() => { if (mode === "view") loadView(); else loadContext(); }, [mode, loadView, loadContext]);

  const fromSnap = useMemo(() => headSnaps.find((h) => h.headId === fromHeadId)?.snapshot ?? null, [headSnaps, fromHeadId]);
  const toSnap = useMemo(() => headSnaps.find((h) => h.headId === toHeadId)?.snapshot ?? null, [headSnaps, toHeadId]);
  const amt = Number(amount) || 0;
  const overAvail = fromSnap != null && amt > fromSnap.available;
  const sameHead = fromHeadId != null && fromHeadId === toHeadId;

  function pickPlan(hid: number) { setHeaderId(hid); setFromHeadId(null); setToHeadId(null); setHeadSnaps([]); setLoading(true); loadContext(hid); }

  async function submit() {
    if (!headerId || !fromHeadId || !toHeadId) { toast.show("Select plan, source and destination heads.", { type: "error" }); return; }
    if (sameHead) { toast.show("Source and destination must differ.", { type: "error" }); return; }
    if (amt <= 0) { toast.show("Enter a transfer amount.", { type: "error" }); return; }
    if (overAvail) { toast.show("Amount exceeds source available budget.", { type: "error" }); return; }
    setBusy(true);
    try {
      const j = await fetch("/api/finance/budget/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ headerId, fromHeadId, toHeadId, amount: amt, transferDate, effectiveDate, reason, remarks, attachments }) }).then((r) => r.json());
      if (j.ok) { toast.show(j.message || "Submitted.", { type: "success" }); router.push(`/finance/budget/transfer/${j.id}`); }
      else toast.show(j.message || "Could not submit.", { type: "error" });
    } catch { toast.show("Could not submit.", { type: "error" }); } finally { setBusy(false); }
  }
  async function decide(action: "approve" | "reject") {
    if (!detail) return;
    const rejectReason = action === "reject" ? window.prompt("Reason for rejection (optional):") ?? "" : undefined;
    setBusy(true);
    const j = await fetch(`/api/finance/budget/transfer/${detail.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, rejectReason }) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.show(j.message || "Done.", { type: "success" }); loadView(); } else toast.show(j.message || "Action failed.", { type: "error" });
  }

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>;

  if (mode === "view" && detail) {
    return (
      <div className="space-y-5">
        <Crumb title={detail.transferNo} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{detail.transferNo} <Badge tone={detail.status === "Approved" ? "success" : detail.status === "Rejected" ? "danger" : "warning"}>{detail.status}</Badge></h1>
          <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>{detail.status === "Pending" && <><Button size="sm" onClick={() => decide("approve")} disabled={busy}><Check className="h-4 w-4" /> Approve</Button><Button size="sm" variant="ghost" onClick={() => decide("reject")} disabled={busy}><X className="h-4 w-4" /> Reject</Button></>}</div>
        </div>
        <SectionCard title="General Information"><Info rows={[["Transfer No", detail.transferNo], ["Transfer Date", detail.transferDate], ["Financial Year", detail.fy], ["Scope", detail.scope === "branch" ? `Branch — ${detail.branchName ?? ""}` : "Company"], ["Effective Date", detail.effectiveDate ?? "—"], ["Amount", inr(detail.amount)]]} /></SectionCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Source (From)"><div className="mb-2 text-sm font-semibold text-foreground">{detail.fromHeadName}</div><SnapshotCards items={[["Previous", detail.fromPrevBudget], ["Transferred", detail.amount], ["New", detail.fromNewBudget]]} inr={inr} /></SectionCard>
          <SectionCard title="Destination (To)"><div className="mb-2 text-sm font-semibold text-foreground">{detail.toHeadName}</div><SnapshotCards items={[["Previous", detail.toPrevBudget], ["Received", detail.amount], ["New", detail.toNewBudget]]} inr={inr} /></SectionCard>
        </div>
        <SectionCard title="Transfer Details">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 font-semibold text-danger">{detail.fromHeadName}</span>
            <ArrowRight className="h-5 w-5 text-muted" />
            <span className="rounded-lg border border-success/30 bg-success-subtle px-3 py-2 font-semibold text-success">{detail.toHeadName}</span>
            <span className="text-lg font-bold text-foreground">{inr(detail.amount)}</span>
          </div>
          {detail.reason && <p className="mt-3 text-sm text-foreground"><span className="text-muted">Reason:</span> {detail.reason}</p>}
          {detail.remarks && <p className="mt-1 text-sm text-foreground"><span className="text-muted">Remarks:</span> {detail.remarks}</p>}
          {detail.attachments.length > 0 && <div className="mt-3 space-y-1">{detail.attachments.map((a, i) => <a key={i} href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline"><FileText className="h-4 w-4" />{a.fileName}</a>)}</div>}
        </SectionCard>
        <ApprovalBar requestedByName={detail.requestedByName} approvedByName={detail.approvedByName} status={detail.status} approvedAt={detail.approvedAt} rejectReason={detail.rejectReason} createdAt={detail.createdAt} />
        <SectionCard title="Budget Timeline"><BudgetTimeline entries={timeline} inr={inr} /></SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Crumb title="New Transfer" />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">New Budget Transfer</h1>
        <Button size="md" onClick={submit} disabled={busy || !fromHeadId || !toHeadId}><Save className="h-4 w-4" /> {busy ? "Submitting…" : "Submit for Approval"}</Button>
      </div>

      <SectionCard title="Budget Plan">
        <div className="max-w-md"><label className={lbl}>Budget Plan</label><select value={headerId ?? ""} onChange={(e) => pickPlan(Number(e.target.value))} className={inp}><option value="">Select plan…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.status}</option>)}</select></div>
      </SectionCard>

      {headerId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="From (Source)">
            <label className={lbl}>Expense Head</label>
            <select value={fromHeadId ?? ""} onChange={(e) => setFromHeadId(Number(e.target.value) || null)} className={inp}><option value="">Select head…</option>{headSnaps.map((h) => <option key={h.headId} value={h.headId} disabled={h.headId === toHeadId}>{h.headName}</option>)}</select>
            {fromSnap && <div className="mt-3"><SnapshotCards items={[["Current", fromSnap.current], ["Committed", fromSnap.committed], ["Actual", fromSnap.actual], ["Available", fromSnap.available]]} inr={inr} highlight="Available" /></div>}
          </SectionCard>
          <SectionCard title="To (Destination)">
            <label className={lbl}>Expense Head</label>
            <select value={toHeadId ?? ""} onChange={(e) => setToHeadId(Number(e.target.value) || null)} className={inp}><option value="">Select head…</option>{headSnaps.map((h) => <option key={h.headId} value={h.headId} disabled={h.headId === fromHeadId}>{h.headName}</option>)}</select>
            {toSnap && <div className="mt-3"><SnapshotCards items={[["Current", toSnap.current], ["Available", toSnap.available]]} inr={inr} highlight="Current" /></div>}
          </SectionCard>
        </div>
      )}

      {fromHeadId && toHeadId && !sameHead && fromSnap && (
        <SectionCard title="Transfer Details">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className={lbl}>Transfer Amount</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={cn(inp, overAvail && "border-danger")} /></div>
            <div><label className={lbl}>Transfer Date</label><input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Effective Date</label><input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={inp} /></div>
            <div><label className={lbl}>New Source Balance</label><div className={cn("flex h-9 items-center rounded-md border px-3 text-sm font-bold", overAvail ? "border-danger/40 bg-danger-subtle text-danger" : "border-border bg-surface-2/40 text-foreground")}>{inr(fromSnap.available - amt)}</div></div>
          </div>
          {overAvail && <p className="mt-2 text-2xs font-semibold text-danger">Amount exceeds the source's available budget ({inr(fromSnap.available)}).</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Transfer Reason</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className={inp} /></div>
            <div><label className={lbl}>Remarks</label><input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className={inp} /></div>
          </div>
          <div className="mt-3">
            <label className="cursor-pointer text-2xs font-semibold text-primary hover:underline"><Paperclip className="mr-0.5 inline h-3.5 w-3.5" />{uploading ? "Uploading…" : "Attach document"}<input type="file" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label>
            {attachments.length > 0 && <div className="mt-1.5 space-y-1">{attachments.map((a, i) => <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-1.5"><span className="flex items-center gap-2 text-sm text-foreground"><FileText className="h-4 w-4 text-muted" />{a.fileName}</span><button onClick={() => remove(i)} className="text-muted hover:text-danger"><X className="h-4 w-4" /></button></div>)}</div>}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
function Crumb({ title }: { title: string }) {
  return <div className="flex items-center gap-2 text-xs text-muted"><Link href="/finance/budget/transfer" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Budget Transfer</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{title}</span></div>;
}
function Info({ rows }: { rows: [string, string][] }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">{rows.map(([k, v]) => <div key={k}><dt className="text-2xs text-muted">{k}</dt><dd className="font-medium text-foreground">{v}</dd></div>)}</dl>;
}
