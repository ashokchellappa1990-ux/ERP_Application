import Link from "next/link";
import { FileBarChart, ArrowRight } from "lucide-react";
import { PURCHASE_REPORTS } from "@/lib/purchase/purchaseData";
import { pflag } from "@/lib/purchase/purchaseConfig";

export default function PurchaseReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase" className="hover:text-foreground">Purchase</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Reports</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileBarChart className="h-5 w-5 text-primary" /> Purchase Reports</h1>
        <p className="mt-0.5 text-sm text-muted">Procurement &amp; payables reports{pflag("threeWayMatch") ? " — incl. 3-way match & price variance" : ""}.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PURCHASE_REPORTS.map((r) => (
          <button key={r.id} className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary transition group-hover:bg-brand-gradient group-hover:text-white"><FileBarChart className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{r.name}</p><p className="text-2xs text-muted">{r.desc}</p></div>
            <ArrowRight className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
