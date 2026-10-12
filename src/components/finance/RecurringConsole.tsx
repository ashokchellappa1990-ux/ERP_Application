"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Repeat, Settings2, FileText, SkipForward, AlertCircle, Eye, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { GEN_MODE_LABEL, POSTING_LABEL, type PendingRow, type ExecutionRow, type RecurringConfigDto, type ExecutionDetail } from "@/lib/contracts/recurring";

const TABS = ["Dashboard", "Pending Transactions", "Execution History"] as const;
type Tab = (typeof TABS)[number];
const EXEC_TONE: Record<string, "neutral" | "warning" | "success" | "danger" | "info"> = { Generated: "info", Posted: "success", PendingApproval: "warning", Approved: "success", Rejected: "danger", Skipped: "neutral", Failed: "danger" };

export function RecurringConsole() {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [kpis, setKpis] = useState<Record<string, number> | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [execs, setExecs] = useState<ExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(0);
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [modal, setModal] = useState<{ row: PendingRow } | null>(null);
  const [execModal, setExecModal] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, p, e] = await Promise.all([
      fetch("/api/finance/recurring/dashboard", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/finance/recurring/pending", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/finance/recurring/executions", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (d?.ok) setKpis(d.kpis);
    if (p?.ok) setPending(p.rows);
    if (e?.ok) setExecs(e.rows);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function skip(r: PendingRow) {
    setBusy(r.configId);
    const j = await fetch("/api/finance/recurring/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ configId: r.configId, action: "skip" }) }).then((x) => x.json());
    setBusy(0);
    if (j.ok) { toast.show("Skipped.", { type: "success" }); load(); } else toast.show(j.message || "Failed.", { type: "error" });
  }

  const filtered = useMemo(() => pending.filter((r) => typeFilter === "all" || r.txnType === typeFilter), [pending, typeFilter]);
  const counts = { all: pending.length, expense: pending.filter((r) => r.txnType === "expense").length, income: pending.filter((r) => r.txnType === "income").length };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Recurring Transactions</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Repeat className="h-5 w-5 text-primary" /> Recurring Transactions</h1>
          <p className="mt-0.5 text-sm text-muted">Execute, monitor and review recurring transactions. Rules are set in <Link href="/system/recurring-config" className="font-medium text-primary hover:underline">System → Recurring Configuration</Link>.</p>
        </div>
        <Link href="/system/recurring-config" className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground"><Settings2 className="h-4 w-4" /> Configuration</Link>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("relative px-4 py-2 text-sm font-semibold transition", tab === t ? "text-primary" : "text-muted hover:text-foreground")}>{t}{tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}{t === "Pending Transactions" && pending.length > 0 && <span className="ml-1.5 rounded-full bg-warning px-1.5 text-2xs font-bold text-white">{pending.length}</span>}</button>)}
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          {tab === "Dashboard" && kpis && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {([["Total Configs", kpis.totalConfigs, "primary"], ["Active", kpis.active, "success"], ["Due Today", kpis.dueToday, "warning"], ["Upcoming (7d)", kpis.upcoming, "info"], ["Pending Manual", kpis.pendingManual, "warning"], ["Pending Approval", kpis.pendingApproval, "warning"], ["Generated Today", kpis.generatedToday, "success"], ["Failed Today", kpis.failedToday, "danger"], ["Recurring Expense (mo)", kpis.recurringExpense, "danger", true], ["Recurring Income (mo)", kpis.recurringIncome, "success", true]] as [string, number, string, boolean?][]).map(([label, val, tone, money]) => (
                <div key={label} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><p className="text-2xs font-medium text-muted">{label}</p><p className={cn("mt-1 text-lg font-bold tracking-tight", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : tone === "info" ? "text-info" : "text-primary")}>{money ? inr(val) : val}</p></div>
              ))}
            </div>
          )}

          {tab === "Pending Transactions" && (
            <>
              <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
                {(["all", "expense", "income"] as const).map((t) => <button key={t} onClick={() => setTypeFilter(t)} className={cn("px-3.5 py-1.5 font-semibold capitalize transition", typeFilter === t ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{t === "all" ? "All" : t} <span className="opacity-70">({counts[t]})</span></button>)}
              </div>
              {filtered.length === 0 ? <Empty text={`No pending ${typeFilter === "all" ? "recurring" : typeFilter} transactions. 🎉`} />
              : <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
                  <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2.5 text-left">Due Date</th><th className="px-3 py-2.5 text-left">Config No</th><th className="px-3 py-2.5 text-left">Name</th><th className="px-3 py-2.5 text-left">Type</th><th className="px-3 py-2.5 text-left">Mode</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5 text-right">Action</th></tr></thead>
                  <tbody>{filtered.map((r) => (
                    <tr key={r.configId} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                      <td className="px-3 py-2"><span className={cn("font-medium", r.overdue ? "text-danger" : "text-foreground")}>{r.dueDate}</span>{r.overdue && <span className="ml-1 text-2xs font-semibold text-danger">(overdue)</span>}</td>
                      <td className="px-3 py-2 font-semibold text-foreground">{r.configNo}</td>
                      <td className="px-3 py-2 text-foreground">{r.name}<div className="text-2xs text-muted">{r.headName ?? ""}{r.partyName ? ` · ${r.partyName}` : ""}</div></td>
                      <td className="px-3 py-2"><Badge tone={r.txnType === "expense" ? "danger" : "success"}>{r.txnType}</Badge></td>
                      <td className="px-3 py-2 text-2xs text-muted">{GEN_MODE_LABEL[r.generationMode]}</td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">{inr(r.amount)}</td>
                      <td className="px-3 py-2"><div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setModal({ row: r })} title="View / Create Voucher" className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-3.5 w-3.5" /> View</button>
                        {r.generationMode !== "reminder" && <button onClick={() => setModal({ row: r })} disabled={busy === r.configId} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary-subtle px-2.5 py-1.5 text-2xs font-semibold text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"><FileText className="h-3.5 w-3.5" /> {r.generationMode === "scheduler_approval" ? "Approve" : "Create Voucher"}</button>}
                        <button onClick={() => skip(r)} disabled={busy === r.configId} title="Skip" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:text-foreground disabled:opacity-50"><SkipForward className="h-4 w-4" /></button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table></div></div>}
            </>
          )}

          {tab === "Execution History" && (
            execs.length === 0 ? <Empty text="No executions yet." />
            : <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-sm">
                <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2.5 text-left">Execution No</th><th className="px-3 py-2.5 text-left">Config</th><th className="px-3 py-2.5 text-left">Type</th><th className="px-3 py-2.5 text-left">Date</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5 text-left">Voucher</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-left">Fund Status</th><th className="px-3 py-2.5 text-right">Action</th></tr></thead>
                <tbody>{execs.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                    <td className="px-3 py-2 font-semibold text-foreground">{e.executionNo}</td>
                    <td className="px-3 py-2 text-foreground">{e.configNo}<div className="text-2xs text-muted">{e.configName}</div></td>
                    <td className="px-3 py-2"><Badge tone={e.txnType === "expense" ? "danger" : "success"}>{e.txnType}</Badge></td>
                    <td className="px-3 py-2 text-muted">{e.executionDate}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">{inr(e.amount)}</td>
                    <td className="px-3 py-2 text-2xs text-muted">{e.voucherNo ?? "—"}</td>
                    <td className="px-3 py-2 text-center"><Badge tone={EXEC_TONE[e.status]}>{e.status}</Badge></td>
                    <td className="px-3 py-2">{e.settlement ? <span className={cn("inline-flex items-center gap-1 text-2xs font-semibold", e.settlement.tone === "success" ? "text-success" : e.settlement.tone === "warning" ? "text-warning" : e.settlement.tone === "danger" ? "text-danger" : "text-muted")}><span className={cn("h-1.5 w-1.5 rounded-full", e.settlement.tone === "success" ? "bg-success" : e.settlement.tone === "warning" ? "bg-warning" : e.settlement.tone === "danger" ? "bg-danger" : "bg-muted")} />{e.settlement.label}{e.settlement.balance > 0.01 && e.settlement.settled > 0.01 ? ` · bal ${inr(e.settlement.balance)}` : ""}</span> : <span className="text-2xs text-subtle">—</span>}</td>
                    <td className="px-3 py-2 text-right">{e.voucherNo ? <button onClick={() => setExecModal(e.id)} title="View details" className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-2xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-3.5 w-3.5" /> View</button> : "—"}</td>
                  </tr>
                ))}</tbody>
              </table></div></div>
          )}
        </>
      )}

      {modal && <VoucherPreviewModal row={modal.row} inr={inr} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {execModal != null && <ExecutionDetailModal id={execModal} inr={inr} onClose={() => setExecModal(null)} onSettled={load} />}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center"><AlertCircle className="mx-auto mb-2 h-6 w-6 text-muted" /><p className="text-sm text-muted">{text}</p></div>;
}

/* ---------------------------------------- voucher preview / generate modal -- */
function VoucherPreviewModal({ row, inr, onClose, onDone }: { row: PendingRow; inr: (n: number) => string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<RecurringConfigDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/finance/recurring/config/${row.configId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setCfg(j.config); setLoading(false); }).catch(() => setLoading(false));
  }, [row.configId]);

  const t = useMemo(() => {
    if (!cfg) return null;
    const per = cfg.lines.map((l) => ({ ...l, base: Number(l.amount) || 0, gst: cfg.gstApplicable ? (Number(l.amount) || 0) * (Number(l.gstPct) || 0) / 100 : 0 }));
    const taxable = per.reduce((s, l) => s + l.base, 0), gst = per.reduce((s, l) => s + l.gst, 0), gross = taxable + gst;
    const tds = taxable * (cfg.tdsRate || 0) / 100, tcs = gross * (cfg.tcsRate || 0) / 100;
    const net = cfg.txnType === "expense" ? gross + tcs - tds : gross;
    return { per, taxable, gst, gross, tds, tcs, net };
  }, [cfg]);

  async function generate() {
    setBusy(true);
    const j = await fetch("/api/finance/recurring/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ configId: row.configId, action: "generate" }) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.show(j.message || "Voucher generated.", { type: "success" }); onDone(); } else toast.show(j.message || "Could not generate.", { type: "error" });
  }

  const canGenerate = row.generationMode !== "reminder";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="text-base font-bold text-foreground">{cfg?.txnType === "income" ? "Receipt" : "Expense"} Voucher — Preview</h3>
            <p className="text-2xs text-muted">{row.configNo} · {row.name} · due {row.dueDate}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-5 py-4">
          {loading || !cfg || !t ? <AppLoader label="Loading…" size="sm" /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <Info k={cfg.txnType === "income" ? "Customer" : "Party"} v={cfg.partyName ?? "—"} />
                <Info k="Type" v={cfg.txnType} />
                <Info k="Posting" v={POSTING_LABEL[cfg.postingMethod] ?? cfg.postingMethod} />
                <Info k="Due Date" v={row.dueDate} />
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[440px] text-sm">
                  <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase text-muted"><th className="px-3 py-2 text-left">Head</th><th className="px-3 py-2 text-left">Description</th>{cfg.gstApplicable && <th className="px-3 py-2 text-right">GST%</th>}<th className="px-3 py-2 text-right">Amount</th>{cfg.gstApplicable && <th className="px-3 py-2 text-right">+GST</th>}</tr></thead>
                  <tbody>{t.per.map((l, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-1.5 text-foreground">{l.headName ?? "—"}</td>
                      <td className="px-3 py-1.5 text-2xs text-muted">{l.description ?? "—"}</td>
                      {cfg.gstApplicable && <td className="px-3 py-1.5 text-right text-muted">{l.gstPct || 0}%</td>}
                      <td className="px-3 py-1.5 text-right font-medium text-foreground">{inr(l.base)}</td>
                      {cfg.gstApplicable && <td className="px-3 py-1.5 text-right text-muted">{inr(l.base + l.gst)}</td>}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="ml-auto max-w-xs space-y-1 text-sm">
                <Row k="Taxable" v={inr(t.taxable)} />
                {cfg.gstApplicable && <Row k="GST" v={inr(t.gst)} />}
                {cfg.txnType === "expense" && t.tds > 0 && <Row k="TDS" v={`− ${inr(t.tds)}`} />}
                {cfg.txnType === "expense" && t.tcs > 0 && <Row k="TCS" v={`+ ${inr(t.tcs)}`} />}
                <Row k={cfg.txnType === "expense" ? "Net Payable" : "Total Receipt"} v={inr(t.net)} bold />
              </div>
              {cfg.status !== "Active" && <p className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-2xs font-medium text-warning">This configuration is {cfg.status}. Activate it to generate vouchers.</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          {canGenerate && cfg?.status === "Active" && <Button size="sm" onClick={generate} disabled={busy || loading}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {busy ? "Generating…" : "Generate Voucher"}</Button>}
        </div>
      </div>
    </div>
  );
}
function Info({ k, v }: { k: string; v: string }) { return <div><p className="text-2xs text-muted">{k}</p><p className="font-medium capitalize text-foreground">{v}</p></div>; }
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) { return <div className={cn("flex items-center justify-between", bold && "border-t border-border pt-1 text-base font-bold text-foreground")}><span className={cn(!bold && "text-muted")}>{k}</span><span className={cn(!bold && "font-medium text-foreground")}>{v}</span></div>; }

/* --------------------------------------------- generated voucher detail --- */
const PAY_MODES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"];
function ExecutionDetailModal({ id, inr, onClose, onSettled }: { id: number; inr: (n: number) => string; onClose: () => void; onSettled: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<ExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payAmt, setPayAmt] = useState("");
  const [mode, setMode] = useState("Cash");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(() => {
    setLoading(true);
    fetch(`/api/finance/recurring/executions/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { setD(j.detail); setPayAmt(j.detail.settlement?.balance ? String(j.detail.settlement.balance) : ""); } setLoading(false); }).catch(() => setLoading(false));
  }, [id]);
  useEffect(() => { reload(); }, [reload]);
  const st = d?.settlement;
  const stTone = (t?: string) => (t === "success" ? "success" : t === "warning" ? "warning" : t === "danger" ? "danger" : "neutral") as "success" | "warning" | "danger" | "neutral";
  const canSettle = !!st && st.balance > 0.01 && d?.execution.status === "Posted" && d.config.postingMethod !== "pay_now" && d.config.postingMethod !== "receive_now";
  const isIncome = d?.config.txnType === "income";

  async function settle() {
    const amt = Number(payAmt) || 0;
    if (amt <= 0) { toast.show("Enter an amount.", { type: "error" }); return; }
    setBusy(true);
    const j = await fetch(`/api/finance/recurring/executions/${id}/settle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt, mode }) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.show(j.message || "Posted.", { type: "success" }); reload(); onSettled(); } else toast.show(j.message || "Could not post.", { type: "error" });
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div><h3 className="text-base font-bold text-foreground">{d?.config.txnType === "income" ? "Receipt" : "Expense"} Voucher — Details</h3><p className="text-2xs text-muted">{d?.execution.voucherNo ?? ""} · {d?.execution.executionNo ?? ""}</p></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[68vh] space-y-4 overflow-y-auto px-5 py-4">
          {loading || !d ? <AppLoader label="Loading…" size="sm" /> : (
            <>
              <Section title="Transaction Details">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <Info k="Config" v={`${d.config.configNo}`} /><Info k="Name" v={d.config.name} /><Info k="Type" v={d.config.txnType} /><Info k="Date" v={d.execution.executionDate} />
                  {d.config.department && <Info k="Department" v={d.config.department} />}{d.config.costCenter && <Info k="Cost Center" v={d.config.costCenter} />}{d.config.project && <Info k="Project" v={d.config.project} />}
                </div>
              </Section>
              <Section title="Voucher Details">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4"><Info k="Voucher No" v={d.execution.voucherNo ?? "—"} /><Info k="Posting" v={POSTING_LABEL[d.config.postingMethod] ?? d.config.postingMethod} /><Info k="Status" v={d.execution.status} /><Info k="Generated By" v={d.execution.generatedBy === "scheduler" ? "Scheduler" : d.execution.generatedByName ?? "User"} /></div>
              </Section>
              <Section title={`${d.config.txnType === "income" ? "Customer" : "Supplier / Party"} Details`}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4"><Info k="Name" v={d.config.partyName ?? "—"} />{d.config.partyType && <Info k="Type" v={d.config.partyType} />}</div>
              </Section>
              {d.lines.length > 0 && <Section title="Heads">
                <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[400px] text-sm"><thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase text-muted"><th className="px-3 py-2 text-left">Head</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Taxable</th>{d.config.gstApplicable && <th className="px-3 py-2 text-right">GST</th>}<th className="px-3 py-2 text-right">Amount</th></tr></thead>
                <tbody>{d.lines.map((l, i) => <tr key={i} className="border-b border-border/60 last:border-0"><td className="px-3 py-1.5 text-foreground">{l.headName ?? "—"}</td><td className="px-3 py-1.5 text-2xs text-muted">{l.description ?? "—"}</td><td className="px-3 py-1.5 text-right text-muted">{inr(l.taxable)}</td>{d.config.gstApplicable && <td className="px-3 py-1.5 text-right text-muted">{inr(l.gst)}</td>}<td className="px-3 py-1.5 text-right font-medium text-foreground">{inr(l.amount)}</td></tr>)}</tbody></table></div>
              </Section>}
              <Section title="Account Posting">
                <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[420px] text-sm"><thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase text-muted"><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr></thead>
                <tbody>{d.posting.map((p, i) => <tr key={i} className="border-b border-border/60 last:border-0"><td className="px-3 py-1.5 text-foreground">{p.code} · {p.name}</td><td className="px-3 py-1.5 text-right text-foreground">{p.debit > 0 ? inr(p.debit) : ""}</td><td className="px-3 py-1.5 text-right text-foreground">{p.credit > 0 ? inr(p.credit) : ""}</td></tr>)}</tbody>
                <tfoot><tr className="border-t border-border bg-surface-2/40 font-bold"><td className="px-3 py-2 text-foreground">Total</td><td className="px-3 py-2 text-right">{inr(d.posting.reduce((s, p) => s + p.debit, 0))}</td><td className="px-3 py-2 text-right">{inr(d.posting.reduce((s, p) => s + p.credit, 0))}</td></tr></tfoot></table></div>
              </Section>
              {st && <Section title={st.kind === "payment" ? "Payment Status (Fund)" : "Collection Status (Fund)"}>
                <div className="flex flex-wrap items-center gap-4">
                  <Badge tone={stTone(st.tone)}>{st.label}</Badge>
                  <div className="text-sm text-muted">Total <b className="text-foreground">{inr(st.total)}</b></div>
                  <div className="text-sm text-muted">{st.kind === "payment" ? "Paid" : "Collected"} <b className="text-foreground">{inr(st.settled)}</b></div>
                  <div className={cn("text-sm", st.balance > 0.01 ? "text-danger" : "text-muted")}>Balance <b>{inr(st.balance)}</b></div>
                </div>
                {canSettle && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-primary/25 bg-primary-subtle/20 p-3">
                    <div><label className="mb-1 block text-2xs font-semibold text-muted">{isIncome ? "Collect Amount" : "Pay Amount"}</label><input type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} className="h-9 w-32 rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none" /></div>
                    <div><label className="mb-1 block text-2xs font-semibold text-muted">Mode</label><select value={mode} onChange={(e) => setMode(e.target.value)} className="h-9 rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none">{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
                    <button onClick={() => setPayAmt(String(st.balance))} className="h-9 rounded-md border border-border px-2.5 text-2xs font-semibold text-muted transition hover:text-foreground">Full</button>
                    <Button size="sm" onClick={settle} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {isIncome ? "Collect" : "Pay"} &amp; Post</Button>
                    <span className="text-2xs text-muted">Full or partial — posts {isIncome ? "Dr Cash/Bank, Cr Receivable" : "Dr Payable, Cr Cash/Bank"}. A separate Supplier Payment screen also exists.</span>
                  </div>
                )}
              </Section>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <div><p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">{title}</p>{children}</div>; }
