"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageOpen, Search, Eye, Printer, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { RECEIPT_STATUSES, RECEIPT_STATUS_TONE } from "@/lib/contracts/stockReceipt";

interface Row { id: number; receiptNo: string; receiptDate: string; dispatchNo: string | null; dispatchDate: string | null; source: string; destination: string; totalItems: number; totalReceivedQty: number; totalDamagedQty: number; totalMissingQty: number; status: string; createdByName: string | null; receivedByName: string | null }
const fInp = "h-10 rounded-xl border border-border-strong bg-card text-sm text-foreground focus:border-primary focus:outline-none";

export function ReceiptList({ mode, embedded }: { mode: "active" | "history"; embedded?: boolean }) {
  const router = useRouter();
  const isHistory = mode === "history";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState({ q: "", from: "", to: "", status: "All" });

  const load = () => {
    setRows(null);
    const p = new URLSearchParams();
    if (isHistory) p.set("history", "1");
    Object.entries(f).forEach(([k, v]) => { if (v && v !== "All") p.set(k, v); });
    fetch(`/api/warehouse/receipt?${p.toString()}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : []));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">{isHistory ? "Receipt History" : "Stock Transfer Receipt"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageOpen className="h-5 w-5 text-primary" /> {isHistory ? "Receipt History" : "Stock Transfer Receipt"}</h1>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Receipt / dispatch no…" className={cn(fInp, "w-full pl-10 pr-3")} />
        </div>
        <label className="flex items-center gap-1.5"><span className="text-2xs font-medium text-muted">From</span><input type="date" className={cn(fInp, "px-2.5")} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="flex items-center gap-1.5"><span className="text-2xs font-medium text-muted">To</span><input type="date" className={cn(fInp, "px-2.5")} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        {!isHistory && <select className={cn(fInp, "px-2.5")} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="All">All statuses</option>{RECEIPT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>}
        <Button size="md" variant="outline" onClick={load}>Apply</Button>
        <Button size="md" variant="ghost" onClick={() => { setF({ q: "", from: "", to: "", status: "All" }); setTimeout(load, 0); }}><RotateCcw className="h-4 w-4" /> Reset</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Receipt No.</th><th className="px-4 py-3">Dispatch No.</th><th className="px-4 py-3">Disp. Date</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3 text-right">Recd</th><th className="px-4 py-3 text-right">Dmg</th><th className="px-4 py-3 text-right">Miss</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3">Received By</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows && rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                  <td className="px-4 py-2.5"><Link href={`/warehouse/transfer/receipt/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.receiptNo}</Link></td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-muted">{r.dispatchNo || "—"}</td>
                  <td className="px-4 py-2.5 text-muted">{r.dispatchDate || "—"}</td>
                  <td className="px-4 py-2.5 text-muted">{r.source}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.destination}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{r.totalReceivedQty}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-warning">{r.totalDamagedQty || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-danger">{r.totalMissingQty || "—"}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={RECEIPT_STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-4 py-2.5 text-muted">{r.receivedByName || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/warehouse/transfer/receipt/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><Eye className="h-4 w-4" /></Link>
                      <button onClick={() => router.push(`/warehouse/transfer/receipt/${r.id}?print=1`)} title="Print" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/30 hover:bg-primary-subtle hover:text-primary"><Printer className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows && <tr><td colSpan={11} className="px-4 py-10"><AppLoader label="Loading receipts…" size="sm" /></td></tr>}
              {rows && rows.length === 0 && <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-muted">{isHistory ? "No receipt history yet." : "No receipts yet. Receive a dispatched document from Pending Receipts."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
