"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { fetchJson, StatusBadge, useValueFmt } from "./shared";

interface TRow { id: number; targetNo: string; fy: string; dimension: string; targetType: string; totalTarget: number; status: string }
interface RRow { id: number; revisionNo: string; dimensionLabel: string | null; previousTarget: number; revisedTarget: number; status: string; target: { targetNo: string; targetType: string } }

export function TargetApproval() {
  const vfmt = useValueFmt();
  const [targets, setTargets] = useState<TRow[] | null>(null);
  const [revs, setRevs] = useState<RRow[] | null>(null);
  const [busy, setBusy] = useState(0);

  const load = useCallback(() => {
    fetchJson<{ ok: boolean; rows: TRow[] }>("/api/sales/target?status=Submitted").then((j) => setTargets(j.ok ? j.rows : []));
    fetchJson<{ ok: boolean; rows: RRow[] }>("/api/sales/target/revisions?status=Pending").then((j) => setRevs(j.ok ? j.rows : []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const actTarget = async (id: number, action: "approve" | "reject" | "return") => {
    setBusy(id); const remarks = action !== "approve" ? prompt("Remarks:") ?? "" : undefined;
    await fetchJson(`/api/sales/target/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, remarks }) });
    load(); setBusy(0);
  };
  const actRev = async (id: number, action: "approve" | "reject") => {
    setBusy(-id); const remarks = action === "reject" ? prompt("Reason:") ?? "" : undefined;
    await fetchJson(`/api/sales/target/revision/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, remarks }) });
    load(); setBusy(0);
  };

  return (
    <div className="space-y-4">
      <Head icon={ClipboardCheck} title="Target Approval" sub="Approve, reject or return submitted targets & revision requests." />
      <Section title={`Targets Awaiting Approval (${targets?.length ?? 0})`}>
        {!targets ? <Loading /> : targets.length === 0 ? <Empty msg="No targets pending approval." /> : (
          <div className="divide-y divide-border">{targets.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link href={`/sales/target/${t.id}`} className="min-w-0 flex-1"><div className="font-semibold text-foreground">{t.targetNo}</div><div className="text-2xs capitalize text-muted">{t.fy} · {t.dimension} · {t.targetType}</div></Link>
              <div className="font-bold tabular-nums text-foreground">{vfmt(t.totalTarget, t.targetType)}</div>
              <div className="flex gap-1.5"><Button size="sm" disabled={busy === t.id} onClick={() => actTarget(t.id, "approve")}>Approve</Button><Button size="sm" variant="danger" disabled={busy === t.id} onClick={() => actTarget(t.id, "reject")}>Reject</Button><Button size="sm" variant="outline" disabled={busy === t.id} onClick={() => actTarget(t.id, "return")}>Return</Button></div>
            </div>
          ))}</div>
        )}
      </Section>
      <Section title={`Revisions Pending (${revs?.length ?? 0})`}>
        {!revs ? <Loading /> : revs.length === 0 ? <Empty msg="No revision requests pending." /> : (
          <div className="divide-y divide-border">{revs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><div className="font-semibold text-foreground">{r.revisionNo}</div><div className="text-2xs text-muted">{r.dimensionLabel} · {vfmt(Number(r.previousTarget), r.target.targetType)} → {vfmt(Number(r.revisedTarget), r.target.targetType)}</div></div>
              <div className="flex gap-1.5"><Button size="sm" disabled={busy === -r.id} onClick={() => actRev(r.id, "approve")}>Approve</Button><Button size="sm" variant="danger" disabled={busy === -r.id} onClick={() => actRev(r.id, "reject")}>Reject</Button></div>
            </div>
          ))}</div>
        )}
      </Section>
    </div>
  );
}

export function Head({ icon: Icon, title, sub }: { icon: React.ComponentType<{ className?: string }>; title: string; sub: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white"><Icon className="h-6 w-6" /></span><div><h1 className="text-lg font-bold text-foreground">{title}</h1><p className="text-xs text-muted">{sub}</p></div></div>;
}
export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border bg-primary-subtle/40 px-4 py-2 text-sm font-bold text-primary">{title}</div>{children}</div>;
export const Loading = () => <div className="p-8"><AppLoader label="Loading…" size="sm" /></div>;
export const Empty = ({ msg }: { msg: string }) => <p className="p-8 text-center text-sm text-muted">{msg}</p>;
export { StatusBadge };
