"use client";

import { useCallback, useEffect, useState } from "react";
import { Sunrise, Play, Loader2, CheckCircle2, Info, Monitor } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import type { DayOpeningRow, DayOpenMeta } from "@/lib/contracts/eod";

const inp = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";
const EMPTY_META: DayOpenMeta = { terminalSetupRequired: false, terminals: [], shifts: [] };

export function DayOpeningTab({ terminalId: filterTerminalId = "" }: { terminalId?: string }) {
  const toast = useToast();
  const fmt = useFmt();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<DayOpeningRow | null>(null);
  const [rows, setRows] = useState<DayOpeningRow[]>([]);
  const [meta, setMeta] = useState<DayOpenMeta>(EMPTY_META);
  const [terminalId, setTerminalId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [cashFromPrev, setCashFromPrev] = useState<boolean | null>(null); // true=carried, false=no prev day
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = filterTerminalId ? `?terminalId=${filterTerminalId}` : "";
    const j = await fetch(`/api/operations/day-close/day-open${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setActive(j.active); setRows(j.rows); setMeta(j.meta ?? EMPTY_META); }
    setLoading(false);
  }, [filterTerminalId]);
  useEffect(() => { load(); }, [load]);

  // Terminal selection drives the opening-cash default (previous day's closing).
  function pickTerminal(id: string) {
    setTerminalId(id);
    const t = meta.terminals.find((x) => String(x.id) === id);
    if (t && t.prevClosingCash != null) { setOpeningCash(String(t.prevClosingCash)); setCashFromPrev(true); }
    else { setOpeningCash(""); setCashFromPrev(id ? false : null); }
  }

  const showTerminal = meta.terminalSetupRequired && meta.terminals.length > 0;

  async function open() {
    if (showTerminal && !terminalId) { toast.error("Select a terminal."); return; }
    setBusy(true);
    const j = await fetch("/api/operations/day-close/day-open", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId: showTerminal && terminalId ? Number(terminalId) : undefined, shiftId: shiftId ? Number(shiftId) : undefined, openingCash: openingCash ? Number(openingCash) : undefined, remarks: remarks.trim() || undefined }),
    }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (toast.result(j, "Day opened.", "Could not open the day.")) { setTerminalId(""); setShiftId(""); setOpeningCash(""); setCashFromPrev(null); setRemarks(""); load(); }
  }

  if (loading) return <div className="py-12"><AppLoader label="Loading day status…" /></div>;

  return (
    <div className="space-y-5">
      {active ? (
        <div className="rounded-2xl border border-success/30 bg-success-subtle/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> Day open — {active.dayOpeningNo}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {active.terminalCode && <KV k="Terminal" v={`${active.terminalCode} ${active.terminalName}`} />}
            <KV k="Cashier" v={active.cashierName} />
            <KV k="Opening Cash" v={fmt.money(active.openingCash)} accent />
            <KV k="Opening Bank" v={active.openingBankBalance == null ? "—" : fmt.money(active.openingBankBalance)} />
            <KV k="Opening Safe" v={active.openingSafeBalance == null ? "—" : fmt.money(active.openingSafeBalance)} />
            <KV k="Opening Petty" v={active.openingPettyCash == null ? "—" : fmt.money(active.openingPettyCash)} />
            <KV k="Opened" v={new Date(active.openingAt).toLocaleString()} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-2xs text-subtle"><Info className="h-3 w-3" /> Reconcile &amp; close from the Cash Closing → Shift Closing → Day Closing tabs.</p>
        </div>
      ) : (
        <SectionCard title="Open Business Day" icon={Sunrise}>
          {showTerminal && (
            <div className="mb-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Terminal *"><select value={terminalId} onChange={(e) => pickTerminal(e.target.value)} className={inp}><option value="">Select terminal…</option>{meta.terminals.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}</select></Field>
              <Field label="Shift"><select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={inp}><option value="">— None —</option>{meta.shifts.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></Field>
            </div>
          )}
          {!showTerminal && (
            <p className="mb-3 flex items-center gap-1.5 rounded-md bg-info-subtle/40 px-3 py-2 text-2xs text-info">
              <Monitor className="h-3.5 w-3.5" /> {meta.terminalSetupRequired ? "You are not mapped to any terminal — opening a branch-level day." : "Terminal-based setup is off — opening a branch-level day."}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opening Cash">
              <input value={openingCash} onChange={(e) => { setOpeningCash(e.target.value); setCashFromPrev(null); }} type="number" className={inp} placeholder="0.00" />
              {cashFromPrev === true && <span className="mt-1 block text-2xs text-success">Carried from previous day&apos;s closing cash.</span>}
              {cashFromPrev === false && <span className="mt-1 block text-2xs text-warning">No previous day found — enter the opening cash.</span>}
            </Field>
            <Field label="Remarks"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inp} /></Field>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-2xs text-subtle"><Info className="h-3 w-3" /> Opening bank &amp; safe balances are captured automatically (view-only).</p>
          <div className="mt-4 flex justify-end"><Button size="md" onClick={open} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {busy ? "Opening…" : "Open Day"}</Button></div>
        </SectionCard>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Recent Day Openings</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Terminal</th><th className="px-4 py-3">Cashier</th><th className="px-4 py-3 text-right">Opening Cash</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.dayOpeningNo}</td>
                  <td className="px-4 py-3 text-muted">{r.openingDate}</td>
                  <td className="px-4 py-3 text-muted">{r.terminalCode || "Branch"}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.cashierName || `#${r.cashierUserId}`}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{fmt.money(r.openingCash)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={r.status === "Open" ? "success" : "neutral"}>{r.status}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No day openings yet.</td></tr>}
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
function KV({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return <div className="rounded-lg border border-border bg-surface p-2.5"><span className="block text-2xs uppercase tracking-wide text-subtle">{k}</span><span className={accent ? "text-sm font-bold text-primary" : "text-sm font-medium text-foreground"}>{v}</span></div>;
}
