"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import type { LiveSummary } from "@/lib/contracts/eod";
import type { CashDeclarationRow } from "@/lib/contracts/eodCash";

const inp = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";

export function CashClosingTab({ terminalId = "" }: { terminalId?: string }) {
  const toast = useToast();
  const fmt = useFmt();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [rows, setRows] = useState<CashDeclarationRow[]>([]);
  const [physical, setPhysical] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = terminalId ? `?terminalId=${terminalId}` : "";
    const [s, d] = await Promise.all([
      fetch(`/api/operations/day-close/summary${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/operations/day-close/cash-declaration${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]);
    if (s.ok) setSummary(s.summary);
    if (d.ok) setRows(d.rows);
    setLoading(false);
  }, [terminalId]);
  useEffect(() => { load(); }, [load]);

  const expected = summary?.cash.expected ?? 0;
  const count = physical ? Number(physical) : 0;
  const diff = physical ? +(count - expected).toFixed(2) : 0;
  const excess = Math.max(0, diff);
  const shortage = Math.max(0, -diff);

  async function submit() {
    if (physical === "" || Number(physical) < 0) { toast.error("Enter the physical cash count."); return; }
    setBusy(true);
    const j = await fetch("/api/operations/day-close/cash-declaration", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ physicalCount: Number(physical), remarks: remarks.trim() || undefined }),
    }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (toast.result(j, "Cash declared.", "Could not record the declaration.")) { setPhysical(""); setRemarks(""); load(); }
  }

  if (loading) return <div className="py-12"><AppLoader label="Loading cash position…" /></div>;

  return (
    <div className="space-y-5">
      <SectionCard title="Cash Declaration" icon={Calculator}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat k="Expected Cash" v={fmt.money(expected)} />
          <Stat k="Physical Count" v={fmt.money(count)} />
          <Stat k="Excess" v={fmt.money(excess)} tone={excess > 0 ? "success" : undefined} />
          <Stat k="Shortage" v={fmt.money(shortage)} tone={shortage > 0 ? "danger" : undefined} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Physical Cash Count *"><input value={physical} onChange={(e) => setPhysical(e.target.value)} type="number" className={inp} placeholder="0.00" /></Field>
          <div className="sm:col-span-2"><Field label="Remarks"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inp} /></Field></div>
        </div>
        <div className="mt-4 flex justify-end"><Button size="md" onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {busy ? "Declaring…" : "Submit Declaration"}</Button></div>
      </SectionCard>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Recent Declarations</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3 text-right">Expected</th><th className="px-4 py-3 text-right">Counted</th><th className="px-4 py-3 text-right">Excess</th><th className="px-4 py-3 text-right">Shortage</th><th className="px-4 py-3">Cashier</th><th className="px-4 py-3 text-center">Approval</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.money(r.expectedCash)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.money(r.physicalCount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">{fmt.money(r.excess)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-danger">{fmt.money(r.shortage)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.cashierName || `#${r.cashierUserId}`}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={r.approvalStatus === "Pending" ? "warning" : r.approvalStatus === "Approved" ? "success" : "neutral"}>{r.approvalStatus}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No declarations yet.</td></tr>}
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
function Stat({ k, v, tone }: { k: string; v: string; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return <div className="rounded-xl border border-border bg-surface-2 px-3 py-2"><span className="block text-2xs uppercase tracking-wide text-subtle">{k}</span><span className={`text-base font-semibold tabular-nums ${color}`}>{v}</span></div>;
}
