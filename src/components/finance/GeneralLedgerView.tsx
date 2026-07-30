"use client";

import { useEffect, useState } from "react";
import { ScrollText, ArrowLeft } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import type { GlAccountOption as AccOpt, TrialBalanceRow as TbRow, GlLedgerRow as LedgerRow } from "@/lib/contracts/finance";

const inr = (x: number) => formatMoney(x || 0);

export function GeneralLedgerView() {
  const [accounts, setAccounts] = useState<AccOpt[]>([]);
  const [accountId, setAccountId] = useState(0);
  const [tb, setTb] = useState<{ rows: TbRow[]; totals: { debit: number; credit: number } } | null>(null);
  const [ledger, setLedger] = useState<{ account: { code: string; name: string; type: string }; rows: LedgerRow[]; totals: { debit: number; credit: number; balance: number } } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const j = await fetch(`/api/finance/gl${accountId ? `?accountId=${accountId}` : ""}`, { cache: "no-store" }).then((r) => r.json());
        if (j.ok) {
          setAccounts(j.accounts);
          if (j.mode === "trial") { setTb({ rows: j.rows, totals: j.totals }); setLedger(null); }
          else { setLedger({ account: j.account, rows: j.rows, totals: j.totals }); }
        }
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, [accountId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Finance</span><span className="text-subtle">/</span><span className="font-medium text-foreground">General Ledger</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ScrollText className="h-5 w-5 text-primary" /> General Ledger</h1>
          <p className="mt-0.5 text-sm text-muted">{accountId ? "Account ledger with running balance." : "Trial Balance — pick an account to drill into its ledger."}</p>
        </div>
        <div className="flex items-center gap-2">
          {accountId > 0 && <button onClick={() => setAccountId(0)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted hover:border-primary hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> Trial Balance</button>}
          <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} className="h-10 rounded-xl border border-border-strong bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none">
            <option value={0}>Trial Balance (all accounts)</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading ledger…" size="sm" /></div>}

      {/* Trial balance */}
      {!loading && tb && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-surface-2 px-4 py-2.5 text-sm font-bold text-foreground">Trial Balance</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Code</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr></thead>
              <tbody>
                {tb.rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-primary-subtle/10" onClick={() => setAccountId(r.id)}>
                    <td className="px-4 py-2.5 font-mono text-xs text-subtle">{r.code}</td>
                    <td className="px-4 py-2.5 font-medium text-primary hover:underline">{r.name}</td>
                    <td className="px-4 py-2.5 text-2xs text-muted">{r.type}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{r.debit ? inr(r.debit) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{r.credit ? inr(r.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-4 py-3" colSpan={3}>Total</td><td className="px-4 py-3 text-right tabular-nums">{inr(tb.totals.debit)}</td><td className="px-4 py-3 text-right tabular-nums">{inr(tb.totals.credit)}</td></tr></tfoot>
            </table>
          </div>
          <div className={cn("px-4 py-2 text-2xs font-medium", Math.abs(tb.totals.debit - tb.totals.credit) < 0.05 ? "text-success" : "text-danger")}>
            {Math.abs(tb.totals.debit - tb.totals.credit) < 0.05 ? "✓ Debits equal credits — the books are balanced." : "⚠ Trial balance does not tie out."}
          </div>
        </div>
      )}

      {/* Account ledger */}
      {!loading && ledger && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5"><span className="text-sm font-bold text-foreground"><span className="font-mono text-xs text-subtle">{ledger.account.code}</span> · {ledger.account.name}</span><span className="text-2xs text-muted">{ledger.account.type}</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Voucher</th><th className="px-4 py-3">Narration</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th></tr></thead>
              <tbody>
                {ledger.rows.map((r, i) => (
                  <tr key={i} className={cn("border-b border-border last:border-0", r.status === "Reversed" && "opacity-60")}>
                    <td className="px-4 py-2.5 text-muted">{r.date}</td>
                    <td className="px-4 py-2.5"><span className="font-mono text-xs font-semibold text-primary">{r.voucherNo}</span>{r.refNo && <span className="ml-1 text-2xs text-subtle">· {r.refNo}</span>}</td>
                    <td className="px-4 py-2.5 max-w-[300px] truncate text-foreground">{r.narration}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{r.debit ? inr(r.debit) : ""}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{r.credit ? inr(r.credit) : ""}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{inr(r.balance)}</td>
                  </tr>
                ))}
                {ledger.rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No postings to this account yet.</td></tr>}
              </tbody>
              <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-4 py-3" colSpan={3}>Total · Closing balance</td><td className="px-4 py-3 text-right tabular-nums">{inr(ledger.totals.debit)}</td><td className="px-4 py-3 text-right tabular-nums">{inr(ledger.totals.credit)}</td><td className="px-4 py-3 text-right tabular-nums">{inr(ledger.totals.balance)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
