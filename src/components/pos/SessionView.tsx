"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, ArrowLeft, Lock, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import type { SessionDetail } from "@/lib/contracts/terminalSession";

export function SessionView({ id }: { id: string }) {
  const fmt = useFmt();
  const money = (n: number | null) => (n == null ? "—" : fmt.money(n));
  const toast = useToast();
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [closingCash, setClosingCash] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/pos/sessions/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.data);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function close(approve: boolean) {
    setBusy(true);
    const res = await fetch(`/api/pos/sessions/${id}/close`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingCash: closingCash ? Number(closingCash) : undefined, closingNote: note.trim() || undefined, approve }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 422 && j.needsApproval) { setNeedsApproval(true); toast.warning(j.message); return; }
    if (toast.result(j, "Session closed.", "Could not close the session.")) { setNeedsApproval(false); await load(); }
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading session…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Session not found. <Link href="/pos/sessions" className="font-semibold text-primary hover:underline">Back</Link></div>;

  const r = data;
  const liveDiff = closingCash !== "" && r.expectedCash != null ? Number(closingCash) - r.expectedCash : r.cashDifference;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/pos/sessions" className="hover:text-foreground">Terminal Sessions</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{r.sessionNo}</span></div>
          <div className="flex items-center gap-2.5"><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wallet className="h-5 w-5 text-primary" /> {r.sessionNo}</h1><Badge tone={r.status === "Open" ? "success" : "neutral"}>{r.status}</Badge></div>
          <p className="mt-1 text-xs text-subtle">{r.terminalCode} · {r.cashierName}{r.shiftName ? ` · ${r.shiftName}` : ""}</p>
        </div>
        <Link href="/pos/sessions"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-subtle">Cash Reconciliation</p>
          <div className="space-y-2 text-sm">
            <KV k="Opening Cash" v={money(r.openingCash)} />
            <KV k="Cash Sales (this session)" v={money(r.cashSales)} />
            <div className="my-1 h-px bg-border" />
            <KV k="Expected Cash" v={money(r.expectedCash)} strong />
            {r.status === "Closed" && <><KV k="Counted (Closing)" v={money(r.closingCash)} /><KV k="Difference" v={money(r.cashDifference)} tone={r.cashDifference === 0 ? "success" : "danger"} /></>}
          </div>
        </div>

        {r.status === "Open" ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-subtle">Close Session</p>
            <label className="mb-3 block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">Counted Closing Cash</span>
              <input value={closingCash} onChange={(e) => setClosingCash(e.target.value)} type="number" className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" placeholder="0.00" /></label>
            {closingCash !== "" && <p className="mb-3 text-xs">Difference: <span className={liveDiff === 0 ? "font-semibold text-success" : "font-semibold text-danger"}>{money(liveDiff)}</span></p>}
            <label className="mb-3 block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">Closing Note</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" /></label>
            {needsApproval ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs text-warning"><ShieldAlert className="h-4 w-4" /> Difference exceeds the shift limit — manager approval required.</p>
                <Button variant="danger" size="md" onClick={() => close(true)} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Approve & Close</Button>
              </div>
            ) : (
              <Button size="md" onClick={() => close(false)} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {busy ? "Closing…" : "Close Session"}</Button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-subtle">Session Times</p>
            <div className="space-y-2 text-sm"><KV k="Opened" v={new Date(r.loginAt).toLocaleString()} /><KV k="Closed" v={r.logoutAt ? new Date(r.logoutAt).toLocaleString() : "—"} />{r.closingNote && <KV k="Note" v={r.closingNote} />}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function KV({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: "success" | "danger" }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span><span className={tone === "success" ? "font-semibold text-success" : tone === "danger" ? "font-semibold text-danger" : strong ? "font-bold text-foreground" : "font-medium text-foreground"}>{v}</span></div>;
}
