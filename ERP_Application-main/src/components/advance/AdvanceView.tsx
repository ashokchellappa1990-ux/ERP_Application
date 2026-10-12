"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, HandCoins, User, Landmark, Wallet, FileText, CheckCircle2, XCircle, Pencil, Trash2, Undo2, Printer, Boxes, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { STATUS_TONE, APPROVAL_TONE, SettleModal, RefundModal, type PickAdvance } from "./shared";
import { isPosted, type AdvanceDetail } from "@/lib/contracts/advance";

export function AdvanceView({ id }: { id: number }) {
  const router = useRouter();
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();
  const [data, setData] = useState<AdvanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settle, setSettle] = useState(false); const [refund, setRefund] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/finance/advance/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data); setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(action: string, note?: string) {
    setBusy(true);
    const j = await fetch(`/api/finance/advance/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message); await load(); } else toast.error(j.message || "Action failed.");
  }
  async function del() {
    if (!confirm("Delete this draft advance?")) return;
    const j = await fetch(`/api/finance/advance/${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { toast.success(j.message); router.push("/finance/advance"); } else toast.error(j.message || "Delete failed.");
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading advance…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Advance not found. <Link href="/finance/advance" className="font-semibold text-primary hover:underline">Back</Link></div>;
  const x = data;
  const pick: PickAdvance = { id: x.id, advanceNo: x.advanceNo, direction: x.direction, partyName: x.partyName, balanceAmount: x.balanceAmount, advanceTypeName: x.advanceTypeName };
  const open = isPosted(x.status) && x.balanceAmount > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance/advance" className="hover:text-foreground">Advance Transactions</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{x.advanceNo}</span></div>
          <div className="flex flex-wrap items-center gap-2.5"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><HandCoins className="h-5 w-5 text-primary" /> {x.advanceNo}</h1><Badge tone={STATUS_TONE[x.status] ?? "neutral"}>{x.status}</Badge><Badge tone={APPROVAL_TONE[x.approvalStatus] ?? "neutral"}>{x.approvalStatus}</Badge><Badge tone={x.direction === "received" ? "info" : "warning"}>{x.direction === "received" ? "Received" : "Paid"}</Badge></div>
          <p className="mt-1 text-xs text-subtle">{x.advanceTypeName} · {x.partyName || "—"} ({x.partyType}){x.refNo ? ` · Ref ${x.refNo}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/finance/advance"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button variant="outline" size="md" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          {x.status === "Draft" && <Link href={`/finance/advance/${id}/edit`}><Button variant="outline" size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
          {(x.status === "Draft" || x.status === "Pending") && <Button size="md" onClick={() => act("approve")} disabled={busy}><CheckCircle2 className="h-4 w-4" /> Approve</Button>}
          {x.status === "Pending" && <Button variant="danger" size="md" onClick={() => act("reject", "Rejected")} disabled={busy}><XCircle className="h-4 w-4" /> Reject</Button>}
          {open && <Button size="md" onClick={() => setSettle(true)}><HandCoins className="h-4 w-4" /> Settle</Button>}
          {open && <Button variant="outline" size="md" onClick={() => setRefund(true)}><Undo2 className="h-4 w-4" /> Refund</Button>}
          {["Draft", "Pending", "Collected", "Paid"].includes(x.status) && x.settledAmount === 0 && x.refundedAmount === 0 && <Button variant="danger" size="md" onClick={() => act("cancel", "Cancelled")} disabled={busy}><XCircle className="h-4 w-4" /> Cancel</Button>}
          {x.status === "Draft" && <Button variant="danger" size="md" onClick={del} disabled={busy}><Trash2 className="h-4 w-4" /> Delete</Button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card title="Party" icon={User}><KV k="Party" v={x.partyName} /><KV k="Type" v={x.partyType} /><KV k="Department" v={x.department} /><KV k="Reference" v={x.refNo} /></Card>
        <Card title="Advance" icon={FileText}><KV k="Date" v={x.advanceDate} /><KV k="Type" v={x.advanceTypeName} /><KV k="Direction" v={x.direction === "received" ? "Received (Liability)" : "Paid (Asset)"} /><KV k="GL Account" v={x.accountCode} /><KV k="Ref Doc" v={x.refDocType} /></Card>
        <Card title="Payment" icon={Landmark}><KV k="Mode" v={x.paymentMode} /><KV k="Reference" v={x.paymentRef} /><KV k="Currency" v={x.currency} /><KV k="Voucher" v={x.journalId ? `#${x.journalId}` : ""} /></Card>
        <Card title="Amounts" icon={Wallet}><KV k="Advance" v={money(x.advanceAmount)} /><KV k="Tax" v={money(x.taxAmount)} /><KV k="Net" v={money(x.netAmount)} strong /><div className="my-1 h-px bg-border" /><KV k="Settled" v={money(x.settledAmount)} /><KV k="Refunded" v={money(x.refundedAmount)} /><KV k="Balance" v={money(x.balanceAmount)} strong /></Card>
      </div>

      {x.settlements.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><Boxes className="h-4 w-4 text-primary" /> Settlement History</div>
          <table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Settlement No</th><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Invoice</th><th className="px-4 py-2.5">Method</th><th className="px-4 py-2.5 text-right">Amount</th><th className="px-4 py-2.5 text-center">Status</th></tr></thead>
            <tbody>{x.settlements.map((s) => <tr key={s.id} className="border-b border-border last:border-0"><td className="px-4 py-2.5 font-mono text-2xs text-primary">{s.settlementNo}</td><td className="px-4 py-2.5 text-2xs text-muted">{s.settlementDate}</td><td className="px-4 py-2.5 text-muted">{s.refInvoice || "—"}</td><td className="px-4 py-2.5 text-muted">{s.method}</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(s.settlementAmount)}</td><td className="px-4 py-2.5 text-center"><Badge tone={s.status === "Reversed" ? "danger" : "success"}>{s.status}</Badge></td></tr>)}</tbody>
          </table>
        </div>
      )}
      {x.refundList.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-sm font-semibold text-foreground"><ScrollText className="h-4 w-4 text-primary" /> Refund History</div>
          <table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Refund No</th><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Mode</th><th className="px-4 py-2.5">Reason</th><th className="px-4 py-2.5 text-right">Amount</th></tr></thead>
            <tbody>{x.refundList.map((r) => <tr key={r.id} className="border-b border-border last:border-0"><td className="px-4 py-2.5 font-mono text-2xs text-primary">{r.refundNo}</td><td className="px-4 py-2.5 text-2xs text-muted">{r.refundDate}</td><td className="px-4 py-2.5 text-muted">{r.refundMode}</td><td className="px-4 py-2.5 text-muted">{r.reason || "—"}</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(r.refundAmount)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {x.narration && <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">Narration</p><p className="whitespace-pre-line text-xs text-muted">{x.narration}</p></div>}

      {settle && <SettleModal advance={pick} onClose={() => setSettle(false)} onDone={load} />}
      {refund && <RefundModal advance={pick} onClose={() => setRefund(false)} onDone={load} />}
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Wallet; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Icon className="h-3.5 w-3.5" /> {title}</p><div className="space-y-1 text-xs">{children}</div></div>;
}
function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) { if (!v && v !== "0") return null; return <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span><span className={cn("text-right", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v}</span></div>; }
