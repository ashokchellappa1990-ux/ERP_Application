"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, ArrowLeft, Truck, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";

interface Alloc { payableId: number; refNo: string; sourceType: string; sourceId: number | null; amount: number }
interface Payment { id: number; paymentNo: string; supplier: string; paymentDate: string; mode: string; reference: string; totalAmount: number; notes: string; status: string; allocations: Alloc[] }

export function SupplierPaymentView({ id }: { id: number }) {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [pay, setPay] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { try { const j = await fetch(`/api/purchase/supplier-payment/${id}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setPay(j.payment); } catch { /* */ } finally { setLoading(false); } })();
  }, [id]);

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading payment…" size="sm" /></div>;
  if (!pay) return <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">Payment not found. <Link href="/purchase/payments" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/payments" className="hover:text-foreground">Supplier Payments</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{pay.paymentNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Banknote className="h-5 w-5 text-primary" /> {pay.paymentNo}</h1>
        </div>
        <Link href="/purchase/payments"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <SectionCard icon={FileText} title="Invoices Settled" bodyClass="">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Invoice</th><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5 text-right">Amount Paid</th></tr></thead>
              <tbody>
                {pay.allocations.map((a, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5"><Link href={a.sourceType === "GRN" && a.sourceId ? `/purchase/grn/${a.sourceId}` : "#"} className="font-mono text-2xs font-semibold text-primary hover:underline">{a.refNo}</Link></td>
                    <td className="px-4 py-2.5 text-2xs text-muted">{a.sourceType}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground">{inr(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-4 py-3" colSpan={2}>Total Paid</td><td className="px-4 py-3 text-right tabular-nums">{inr(pay.totalAmount)}</td></tr></tfoot>
            </table>
          </div>
        </SectionCard>

        <aside>
          <SectionCard icon={Truck} title="Payment Details">
            <div className="space-y-2 text-sm">
              <Row k="Supplier" v={pay.supplier || "—"} />
              <Row k="Date" v={pay.paymentDate} />
              <Row k="Mode" v={pay.mode} />
              {pay.reference && <Row k="Reference" v={pay.reference} />}
              <Row k="Status" v={pay.status} />
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>Total</span><span>{inr(pay.totalAmount)}</span></div>
              {pay.notes && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-2xs text-muted">{pay.notes}</p>}
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
