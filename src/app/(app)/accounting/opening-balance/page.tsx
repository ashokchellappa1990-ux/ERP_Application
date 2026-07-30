"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet, Landmark, Coins, Save, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import type { OpeningBalanceBankRow } from "@/lib/contracts/accounting";

const n = (v: unknown) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);

export default function OpeningBalancePage() {
  const fmt = useFmt();
  const toast = useToast();
  const inr = (x: number) => fmt.money(x || 0);
  const [asOfDate, setAsOfDate] = useState(today);
  const [cash, setCash] = useState("");
  const [banks, setBanks] = useState<OpeningBalanceBankRow[]>([]);
  const [hasBanks, setHasBanks] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/accounting/opening-balance", { cache: "no-store" }).then((r) => r.json());
        if (j.ok) { setAsOfDate(j.asOfDate || today()); setCash(j.cash?.amount ? String(j.cash.amount) : ""); setBanks(j.banks ?? []); setHasBanks(!!j.hasBusinessBanks); }
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, []);

  const setBankAmt = (i: number, v: string) => setBanks((b) => b.map((x, j) => (j === i ? { ...x, amount: n(v) } : x)));
  const bankTotal = useMemo(() => +banks.reduce((s, b) => s + n(b.amount), 0).toFixed(2), [banks]);
  const total = +(n(cash) + bankTotal).toFixed(2);

  async function save() {
    setSaving(true);
    try {
      const j = await fetch("/api/accounting/opening-balance", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asOfDate, cash: n(cash), banks: banks.map((b) => ({ bankId: b.bankId, bankName: b.bankName, branch: b.branch, accountNo: b.accountNo, ifsc: b.ifsc, amount: n(b.amount) })) }),
      }).then((r) => r.json());
      if (toast.result(j, "Opening balances saved & posted.", "Could not save the opening balances.")) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1800);
      }
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Opening Balance</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wallet className="h-5 w-5 text-primary" /> Opening Balances</h1>
          <p className="mt-0.5 text-sm text-muted">Enter the opening Cash in Hand &amp; Cash at Bank. Saving posts an opening journal to the ledger.</p>
        </div>
        <div className="flex items-end gap-2">
          <div><label className="mb-1 block text-2xs font-semibold text-muted">As on</label><input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className={inp} /></div>
          <Button size="md" onClick={save} disabled={saving || loading}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save & Post"}{saved && <CheckCircle2 className="h-4 w-4" />}</Button>
        </div>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <SectionCard icon={Coins} title="Cash in Hand">
              <div className="max-w-xs">
                <label className="mb-1 block text-2xs font-semibold text-muted">Opening Cash in Hand</label>
                <input type="number" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0.00" className={inp + " w-full text-right"} />
              </div>
            </SectionCard>

            <SectionCard icon={Landmark} title="Cash at Bank" bodyClass="">
              {banks.length === 0 ? (
                <div className="flex items-start gap-2 p-5 text-sm text-muted">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                  <span>{hasBanks ? "No banks found." : <>No bank accounts configured. Add them under <Link href="/setup" className="font-semibold text-primary hover:underline">Business Setup → Bank Details</Link>, then they'll appear here.</>}</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Bank</th><th className="px-4 py-2.5">A/c No.</th><th className="px-4 py-2.5">IFSC</th><th className="px-4 py-2.5 text-right">Opening Balance</th></tr></thead>
                    <tbody>
                      {banks.map((b, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5"><div className="font-medium text-foreground">{b.bankName || "—"}</div>{b.branch && <div className="text-2xs text-subtle">{b.branch}</div>}</td>
                          <td className="px-4 py-2.5 font-mono text-2xs text-muted">{b.accountNo || "—"}</td>
                          <td className="px-4 py-2.5 font-mono text-2xs text-muted">{b.ifsc || "—"}</td>
                          <td className="px-4 py-2.5 text-right"><input type="number" value={b.amount || ""} onChange={(e) => setBankAmt(i, e.target.value)} placeholder="0.00" className="h-9 w-32 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-4 py-3" colSpan={3}>Total Cash at Bank</td><td className="px-4 py-3 text-right tabular-nums">{inr(bankTotal)}</td></tr></tfoot>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          <aside>
            <SectionCard icon={Wallet} title="Summary">
              <div className="space-y-1.5 text-sm">
                <Row k="Cash in Hand" v={inr(n(cash))} />
                <Row k="Cash at Bank" v={inr(bankTotal)} />
                <div className="my-1.5 h-px bg-border" />
                <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>Total Opening</span><span>{inr(total)}</span></div>
              </div>
              <div className="mt-3 rounded-lg bg-info-subtle/60 p-3 text-2xs text-info">
                On save: <strong>Dr Cash in Hand {inr(n(cash))}</strong> + <strong>Dr Bank {inr(bankTotal)}</strong>, <strong>Cr Opening Balance Equity {inr(total)}</strong>. Re-saving reposts (reverses the previous opening voucher).
              </div>
              <Button size="lg" className="mt-3 w-full" onClick={save} disabled={saving || loading}><CheckCircle2 className="h-4 w-4" /> {saving ? "Saving…" : `Save & Post (${inr(total)})`}</Button>
            </SectionCard>
          </aside>
        </div>
      )}
    </div>
  );
}

const inp = "h-9 rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="tabular-nums text-foreground">{v}</span></div>;
}
