"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Plus, Trash2, Save, Loader2, Vault, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { TRANSFER_TYPES, TRANSFER_TYPE_LABELS, type TransferType, type MovementRow, type BankOption } from "@/lib/contracts/eodTransfer";

interface TermOpt { id: number; code: string; name: string }
interface Line { terminalId: string; toTerminalId: string; bankId: string; amount: string }
const inp = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";
const emptyLine = (): Line => ({ terminalId: "", toTerminalId: "", bankId: "", amount: "" });

export function FundTransferTab() {
  const toast = useToast();
  const fmt = useFmt();
  const [type, setType] = useState<TransferType>("TERMINAL_TO_SAFE");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [reason, setReason] = useState("");
  const [terminals, setTerminals] = useState<TermOpt[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [safeBalance, setSafeBalance] = useState(0);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/operations/day-close/fund-transfer", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setSafeBalance(j.safeBalance); setMovements(j.movements); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/pos/terminals?status=active", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setTerminals(j.rows.map((t: TermOpt) => ({ id: t.id, code: t.code, name: t.name }))); }).catch(() => {});
    fetch("/api/operations/day-close/banks", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setBanks(j.banks); }).catch(() => {});
  }, []);

  function changeType(t: TransferType) { setType(t); setLines([emptyLine()]); }
  const hasTerminals = terminals.length > 0; // single-user shops register no terminal
  const canT2T = terminals.length >= 2;
  const availableTypes = TRANSFER_TYPES.filter((t) => t !== "TERMINAL_TO_TERMINAL" || canT2T);
  const typeLabel = (t: TransferType) => (!hasTerminals && t === "SAFE_TO_TERMINAL") ? "Safe to Cash Drawer" : (!hasTerminals && t === "TERMINAL_TO_SAFE") ? "Cash Drawer to Safe" : TRANSFER_TYPE_LABELS[t];
  // Reset to a valid type if the current one isn't available (e.g. no terminals).
  useEffect(() => { if (!availableTypes.includes(type)) setType("TERMINAL_TO_SAFE"); }, [availableTypes, type]);

  const needsBank = type === "BANK_TO_SAFE" || type === "SAFE_TO_BANK";
  const needsTerminal = type === "SAFE_TO_TERMINAL" || type === "TERMINAL_TO_SAFE";
  const needsFromTo = type === "TERMINAL_TO_TERMINAL";

  function setLine(i: number, patch: Partial<Line>) { setLines((ls) => ls.map((l, x) => (x === i ? { ...l, ...patch } : l))); }

  async function submit() {
    const payloadLines = lines
      .filter((l) => Number(l.amount) > 0)
      .map((l) => ({
        amount: Number(l.amount),
        ...(needsBank ? { bankId: Number(l.bankId) || undefined } : {}),
        ...(needsTerminal && hasTerminals ? { terminalId: Number(l.terminalId) || undefined } : {}),
        ...(needsFromTo ? { terminalId: Number(l.terminalId) || undefined, toTerminalId: Number(l.toTerminalId) || undefined } : {}),
        reason: reason.trim() || undefined,
      }));
    if (!payloadLines.length) { toast.error("Add at least one line with an amount."); return; }
    setBusy(true);
    const j = await fetch("/api/operations/day-close/fund-transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transferType: type, lines: payloadLines }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (toast.result(j, "Transfer recorded.", "Could not record the transfer.")) { setLines([emptyLine()]); setReason(""); load(); }
  }

  const total = lines.reduce((a, l) => a + (Number(l.amount) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:max-w-xs">
        <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white shadow-sm"><Vault className="h-[18px] w-[18px]" /></span>
          <div><p className="text-lg font-bold tracking-tight text-foreground">{fmt.money(safeBalance)}</p><p className="text-xs font-medium text-muted">Safe Locker Balance</p></div></div>
      </div>

      <SectionCard title="Record Cash Transfer" icon={ArrowLeftRight}>
        <div className="mb-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">Transfer Type *</span>
            <select value={type} onChange={(e) => changeType(e.target.value as TransferType)} className={inp}>{availableTypes.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}</select></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">Reason / Note</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inp} placeholder="Applied to all lines" /></label>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-2/40 p-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-2 text-2xs font-bold text-subtle">{i + 1}</span>
              {needsBank && <Cell label="Bank"><select value={l.bankId} onChange={(e) => setLine(i, { bankId: e.target.value })} className={inp}><option value="">Select bank…</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.bankName}{b.account ? ` · ${b.account}` : ""}</option>)}</select></Cell>}
              {needsTerminal && (hasTerminals
                ? <Cell label="Terminal"><select value={l.terminalId} onChange={(e) => setLine(i, { terminalId: e.target.value })} className={inp}><option value="">Select terminal…</option>{terminals.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}</select></Cell>
                : <Cell label="Cash Drawer"><div className="grid h-9 items-center rounded-md border border-dashed border-border bg-surface-2 px-3 text-sm text-muted">Cash Drawer</div></Cell>)}
              {needsFromTo && <><Cell label="From Terminal"><select value={l.terminalId} onChange={(e) => setLine(i, { terminalId: e.target.value })} className={inp}><option value="">From…</option>{terminals.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}</select></Cell>
              <Cell label="To Terminal"><select value={l.toTerminalId} onChange={(e) => setLine(i, { toTerminalId: e.target.value })} className={inp}><option value="">To…</option>{terminals.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}</select></Cell></>}
              <Cell label="Amount" narrow><input value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} type="number" className={inp} placeholder="0.00" /></Cell>
              <button onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, x) => x !== i) : ls)} disabled={lines.length === 1} title="Remove" className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-danger/40 hover:text-danger disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}><Plus className="h-4 w-4" /> Add Line</Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">Total: <span className="font-bold tabular-nums text-foreground">{fmt.money(total)}</span></span>
            <Button size="md" onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {busy ? "Saving…" : "Record Transfer"}</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Recent Cash Movements" icon={History}>
        {loading ? <AppLoader label="Loading…" size="sm" /> : movements.length === 0 ? <p className="py-4 text-center text-sm text-muted">No cash movements yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-2xs uppercase tracking-wide text-subtle"><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Detail</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2">When</th></tr></thead>
              <tbody>
                {movements.map((mv) => (
                  <tr key={mv.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3"><Badge tone="neutral">{mv.label}</Badge></td>
                    <td className="py-2 pr-3 text-muted">{mv.detail}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums text-foreground">{fmt.money(mv.amount)}</td>
                    <td className="py-2 text-2xs text-subtle">{new Date(mv.at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Cell({ label, children, narrow }: { label: string; children: React.ReactNode; narrow?: boolean }) {
  return <label className={narrow ? "block w-28" : "block min-w-[150px] flex-1"}><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>{children}</label>;
}
