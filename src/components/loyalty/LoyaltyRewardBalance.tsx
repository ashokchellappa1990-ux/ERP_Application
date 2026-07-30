"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Search, Coins, History, Plus, Minus, Loader2, X, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { LoyaltyBalanceRow, LoyaltyLedgerRow } from "@/lib/contracts/loyalty";

const TXN_TONE: Record<string, "success" | "danger" | "warning" | "info" | "neutral"> = {
  Earn: "success", ManualCredit: "success", SalesCancellation: "info", Redeem: "danger", ManualDebit: "danger", SalesReturn: "warning", Expired: "neutral",
};

export function LoyaltyRewardBalance() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<LoyaltyBalanceRow[]>([]);
  const [stats, setStats] = useState({ customers: 0, available: 0, earned: 0, redeemed: 0 });
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<LoyaltyBalanceRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const u = new URLSearchParams(); if (query.trim()) u.set("q", query.trim());
    const j = await fetch(`/api/loyalty/balance?${u}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setRows(j.rows); setStats(j.stats); }
    setLoading(false);
  }, [query]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Loyalty</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Reward Balance</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Coins className="h-5 w-5 text-primary" /> Customer Reward Balance</h1>
        <p className="mt-0.5 text-sm text-muted">Available points, lifetime earn/redeem, ledger &amp; manual adjustment.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="Customers" value={String(stats.customers)} tone="primary" />
        <Stat icon={Coins} label="Available Points" value={stats.available.toLocaleString()} tone="success" />
        <Stat icon={History} label="Lifetime Earned" value={stats.earned.toLocaleString()} tone="info" />
        <Stat icon={IndianRupee} label="Lifetime Redeemed" value={stats.redeemed.toLocaleString()} tone="warning" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer name / phone…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3 text-right">Earned</th><th className="px-4 py-3 text-right">Redeemed</th><th className="px-4 py-3 text-right">Expired</th><th className="px-4 py-3">Last Txn</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customerId} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                  <td className="px-4 py-3"><div className="font-medium text-foreground">{r.customerName}</div><div className="text-2xs text-subtle">{r.phone || "—"}</div></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">{r.available.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{r.earned.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{r.redeemed.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{r.expired.toLocaleString()}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{r.lastTxnAt ? new Date(r.lastTxnAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setSel(r)}><History className="h-3.5 w-3.5" /> View</Button></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading balances…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No customers with reward points yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {sel && <CustomerDrawer row={sel} onClose={() => setSel(null)} onChanged={load} />}
    </div>
  );
}

function CustomerDrawer({ row, onClose, onChanged }: { row: LoyaltyBalanceRow; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [ledger, setLedger] = useState<LoyaltyLedgerRow[] | null>(null);
  const [adjType, setAdjType] = useState<"credit" | "debit">("credit");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const loadLedger = useCallback(async () => {
    const j = await fetch(`/api/loyalty/ledger?customerId=${row.customerId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setLedger(j.rows);
  }, [row.customerId]);
  useEffect(() => { loadLedger(); }, [loadLedger]);

  async function adjust() {
    if (!Number(points) || !reason.trim()) { toast.error("Enter points and a reason."); return; }
    setBusy(true);
    const j = await fetch("/api/loyalty/adjust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: row.customerId, type: adjType, points: Number(points), reason, remarks }) }).then((r) => r.json()).catch(() => ({}));
    const ok = toast.result(j, "Adjustment posted.", "Could not adjust points.");
    setBusy(false);
    if (ok) { setPoints(""); setReason(""); setRemarks(""); await loadLedger(); onChanged(); }
  }

  const inp = "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-4">
          <div><h3 className="flex items-center gap-2 text-base font-bold text-foreground"><Coins className="h-4 w-4 text-primary" /> {row.customerName}</h3><p className="text-2xs text-muted">{row.phone || "—"} · Available <span className="font-semibold text-primary">{row.available.toLocaleString()}</span> pts</p></div>
          <button onClick={onClose} className="text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* Manual adjustment */}
        <div className="border-b border-border p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Manual Point Adjustment</p>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              <button onClick={() => setAdjType("credit")} className={cn("inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold", adjType === "credit" ? "bg-success text-white" : "text-muted")}><Plus className="h-3.5 w-3.5" /> Credit</button>
              <button onClick={() => setAdjType("debit")} className={cn("inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold", adjType === "debit" ? "bg-danger text-white" : "text-muted")}><Minus className="h-3.5 w-3.5" /> Debit</button>
            </div>
            <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Points" className={inp} />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason *" className={inp} />
            <Button size="md" onClick={adjust} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Apply</Button>
          </div>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks (optional)" className={cn(inp, "mt-2")} />
        </div>

        {/* Ledger */}
        <div className="p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Loyalty Ledger</p>
          {!ledger ? <div className="py-8"><AppLoader label="Loading ledger…" size="sm" /></div> : ledger.length ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2 text-right">Earned</th><th className="px-3 py-2 text-right">Redeemed</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-muted">{l.txnDate}</td>
                      <td className="px-3 py-2"><Badge tone={TXN_TONE[l.txnType] ?? "neutral"}>{l.txnType.replace(/([A-Z])/g, " $1").trim()}</Badge>{l.remarks ? <div className="text-[10px] text-subtle">{l.remarks}</div> : null}</td>
                      <td className="px-3 py-2 font-mono text-2xs text-muted">{l.invoiceNo || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-success">{l.earned ? `+${l.earned}` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-danger">{l.redeemed ? `-${l.redeemed}` : "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{l.balanceAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">No loyalty transactions yet.</p>}
        </div>
      </div>
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", success: "bg-success text-white", info: "bg-info text-white", warning: "bg-warning text-white" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
