"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Trash2, ArrowRight, ListChecks, History, CheckCircle2, Clock, Ban, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

interface DraftField { label: string; value: string }
interface Draft { id: number; module: string; txType: string; txLabel: string; status: string; priority: string; summary: string | null; targetHref: string; intent: string | null; createdAt: string; fields: DraftField[]; validation: { ok: boolean; issues: string[]; warnings: string[] } | null }

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = { Collecting: "warning", Draft: "info", Submitted: "success", Completed: "success", Cancelled: "neutral" };

/* ================================================================= Draft Center */
export function DraftCenter() {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("");
  const load = useCallback(async () => {
    const j = await fetch(`/api/ai/drafts${status ? `?status=${status}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setDrafts(j.drafts); setCounts(j.counts); }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  async function act(id: number, action: string) {
    const j = await fetch("/api/ai/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) }).then((r) => r.json());
    if (j.ok) { toast.show(j.message, { type: "success" }); load(); } else toast.show(j.message || "Failed.", { type: "error" });
  }
  return (
    <div className="space-y-4">
      <Header icon={FileText} title="AI Draft Center" sub="AI-prepared transactions staged for your review. Nothing is posted until you create it in the module." />
      <div className="flex flex-wrap gap-2">
        <Chip label="All" active={!status} onClick={() => setStatus("")} n={Object.values(counts).reduce((a, b) => a + b, 0)} />
        {["Draft", "Collecting", "Submitted", "Cancelled"].map((s) => <Chip key={s} label={s} active={status === s} onClick={() => setStatus(s)} n={counts[s] ?? 0} />)}
      </div>
      {!drafts ? <Loading /> : drafts.length === 0 ? <Empty msg="No drafts. Ask the AI to “create an expense voucher” to stage one." /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {drafts.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div><div className="flex items-center gap-2"><span className="text-sm font-bold text-foreground">{d.txLabel}</span><Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge></div><div className="text-2xs text-muted">{d.summary ?? d.intent}</div></div>
                <span className="text-[10px] text-subtle">{new Date(d.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-surface-2/40 p-2.5 text-2xs">
                {d.fields.filter((f) => f.value).map((f) => <div key={f.label}><span className="text-muted">{f.label}: </span><span className="font-semibold text-foreground">{f.value}</span></div>)}
              </div>
              {d.validation && (d.validation.issues.length > 0 || d.validation.warnings.length > 0) && (
                <div className="mt-2 space-y-0.5 text-[10px]">
                  {d.validation.issues.map((i, k) => <p key={k} className="flex items-center gap-1 text-danger"><AlertTriangle className="h-3 w-3" /> {i}</p>)}
                  {d.validation.warnings.map((w, k) => <p key={k} className="text-muted">• {w}</p>)}
                </div>
              )}
              {(d.status === "Draft" || d.status === "Submitted") && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Link href={`${d.targetHref}?aiDraft=${d.id}`} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-2xs font-semibold text-white hover:opacity-90">Create in module <ArrowRight className="h-3.5 w-3.5" /></Link>
                  {d.status === "Draft" && <button onClick={() => act(d.id, "submit")} className="rounded-md border border-border px-2.5 py-1 text-2xs font-semibold text-muted hover:text-primary">Mark ready</button>}
                  <button onClick={() => act(d.id, "cancel")} className="ml-auto grid h-7 w-7 place-items-center rounded-md text-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================= Task Center */
export function TaskCenter() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  useEffect(() => { fetch("/api/ai/drafts", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { setCounts(j.counts); setDrafts(j.drafts); } }).catch(() => {}); }, []);
  const tiles = [
    { k: "Pending Drafts", v: counts.Draft ?? 0, icon: FileText, href: "/ai/drafts?status=Draft", tone: "text-info" },
    { k: "Collecting", v: counts.Collecting ?? 0, icon: Clock, href: "/ai/drafts?status=Collecting", tone: "text-warning" },
    { k: "Marked Ready", v: counts.Submitted ?? 0, icon: CheckCircle2, href: "/ai/drafts?status=Submitted", tone: "text-success" },
    { k: "Cancelled", v: counts.Cancelled ?? 0, icon: Ban, href: "/ai/drafts?status=Cancelled", tone: "text-muted" },
  ];
  const approvals = [
    { label: "Expense / Purchase Approvals", href: "/purchase/invoice" }, { label: "Budget Revisions", href: "/finance/budget/revision" },
    { label: "Government Payments", href: "/finance/statutory-compliance" }, { label: "Receipt Vouchers", href: "/finance/receipt" },
  ];
  return (
    <div className="space-y-4">
      <Header icon={ListChecks} title="AI Task Center" sub="Your AI-generated tasks and the approval queues they feed into." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => <Link key={t.k} href={t.href} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"><div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{t.k}</span><t.icon className={cn("h-4 w-4", t.tone)} /></div><div className={cn("mt-1 text-xl font-bold", t.tone)}>{t.v}</div></Link>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Pending Drafts">
          {!drafts ? <Loading /> : drafts.filter((d) => d.status === "Draft").length === 0 ? <Empty msg="No pending drafts." /> : (
            <div className="space-y-1.5">{drafts.filter((d) => d.status === "Draft").slice(0, 8).map((d) => <Link key={d.id} href="/ai/drafts" className="flex items-center justify-between rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm transition hover:border-primary/40"><span className="min-w-0"><span className="font-medium text-foreground">{d.txLabel}</span> <span className="text-2xs text-muted">— {d.summary}</span></span><Badge tone="info">{d.priority}</Badge></Link>)}</div>
          )}
        </Panel>
        <Panel title="Approval Queues">
          <div className="space-y-1.5">{approvals.map((a) => <Link key={a.href} href={a.href} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm transition hover:border-primary/40"><span className="text-foreground">{a.label}</span><ArrowRight className="h-3.5 w-3.5 text-subtle" /></Link>)}</div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================================================== Action History */
interface Action { id: number; actionNo: string; prompt: string; intent: string; module: string | null; txType: string | null; status: string; target: string | null; latencyMs: number | null; at: string }
export function ActionHistory() {
  const [actions, setActions] = useState<Action[] | null>(null);
  useEffect(() => { fetch("/api/ai/actions", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setActions(j.actions); }).catch(() => {}); }, []);
  return (
    <div className="space-y-4">
      <Header icon={History} title="AI Action History" sub="Every AI command and what it produced — a full audit trail of the command center." />
      {!actions ? <Loading /> : actions.length === 0 ? <Empty msg="No AI actions yet." /> : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-border bg-surface-2/50 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2 text-left">Action</th><th className="px-3 py-2 text-left">Prompt</th><th className="px-3 py-2 text-left">Intent</th><th className="px-3 py-2 text-left">Module</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">When</th></tr></thead>
          <tbody>{actions.map((a) => (
            <tr key={a.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
              <td className="px-3 py-2 font-mono text-2xs text-muted">{a.actionNo}</td>
              <td className="px-3 py-2 max-w-[260px] truncate text-foreground">{a.prompt}</td>
              <td className="px-3 py-2"><Badge tone="neutral">{a.intent}</Badge></td>
              <td className="px-3 py-2 text-2xs text-muted">{a.txType ?? a.module ?? "—"}</td>
              <td className="px-3 py-2 text-center"><Badge tone={a.status === "draft-created" || a.status === "navigated" ? "success" : a.status === "blocked" || a.status === "failed" ? "danger" : "info"}>{a.status}</Badge></td>
              <td className="px-3 py-2 text-right text-2xs text-subtle">{new Date(a.at).toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ primitives */
function Header({ icon: Icon, title, sub }: { icon: typeof FileText; title: string; sub: string }) {
  return <div><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><Icon className="h-5 w-5" /></span>{title}</h1><p className="mt-0.5 text-sm text-muted">{sub}</p></div>;
}
function Chip({ label, active, onClick, n }: { label: string; active: boolean; onClick: () => void; n: number }) {
  return <button onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition", active ? "border-primary bg-primary text-white" : "border-border bg-card text-muted hover:text-foreground")}>{label}<span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-white/25" : "bg-surface-2")}>{n}</span></button>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-2 text-sm font-bold text-foreground">{title}</h3>{children}</div>; }
function Loading() { return <div className="rounded-2xl border border-border bg-card p-8 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>; }
function Empty({ msg }: { msg: string }) { return <div className="rounded-2xl border border-dashed border-border-strong bg-card p-8 text-center text-sm text-muted">{msg}</div>; }
