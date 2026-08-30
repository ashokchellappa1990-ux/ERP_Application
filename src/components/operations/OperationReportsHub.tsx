"use client";

import Link from "next/link";
import { FileBarChart, ChevronRight, Truck } from "lucide-react";

const REPORTS = [
  {
    href: "/operations/reports/raw-material",
    icon: Truck,
    title: "Raw Material Report",
    desc: "Inbound quarry / supplier receipts — vehicle, weighment, product and destination detail, with Product/Vehicle/Supplier/Driver summaries.",
  },
] as const;

/** Operation Reports landing page — pick a report to open. New report types
 * get added to REPORTS above; the sidebar keeps exactly one nav entry
 * ("Operation Reports") no matter how many reports live under it. */
export function OperationReportsHub() {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Operation Reports</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileBarChart className="h-5 w-5 text-primary" /> Operation Reports</h1>
        <p className="mt-0.5 text-sm text-muted">Pick a report to view, filter, print, or export.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-sm"><r.icon className="h-5 w-5" /></span>
              <ChevronRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">{r.title}</h3>
              <p className="mt-1 text-2xs text-muted">{r.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
