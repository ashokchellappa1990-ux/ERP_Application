"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HandCoins, Undo2, BookOpen, ClipboardCheck, Plus, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { STATUS_TONE, SettleModal, RefundModal } from "./shared";
import type { SettlementRow, RefundRow, AdvanceRow } from "@/lib/contracts/advance";

function Head({ icon: Icon, title, sub, action }: { icon: typeof HandCoins; title: string; sub: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance/advance" className="hover:text-foreground">Advance Management</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{title}</span></div><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> {title}</h1><p className="mt-0.5 text-sm text-muted">{sub}</p></div>{action}</div>;
}
const th = "border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle";

export function SettlementList() {
  const fmt = useFmt();
  const [rows, setRows] = useState<SettlementRow[]>([]); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false);
  const load = useCallback(async () => { setLoading(true); const j = await fetch("/api/finance/advance/settlement", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setRows(j.rows); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-5">
      <Head icon={HandCoins} title="Advance Settlement" sub="Apply advances against invoices/expenses. Each settlement is a separate record with its own journal." action={<Button size="md" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Settlement</Button>} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm"><thead><tr className={th}><th className="px-4 py-3">Settlement No</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Advance</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={8} className="px-4 py-8"><AppLoader label="Loading…" size="sm" /></td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No settlements yet.</td></tr> :
            rows.map((s) => <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-2/40"><td className="px-4 py-3 font-mono text-2xs text-primary">{s.settlementNo}</td><td className="px-4 py-3 text-2xs text-muted">{s.settlementDate}</td><td className="px-4 py-3 font-medium text-foreground">{s.advanceNo}</td><td className="px-4 py-3 text-muted">{s.partyName || "—"}</td><td className="px-4 py-3 text-muted">{s.refInvoice || "—"}</td><td className="px-4 py-3 text-muted">{s.method}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt.money(s.settlementAmount)}</td><td className="px-4 py-3 text-center"><Badge tone={s.status === "Reversed" ? "danger" : "success"}>{s.status}</Badge></td></tr>)}
          </tbody></table>
      </div>
      {open && <SettleModal onClose={() => setOpen(false)} onDone={load} />}
    </div>
  );
}

export function RefundList() {
  const fmt = useFmt();
  const [rows, setRows] = useState<RefundRow[]>([]); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false);
  const load = useCallback(async () => { setLoading(true); const j = await fetch("/api/finance/advance/refund", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setRows(j.rows); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-5">
      <Head icon={Undo2} title="Advance Refund" sub="Return an unsettled advance balance to (or from) the party. Posts a refund journal." action={<Button size="md" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Refund</Button>} />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm"><thead><tr className={th}><th className="px-4 py-3">Refund No</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Advance</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading…" size="sm" /></td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">No refunds yet.</td></tr> :
            rows.map((r) => <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2/40"><td className="px-4 py-3 font-mono text-2xs text-primary">{r.refundNo}</td><td className="px-4 py-3 text-2xs text-muted">{r.refundDate}</td><td className="px-4 py-3 font-medium text-foreground">{r.advanceNo}</td><td className="px-4 py-3 text-muted">{r.partyName || "—"}</td><td className="px-4 py-3 text-muted">{r.refundMode}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt.money(r.refundAmount)}</td><td className="px-4 py-3 text-center"><Badge tone="success">{r.status}</Badge></td></tr>)}
          </tbody></table>
      </div>
      {open && <RefundModal onClose={() => setOpen(false)} onDone={load} />}
    </div>
  );
}

export function AdvanceRegister() {
  const fmt = useFmt();
  const [rows, setRows] = useState<AdvanceRow[]>([]); const [totals, setTotals] = useState({ net: 0, settled: 0, refunded: 0, balance: 0 }); const [loading, setLoading] = useState(true);
  const [partyType, setPartyType] = useState(""); const [direction, setDirection] = useState("");
  useEffect(() => { setLoading(true); const u = new URLSearchParams(); if (partyType) u.set("partyType", partyType); if (direction) u.set("direction", direction); fetch(`/api/finance/advance/register?${u}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { setRows(j.rows); setTotals(j.totals); } }).catch(() => {}).finally(() => setLoading(false)); }, [partyType, direction]);
  return (
    <div className="space-y-5">
      <Head icon={BookOpen} title="Advance Register" sub="Party-wise advance ledger with settled, refunded & outstanding balances." />
      <div className="flex flex-wrap items-center gap-2">
        <select value={direction} onChange={(e) => setDirection(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm"><option value="">All directions</option><option value="received">Received (Liability)</option><option value="paid">Paid (Asset)</option></select>
        <select value={partyType} onChange={(e) => setPartyType(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-3 text-sm"><option value="">All parties</option>{["Customer", "Supplier", "Employee", "Project", "Vendor", "Contractor", "Others"].map((p) => <option key={p}>{p}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Net", totals.net], ["Settled", totals.settled], ["Refunded", totals.refunded], ["Outstanding", totals.balance]] as const).map(([k, v]) => <div key={k} className="rounded-xl border border-border bg-card p-3 shadow-sm"><div className="text-lg font-bold tabular-nums text-foreground">{fmt.money(v)}</div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{k}</div></div>)}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm"><thead><tr className={th}><th className="px-4 py-3">Advance No</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Party</th><th className="px-4 py-3 text-right">Net</th><th className="px-4 py-3 text-right">Settled</th><th className="px-4 py-3 text-right">Refunded</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={8} className="px-4 py-8"><AppLoader label="Loading…" size="sm" /></td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No advances.</td></tr> :
            rows.map((r) => <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2/40"><td className="px-4 py-3"><Link href={`/finance/advance/${r.id}`} className="font-mono text-2xs font-semibold text-primary hover:underline">{r.advanceNo}</Link></td><td className="px-4 py-3 text-muted">{r.advanceTypeName}</td><td className="px-4 py-3 font-medium text-foreground">{r.partyName || "—"}</td><td className="px-4 py-3 text-right tabular-nums">{fmt.money(r.netAmount)}</td><td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.money(r.settledAmount)}</td><td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.money(r.refundedAmount)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt.money(r.balanceAmount)}</td><td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td></tr>)}
          </tbody></table>
      </div>
    </div>
  );
}

export function ApprovalQueue() {
  const fmt = useFmt();
  const toast = useToast();
  const [rows, setRows] = useState<AdvanceRow[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(0);
  const load = useCallback(async () => { setLoading(true); const j = await fetch("/api/finance/advance/approval", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setRows(j.advances); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  async function act(id: number, action: string) { setBusy(id); const j = await fetch(`/api/finance/advance/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: action === "reject" ? "Rejected in queue" : undefined }) }).then((r) => r.json()).catch(() => ({})); setBusy(0); if (j.ok) { toast.success(j.message); load(); } else toast.error(j.message || "Failed."); }
  return (
    <div className="space-y-5">
      <Head icon={ClipboardCheck} title="Approval Queue" sub="Advances awaiting approval (above the configured threshold). Approving posts the GL voucher." />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm"><thead><tr className={th}><th className="px-4 py-3">Advance No</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Party</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={5} className="px-4 py-8"><AppLoader label="Loading…" size="sm" /></td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Nothing pending approval. 🎉</td></tr> :
            rows.map((r) => <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2/40"><td className="px-4 py-3"><Link href={`/finance/advance/${r.id}`} className="font-mono text-2xs font-semibold text-primary hover:underline">{r.advanceNo}</Link></td><td className="px-4 py-3 text-muted">{r.advanceTypeName}</td><td className="px-4 py-3 font-medium text-foreground">{r.partyName || "—"}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt.money(r.netAmount)}</td><td className="px-4 py-3"><div className="flex items-center justify-end gap-1.5"><Button size="sm" onClick={() => act(r.id, "approve")} disabled={busy === r.id}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button><Button size="sm" variant="danger" onClick={() => act(r.id, "reject")} disabled={busy === r.id}><XCircle className="h-3.5 w-3.5" /> Reject</Button></div></td></tr>)}
          </tbody></table>
      </div>
    </div>
  );
}
