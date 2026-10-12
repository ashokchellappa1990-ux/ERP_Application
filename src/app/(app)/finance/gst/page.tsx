import Link from "next/link";
import { Receipt, Settings2, FileBarChart, ArrowRight, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { financeNotesFor } from "@/lib/finance/financeData";
import { cn } from "@/lib/cn";

const RETURNS = [
  { id: "gstr1", name: "GSTR-1", desc: "Outward supplies", due: "11-Jul", status: "Ready" },
  { id: "gstr2b", name: "GSTR-2B", desc: "Auto-drafted ITC", due: "Auto", status: "Reconciled" },
  { id: "gstr3b", name: "GSTR-3B", desc: "Summary & payment", due: "20-Jul", status: "Pending" },
  { id: "gstr9", name: "GSTR-9", desc: "Annual return", due: "31-Dec", status: "Upcoming" },
];
const STAT_TONES = { primary: "bg-primary text-white", danger: "bg-danger text-white", success: "bg-success text-white", warning: "bg-warning text-white" } as const;

export default function GstManagementPage() {
  const notes = financeNotesFor("gst");
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">GST Management</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Receipt className="h-5 w-5 text-primary" /> GST Management</h1>
        <p className="mt-0.5 text-sm text-muted">GSTR-1/2B/3B/9, reconciliation, audit reports &amp; liability tracking.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Output GST" value="₹2.84L" tone="primary" />
        <Stat label="Input GST (ITC)" value="₹2.66L" tone="success" />
        <Stat label="Net Payable" value="₹0.18L" tone="danger" />
        <Stat label="ITC Mismatch" value="₹4.2k" tone="warning" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RETURNS.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-subtle text-primary"><FileBarChart className="h-5 w-5" /></span><Badge tone={r.status === "Pending" ? "warning" : r.status === "Reconciled" || r.status === "Ready" ? "success" : "neutral"}>{r.status}</Badge></div>
            <p className="text-sm font-bold text-foreground">{r.name}</p>
            <p className="text-2xs text-muted">{r.desc}</p>
            <p className="mt-2 text-2xs text-muted">Due: <span className="font-semibold text-foreground">{r.due}</span></p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted">GST liability auto-computed from sales/purchase; e-invoice &amp; e-way bill generated automatically.</p>
        <div className="flex gap-2"><Link href="/finance/einvoice" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">E-Invoice <ArrowRight className="h-3 w-3" /></Link><Link href="/finance/eway" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">E-Way Bill <ArrowRight className="h-3 w-3" /></Link></div>
      </div>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone: keyof typeof STAT_TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg text-2xs font-bold shadow-sm", STAT_TONES[tone])}>₹</span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}
