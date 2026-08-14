"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import type { StockPositionBucket, StockPositionDetailRow } from "@/lib/contracts/openingStock";

const BUCKET_LABEL: Record<StockPositionBucket, string> = {
  receipt: "Receipt", ret: "Sales Return", sales: "Sales", purchaseRet: "Purchase Return", transfer: "Transfer Out", inTransit: "In-Transit", wastage: "Wastage", damage: "Damage",
};

// Friendlier labels for transaction types a user wouldn't otherwise recognize
// (Material Processing's internal txnTypes) — falls back to a de-slugged
// version of the raw txnType for everything else.
const TXN_TYPE_LABEL: Record<string, string> = {
  MP_ISSUE: "Issued to Processing",
  MP_WIP_IN: "WIP Receipt",
  MP_WIP_OUT: "WIP Cleared — Transfer Out",
  MP_WASTAGE: "Process Loss",
  MP_RECEIPT: "Finished Goods Receipt",
};
function txnTypeLabel(txnType: string): string {
  return TXN_TYPE_LABEL[txnType] ?? txnType.replace(/_/g, " ");
}

export interface DrillTarget { productId: number; date: string; bucket: StockPositionBucket; areaId?: number | "" }

/** Click-through detail for one Stock Position cell — date + ref/GRN-wise rows
 * behind the aggregated day total, so "Receipt 136.00" expands into which GRNs
 * (or other source docs) actually made up that figure. */
export function StockPositionDrillIn({
  target, onClose, fq, fm,
}: { target: DrillTarget; onClose: () => void; fq: (n: number) => string; fm: (n: number) => string }) {
  const [rows, setRows] = useState<StockPositionDetailRow[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ productId: String(target.productId), date: target.date, bucket: target.bucket });
        if (target.areaId) params.set("areaId", String(target.areaId));
        const j = await fetch(`/api/inventory/stock-position/detail?${params}`, { cache: "no-store" }).then((r) => r.json());
        if (active && j.ok) { setRows(j.rows); setTotalQty(j.totalQty); setTotalValue(j.totalValue); }
      } catch { /* ignore */ } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [target.productId, target.date, target.bucket, target.areaId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-base font-bold text-foreground">{BUCKET_LABEL[target.bucket]} — {target.date}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-2.5">Reference</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Area</th>
                <th className="px-4 py-2.5 text-right">Qty</th><th className="px-4 py-2.5 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/15">
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.refNo || "—"}{r.batchNo ? <span className="ml-1 font-mono text-2xs text-subtle">· {r.batchNo}</span> : null}</td>
                  <td className="px-4 py-2.5 text-2xs text-muted">{txnTypeLabel(r.txnType)}</td>
                  <td className="px-4 py-2.5 text-muted">{r.areaName || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground">{fq(r.qty)}</td>
                  <td className="px-4 py-2.5 text-right text-muted">{r.value != null ? fm(r.value) : "—"}</td>
                </tr>
              ))}
              {loading && <tr><td colSpan={5} className="px-4 py-8"><AppLoader label="Loading…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">No matching movements found.</td></tr>}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-end gap-4 border-t border-border bg-surface-2 px-5 py-2.5 text-sm font-bold text-foreground">
            <span>Total Qty: {fq(totalQty)}</span><span>Total Value: {fm(totalValue)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
