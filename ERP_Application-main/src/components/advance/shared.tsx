"use client";

import { useEffect, useState } from "react";
import { X, HandCoins, Undo2, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
export const STATUS_TONE: Record<string, Tone> = {
  Draft: "neutral", Pending: "warning", Approved: "info", Rejected: "danger",
  Collected: "primary", Paid: "primary", "Partially Settled": "warning", "Fully Settled": "success", Refunded: "info", Cancelled: "danger", Closed: "neutral",
};
export const APPROVAL_TONE: Record<string, Tone> = { Draft: "neutral", Pending: "warning", Approved: "success", Rejected: "danger", Returned: "warning" };

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold uppercase tracking-wide text-subtle";

export interface PickAdvance { id: number; advanceNo: string; direction: "received" | "paid"; partyName: string; balanceAmount: number; advanceTypeName: string }

function useOpenAdvances(enabled: boolean) {
  const [rows, setRows] = useState<PickAdvance[]>([]);
  useEffect(() => {
    if (!enabled) return;
    fetch("/api/finance/advance?status=All", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok) setRows(j.rows.filter((a: { balanceAmount: number; status: string }) => a.balanceAmount > 0 && ["Collected", "Paid", "Partially Settled"].includes(a.status)));
    }).catch(() => {});
  }, [enabled]);
  return rows;
}

function AdvanceSelect({ value, onPick }: { value: PickAdvance | null; onPick: (a: PickAdvance) => void }) {
  const fmt = useFmt();
  const rows = useOpenAdvances(!value);
  const [q, setQ] = useState("");
  if (value) return <div className="rounded-lg bg-primary-subtle/40 px-3 py-2 text-sm"><span className="font-semibold text-foreground">{value.advanceNo}</span> · {value.partyName || "—"} · Balance <span className="font-semibold">{fmt.money(value.balanceAmount)}</span></div>;
  const hits = rows.filter((a) => !q.trim() || a.advanceNo.toLowerCase().includes(q.toLowerCase()) || (a.partyName ?? "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an open advance (no / party)…" className={cn(inp, "pl-8")} /></div>
      <div className="mt-1 max-h-44 overflow-auto rounded-lg border border-border">
        {hits.length === 0 ? <div className="px-3 py-3 text-center text-2xs text-muted">No open advances with a balance.</div> :
          hits.map((a) => <button key={a.id} onClick={() => onPick(a)} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40"><span className="min-w-0"><span className="block font-mono text-xs font-semibold text-primary">{a.advanceNo}</span><span className="block text-2xs text-subtle">{a.partyName || "—"} · {a.advanceTypeName}</span></span><span className="shrink-0 text-sm font-semibold text-foreground">{fmt.money(a.balanceAmount)}</span></button>)}
      </div>
    </div>
  );
}

function Modal({ title, icon: Icon, onClose, children, footer }: { title: string; icon: typeof HandCoins; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="my-8 w-full max-w-md rounded-2xl border border-border bg-card shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-primary-subtle/30 px-5 py-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold text-foreground">{title}</h2></div><button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 p-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
      </div>
    </div>
  );
}

export function SettleModal({ advance, onClose, onDone }: { advance?: PickAdvance; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [picked, setPicked] = useState<PickAdvance | null>(advance ?? null);
  const [amount, setAmount] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [refInvoice, setRefInvoice] = useState(""); const [refDocType, setRefDocType] = useState(""); const [method, setMethod] = useState("Manual");
  const [expenseAccountCode, setExpenseAccountCode] = useState(""); const [busy, setBusy] = useState(false);
  const isPaidEmployee = picked?.direction === "paid";

  async function save() {
    if (!picked) return toast.error("Select an advance.");
    if (!(Number(amount) > 0)) return toast.error("Enter a settlement amount.");
    setBusy(true);
    const j = await fetch("/api/finance/advance/settlement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ advanceId: picked.id, settlementDate: date, settlementAmount: Number(amount), refInvoice, refDocType: refDocType || undefined, method, expenseAccountCode: expenseAccountCode || undefined, autoApprove: true }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message); onDone(); onClose(); } else toast.error(j.message || "Failed.");
  }
  return (
    <Modal title="New Settlement" icon={HandCoins} onClose={onClose} footer={<><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Post Settlement"}</Button></>}>
      <div><label className={lbl}>Advance</label><AdvanceSelect value={picked} onPick={setPicked} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Settlement Amount</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} placeholder="0.00" /></div>
        <div><label className={lbl}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Reference Invoice</label><input value={refInvoice} onChange={(e) => setRefInvoice(e.target.value)} className={inp} placeholder="INV-0001" /></div>
        <div><label className={lbl}>Method</label><select value={method} onChange={(e) => setMethod(e.target.value)} className={inp}><option>Manual</option><option>Automatic</option></select></div>
        {isPaidEmployee && <div className="col-span-2"><label className={lbl}>Expense Account (for employee/expense settlement)</label><input value={expenseAccountCode} onChange={(e) => setExpenseAccountCode(e.target.value)} className={inp} placeholder="4200 (default: Accounts Payable)" /></div>}
      </div>
      <p className="text-2xs text-subtle">Posts a settlement journal and reduces the advance balance. {isPaidEmployee ? "Paid advances settle against an expense (if an account is given) or Accounts Payable." : "Customer advances settle against Accounts Receivable."}</p>
    </Modal>
  );
}

export function RefundModal({ advance, onClose, onDone }: { advance?: PickAdvance; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [picked, setPicked] = useState<PickAdvance | null>(advance ?? null);
  const [amount, setAmount] = useState(""); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("Bank"); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    if (!picked) return toast.error("Select an advance.");
    if (!(Number(amount) > 0)) return toast.error("Enter a refund amount.");
    setBusy(true);
    const j = await fetch("/api/finance/advance/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ advanceId: picked.id, refundDate: date, refundAmount: Number(amount), refundMode: mode, reason, autoApprove: true }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message); onDone(); onClose(); } else toast.error(j.message || "Failed.");
  }
  return (
    <Modal title="New Refund" icon={Undo2} onClose={onClose} footer={<><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Post Refund"}</Button></>}>
      <div><label className={lbl}>Advance</label><AdvanceSelect value={picked} onPick={setPicked} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Refund Amount</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} placeholder="0.00" /></div>
        <div><label className={lbl}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Refund Mode</label><select value={mode} onChange={(e) => setMode(e.target.value)} className={inp}>{["Cash", "Bank", "UPI", "Cheque"].map((m) => <option key={m}>{m}</option>)}</select></div>
        <div><label className={lbl}>Reason</label><input value={reason} onChange={(e) => setReason(e.target.value)} className={inp} /></div>
      </div>
    </Modal>
  );
}
