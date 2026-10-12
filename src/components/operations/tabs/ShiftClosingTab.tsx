"use client";

import { useCallback, useEffect, useState } from "react";
import { LockKeyhole, CheckCircle2, XCircle, Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import type { LiveSummary } from "@/lib/contracts/eod";
import type { CashDeclarationRow, ShiftClosingRow } from "@/lib/contracts/eodCash";

const inp = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";

export function ShiftClosingTab({ terminalId = "" }: { terminalId?: string }) {
  const toast = useToast();
  const fmt = useFmt();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [declarations, setDeclarations] = useState<CashDeclarationRow[]>([]);
  const [rows, setRows] = useState<ShiftClosingRow[]>([]);
  const [counted, setCounted] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = terminalId ? `?terminalId=${terminalId}` : "";
    const [s, d, c] = await Promise.all([
      fetch(`/api/operations/day-close/summary${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/operations/day-close/cash-declaration${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/operations/day-close/shift-close${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]);
    if (s.ok) setSummary(s.summary);
    if (d.ok) setDeclarations(d.rows);
    if (c.ok) setRows(c.rows);
    setLoading(false);
  }, [terminalId]);
  useEffect(() => { load(); }, [load]);

  const latest = declarations[0] ?? null;
  const declared = !!latest;
  const notPending = !latest || latest.approvalStatus !== "Pending";
  const canClose = declared && notPending;
  const expected = summary?.cash.expected ?? 0;

  async function close() {
    setBusy(true);
    const j = await fetch("/api/operations/day-close/shift-close", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countedCash: counted ? Number(counted) : undefined }),
    }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (toast.result(j, "Shift closed.", "Could not close the shift.")) { setCounted(""); load(); }
  }

  if (loading) return <div className="py-12"><AppLoader label="Loading shift status…" /></div>;

  return (
    <div className="space-y-5">
      <SectionCard title="Shift Closing" icon={LockKeyhole}>
        <div className="space-y-2">
          <Validation ok={declared} label="Cash declaration submitted" />
          <Validation ok={notPending} label="No declaration pending manager approval" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-2 px-3 py-2"><span className="block text-2xs uppercase tracking-wide text-subtle">Expected Cash</span><span className="text-base font-semibold tabular-nums text-foreground">{fmt.money(expected)}</span></div>
          <Field label="Counted Cash (override)"><input value={counted} onChange={(e) => setCounted(e.target.value)} type="number" className={inp} placeholder={latest ? String(latest.physicalCount) : "0.00"} /></Field>
        </div>
        <p className="mt-2 text-2xs text-subtle">Leave counted cash blank to use the latest declaration. Closing the shift logs out the active terminal session.</p>
        <div className="mt-4 flex justify-end"><Button size="md" variant="danger" onClick={close} disabled={busy || !canClose}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} {busy ? "Closing…" : "Close Shift"}</Button></div>
      </SectionCard>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Recent Shift Closings</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Closed</th><th className="px-4 py-3 text-right">Expected</th><th className="px-4 py-3 text-right">Counted</th><th className="px-4 py-3 text-right">Difference</th><th className="px-4 py-3">Cashier</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted">{new Date(r.closedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.money(r.expectedCash)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.money(r.countedCash)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.money(r.difference)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.cashierName || `#${r.cashierUserId}`}</td>
                  <td className="px-4 py-3 text-center"><Badge tone="neutral">{r.status}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No shift closings yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>{children}</label>;
}
function Validation({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
      <span className={ok ? "text-foreground" : "text-muted"}>{label}</span>
    </div>
  );
}
