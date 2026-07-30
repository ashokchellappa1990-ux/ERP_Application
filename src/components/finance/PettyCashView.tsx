"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, ArrowLeft, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatMoney } from "@/lib/settings/generalConfig";
import type { PettyCashDetail as V } from "@/lib/contracts/finance";

const inr = (x: number) => formatMoney(x || 0);

export function PettyCashView({ id }: { id: number }) {
  const [v, setV] = useState<V | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { try { const j = await fetch(`/api/finance/petty-cash/${id}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setV(j.voucher); } catch { /* */ } finally { setLoading(false); } })();
  }, [id]);

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading voucher…" size="sm" /></div>;
  if (!v) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">Voucher not found. <Link href="/finance/petty-cash" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance/petty-cash" className="hover:text-foreground">Petty Cash</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{v.voucherNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Coins className="h-5 w-5 text-primary" /> {v.voucherNo}</h1>
        </div>
        <Link href="/finance/petty-cash"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <SectionCard icon={Coins} title="Expense Heads" bodyClass="">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Head</th><th className="px-4 py-2.5">Description</th>{v.gstApplicable && <><th className="px-4 py-2.5">HSN/SAC</th><th className="px-4 py-2.5 text-right">GST%</th><th className="px-4 py-2.5 text-right">Taxable</th><th className="px-4 py-2.5 text-right">Tax</th></>}<th className="px-4 py-2.5 text-right">Amount</th></tr></thead>
              <tbody>
                {v.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border last:border-0"><td className="px-4 py-2.5 font-medium text-foreground">{l.headName || "—"}</td><td className="px-4 py-2.5 text-2xs text-muted">{l.description}</td>{v.gstApplicable && <><td className="px-4 py-2.5 text-2xs text-muted">{l.hsn || "—"}</td><td className="px-4 py-2.5 text-right text-2xs text-muted">{l.gstPct != null ? `${l.gstPct}%` : "—"}</td><td className="px-4 py-2.5 text-right tabular-nums text-muted">{inr(l.taxable ?? 0)}</td><td className="px-4 py-2.5 text-right tabular-nums text-muted">{inr(l.taxAmount ?? 0)}</td></>}<td className="px-4 py-2.5 text-right font-semibold text-foreground">{inr(l.amount)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-4 py-3" colSpan={v.gstApplicable ? 6 : 2}>Total</td><td className="px-4 py-3 text-right tabular-nums">{inr(v.totalAmount)}</td></tr></tfoot>
            </table>
          </div>
          {v.payments.length > 0 && (
            <div className="border-t border-border p-4">
              <p className="mb-1.5 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-subtle"><Wallet className="h-3 w-3" /> Payment</p>
              <div className="flex flex-wrap gap-2">{v.payments.map((p, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-2xs"><span className="font-medium text-foreground">{p.mode}</span>{p.reference ? <span className="text-subtle">{p.reference}</span> : null}<span className="font-semibold text-foreground">{inr(p.amount)}</span></span>)}</div>
            </div>
          )}
        </SectionCard>

        <aside>
          <SectionCard icon={User} title="Voucher Details">
            <div className="space-y-2 text-sm">
              <Row k="Payee" v={v.payeeName || "—"} />
              <Row k="Type" v={v.payeeType} />
              <Row k="Date" v={v.voucherDate} />
              <div className="flex items-center justify-between"><span className="text-muted">Status</span><Badge tone="success">{v.status}</Badge></div>
              <div className="my-1.5 h-px bg-border" />
              {v.gstApplicable && (
                <>
                  <Row k="Taxable Value" v={inr(v.taxableTotal)} />
                  <Row k="CGST" v={inr(v.cgst)} /><Row k="SGST" v={inr(v.sgst)} />
                  <div className="my-1.5 h-px bg-border" />
                </>
              )}
              <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>Total</span><span>{inr(v.totalAmount)}</span></div>
              {v.notes && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-2xs text-muted">{v.notes}</p>}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>;
}
