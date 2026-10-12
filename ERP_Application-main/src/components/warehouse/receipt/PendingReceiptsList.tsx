"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { DISPATCH_STATUS_TONE } from "@/lib/contracts/stockDispatch";

interface Row { dispatchId: number; dispatchNo: string; dispatchDate: string; referenceNo: string | null; source: string; destination: string; totalItems: number; totalDispatchQty: number; status: string }

export function PendingReceiptsList({ embedded }: { embedded?: boolean } = {}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { fetch("/api/warehouse/receipt/pending", { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])); }, []);

  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Pending Receipts</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ClipboardCheck className="h-5 w-5 text-primary" /> Pending Receipts</h1>
          <p className="mt-0.5 text-sm text-muted">Dispatched documents in-transit to your branch, awaiting acknowledgement.</p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Dispatch No.</th><th className="px-4 py-3">Dispatch Date</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows && rows.map((r) => (
                <tr key={r.dispatchId} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{r.dispatchNo}</td>
                  <td className="px-4 py-2.5 text-muted">{r.dispatchDate}</td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-muted">{r.referenceNo || "—"}</td>
                  <td className="px-4 py-2.5 text-muted">{r.source}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.destination}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.totalItems}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{r.totalDispatchQty}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={DISPATCH_STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right"><Link href={`/warehouse/transfer/receipt/new?dispatchId=${r.dispatchId}`}><Button size="sm"><PackageCheck className="h-3.5 w-3.5" /> Receive</Button></Link></td>
                </tr>
              ))}
              {!rows && <tr><td colSpan={9} className="px-4 py-10"><AppLoader label="Loading pending receipts…" size="sm" /></td></tr>}
              {rows && rows.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted">No dispatches are awaiting receipt at your branch.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
