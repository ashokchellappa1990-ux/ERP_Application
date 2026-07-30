"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, Pencil, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { TARGET_NEXT, isEditable, isLocked, type TargetStatus, type AchievementResult } from "@/lib/contracts/salesTarget";
import { fetchJson, StatusBadge, TrafficBadge, useValueFmt } from "./shared";

const ACTION_LABEL: Record<string, string> = { submit: "Submit", approve: "Approve", reject: "Reject", return: "Return", reopen: "Reopen", lock: "Lock", complete: "Complete", cancel: "Cancel" };

export function TargetView({ targetId }: { targetId: number }) {
  const router = useRouter();
  const vfmt = useValueFmt();
  const [t, setT] = useState<TargetDetail | null>(null);
  const [ach, setAch] = useState<AchievementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [revForm, setRevForm] = useState(false);
  const [revLine, setRevLine] = useState<string>("");
  const [revVal, setRevVal] = useState("");
  const [revReason, setRevReason] = useState("");

  const load = useCallback(() => {
    fetchJson<{ ok: boolean; target: TargetDetail }>(`/api/sales/target/${targetId}`).then((j) => j.ok && setT(j.target));
    fetchJson<{ ok: boolean; achievement: AchievementResult }>(`/api/sales/target/${targetId}/achievement`).then((j) => j.ok && setAch(j.achievement));
  }, [targetId]);
  useEffect(() => { load(); }, [load]);

  const act = async (action: string) => {
    setBusy(true);
    const remarks = action === "reject" || action === "return" ? prompt(`${ACTION_LABEL[action]} remarks:`) ?? "" : undefined;
    await fetchJson(`/api/sales/target/${targetId}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, remarks }) });
    load(); setBusy(false);
  };
  const submitRevision = async () => {
    if (!revVal) return; setBusy(true);
    await fetchJson(`/api/sales/target/${targetId}/revision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lineId: revLine ? Number(revLine) : null, revisionType: Number(revVal) >= 0 ? "increase" : "decrease", revisedTarget: Math.abs(Number(revVal)), reason: revReason }) });
    setRevForm(false); setRevVal(""); setRevReason(""); load(); setBusy(false);
  };

  if (!t) return <div className="p-10"><AppLoader label="Loading target…" /></div>;
  const nexts = Object.keys(TARGET_NEXT[t.status as TargetStatus] ?? {});
  const achLine = (id: number) => ach?.lines.find((l) => l.lineId === id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-lg p-1.5 hover:bg-surface-2"><ArrowLeft className="h-5 w-5 text-muted" /></button>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white"><Target className="h-6 w-6" /></span>
          <div><div className="flex items-center gap-2"><h1 className="text-lg font-bold text-foreground">{t.targetNo}</h1><StatusBadge status={t.status} /><StatusBadge status={t.approvalStatus} /></div><p className="text-xs text-muted capitalize">{t.fy} · {t.dimension} · {t.targetType} · {t.period} · {t.distribution}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditable(t.status) && <Link href={`/sales/target/${targetId}/edit`}><Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /> Edit</Button></Link>}
          {isLocked(t.status) && <Button size="sm" variant="outline" onClick={() => setRevForm((v) => !v)}>Revise</Button>}
          {nexts.map((a) => <Button key={a} size="sm" variant={a === "approve" ? "primary" : a === "reject" || a === "cancel" ? "danger" : "secondary"} disabled={busy} onClick={() => act(a)}>{ACTION_LABEL[a]}</Button>)}
        </div>
      </div>

      {/* Achievement summary */}
      {ach && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Total Target" value={vfmt(ach.totalTarget, t.targetType)} />
          <Kpi label="Actual (to date)" value={vfmt(ach.totalActual, t.targetType)} />
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-2xs font-semibold uppercase tracking-wide text-muted">Achievement</div><div className="mt-1"><TrafficBadge band={ach.band} pct={ach.achievementPct} /></div></div>
          <Kpi label="Time Elapsed" value={`${ach.timePct}%`} sub={`${ach.daysElapsed}/${ach.daysTotal} days`} />
        </div>
      )}

      {revForm && (
        <div className="rounded-2xl border border-primary/30 bg-primary-subtle/20 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-foreground">Create Revision <span className="font-normal text-muted">(never overwrites the original)</span></h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1"><span className="text-2xs font-semibold text-muted">Line</span><select value={revLine} onChange={(e) => setRevLine(e.target.value)} className={inp}><option value="">Overall</option>{t.lines.map((l) => <option key={l.id} value={l.id}>{l.dimensionLabel}</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="text-2xs font-semibold text-muted">New Target Value</span><input value={revVal} onChange={(e) => setRevVal(e.target.value)} type="number" className={inp} /></label>
            <input value={revReason} onChange={(e) => setRevReason(e.target.value)} placeholder="Reason" className={`${inp} min-w-[16rem] flex-1`} />
            <Button size="sm" disabled={busy} onClick={submitRevision}>Submit Revision</Button>
          </div>
        </div>
      )}

      {/* Lines */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-primary-subtle/40 px-4 py-2 text-sm font-bold text-primary">Target Lines &amp; Achievement</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-left text-2xs font-semibold uppercase tracking-wide text-muted"><th className="px-3 py-2">Dimension</th><th className="px-3 py-2 text-right">Target</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-center">Achv</th><th className="px-3 py-2 text-right">Remaining</th><th className="px-3 py-2 text-right">Req/day</th><th className="px-3 py-2 text-right">Forecast</th></tr></thead>
            <tbody>
              {t.lines.map((l) => { const a = achLine(l.id); return (
                <tr key={l.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{l.dimensionLabel}{a && !a.computable && <span className="ml-1 text-2xs text-warning">(plan-only)</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{vfmt(Number(l.annual), t.targetType)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a ? vfmt(a.actual, t.targetType) : "—"}</td>
                  <td className="px-3 py-2 text-center">{a ? <TrafficBadge band={a.band} pct={a.achievementPct} /> : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{a ? vfmt(a.remaining, t.targetType) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{a && a.requiredDaily ? vfmt(a.requiredDaily, t.targetType) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{a ? vfmt(a.forecast, t.targetType) : "—"}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revisions + approvals */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Revision History">{t.revisions.length ? <ul className="space-y-1.5 text-sm">{t.revisions.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1"><span>{r.revisionNo} · {r.dimensionLabel}</span><span className="flex items-center gap-2 tabular-nums text-muted">{vfmt(Number(r.previousTarget), t.targetType)} → {vfmt(Number(r.revisedTarget), t.targetType)} <StatusBadge status={r.status} /></span></li>)}</ul> : <Empty msg="No revisions." />}</Panel>
        <Panel title="Approval History">{t.approvals.length ? <ul className="space-y-1.5 text-sm">{t.approvals.map((a) => <li key={a.id} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1"><span>{a.action} · {a.actorName ?? "—"}</span><span className="text-2xs text-muted">{new Date(a.createdAt).toLocaleString()}</span></li>)}</ul> : <Empty msg="No approval actions yet." />}</Panel>
      </div>
    </div>
  );
}

interface TargetDetail { id: number; targetNo: string; fy: string; dimension: string; targetType: string; period: string; distribution: string; status: string; approvalStatus: string; lines: { id: number; dimensionLabel: string; annual: number }[]; revisions: { id: number; revisionNo: string; dimensionLabel: string | null; previousTarget: number; revisedTarget: number; status: string }[]; approvals: { id: number; action: string; actorName: string | null; createdAt: string }[] }
const inp = "h-9 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none";
const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</div><div className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</div>{sub && <div className="text-2xs text-subtle">{sub}</div>}</div>;
const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border bg-primary-subtle/40 px-4 py-2 text-sm font-bold text-primary">{title}</div><div className="p-4">{children}</div></div>;
const Empty = ({ msg }: { msg: string }) => <p className="py-3 text-center text-sm text-muted">{msg}</p>;
