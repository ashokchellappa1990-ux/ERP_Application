import Link from "next/link";
import { FileBarChart, ArrowRight } from "lucide-react";
import { REPORTS } from "@/lib/sales/salesData";
import { flag } from "@/lib/settings/salesConfigDefaults";

export default function SalesReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales" className="hover:text-foreground">Sales</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Reports</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileBarChart className="h-5 w-5 text-primary" /> Sales Reports</h1>
        <p className="mt-0.5 text-sm text-muted">Statutory &amp; operational reports{flag("eInvoice") ? " — GST e-invoice data included" : ""}.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {REPORTS.map((r) => (
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
