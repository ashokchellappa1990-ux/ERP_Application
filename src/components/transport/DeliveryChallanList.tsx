"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { formatMoneyWith } from "@/lib/settings/generalConfig";

interface Row { id: number; dcNo: string; dcDate: string; dispatchExecutionId: number; customerName: string; totalQty: number; totalValue: number; status: string; printedCount: number }

const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "danger"> = {
  Draft: "neutral", Generated: "primary", Printed: "success", Cancelled: "danger",
};
const fInp = "h-9 rounded-lg border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none";

export function DeliveryChallanList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const gcfg = useGeneralConfig();
  const inr = (x: number) => formatMoneyWith(gcfg, x);

  const qs = useMemo(() => { const p = new URLSearchParams(); if (q) p.set("q", q); if (status !== "All") p.set("status", status); return p.toString(); }, [q, status]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try { const j = await fetch(`/api/transport/delivery-challan?${qs}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }
      catch { /* */ } finally { setLoading(false); }
    })();
  }, [qs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><FileText className="h-6 w-6" /></span>
        <div>
          <h1 className="text-lg font-bold text-foreground">Delivery Challan</h1>
          <p className="mt-0.5 text-xs text-muted">Generated automatically when a dispatch execution completes — view, print &amp; reprint here.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search DC no / customer…" className={`${fInp} w-64 pl-8`} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={fInp}>
          {["All", "Draft", "Generated", "Printed", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading delivery challans…" size="sm" /></div>}

      {!loading && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">DC No</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Printed</th></tr></thead>
              <tbody>
                {(rows ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                    <td className="px-4 py-2.5"><Link href={`/transport/delivery-challan/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.dcNo}</Link></td>
                    <td className="px-4 py-2.5 text-muted">{r.dcDate}</td>
                    <td className="px-4 py-2.5 text-foreground">{r.customerName || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.totalQty}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground">{inr(r.totalValue)}</td>
                    <td className="px-4 py-2.5"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                    <td className="px-4 py-2.5 text-right text-muted">{r.printedCount}</td>
                  </tr>
                ))}
                {(rows ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No delivery challans found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
