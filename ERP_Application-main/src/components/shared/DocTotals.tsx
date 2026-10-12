"use client";

import { cn } from "@/lib/cn";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { type TxnInput, type DiscType, type TaxRow } from "@/lib/shared/docMath";

interface Totals { taxable: number; tax: number; lineDisc: number; txnDisc: number; tds: number; tcs: number; other: number; roundoff: number; total: number; taxBreakup: TaxRow[]; cgstTotal: number; sgstTotal: number; igstTotal: number; interState: boolean }

/** Reusable totals + tax/discount panel for commercial documents. */
export function DocTotals({
  discLevel, txn, setTxn, totals, taxMethod, totalLabel = "Total", discountsOn = true,
  showTax = true, showTxnDiscount = true, showTds = true, showTcs = true, showOther = true,
  interState, setInterState,
}: {
  discLevel: "item" | "transaction";
  txn: TxnInput;
  setTxn: (t: TxnInput) => void;
  totals: Totals;
  taxMethod: string;
  totalLabel?: string;
  discountsOn?: boolean;
  showTax?: boolean;
  showTxnDiscount?: boolean;
  showTds?: boolean;
  showTcs?: boolean;
  showOther?: boolean;
  interState?: boolean;
  setInterState?: (v: boolean) => void;
}) {
  const fmt = useFmt();
  const inr = (n: number) => fmt.money(n);
  const set = (patch: Partial<TxnInput>) => setTxn({ ...txn, ...patch });
  const TypeToggle = ({ value, onChange }: { value: DiscType; onChange: (v: DiscType) => void }) => (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      {(["pct", "val"] as DiscType[]).map((t) => (
        <button key={t} type="button" onClick={() => onChange(t)} className={cn("px-2 py-0.5 text-2xs font-bold transition", value === t ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{t === "pct" ? "%" : "₹"}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-1.5 text-sm">
      {discountsOn && totals.lineDisc > 0 && <Row k="Item Discount" v={`- ${inr(totals.lineDisc)}`} tone="success" />}
      <Row k="Taxable" v={inr(totals.taxable + totals.txnDisc)} />

      {discountsOn && showTxnDiscount && discLevel === "transaction" && (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-muted">Discount <TypeToggle value={txn.discType} onChange={(v) => set({ discType: v })} /></span>
          <input type="number" value={txn.disc || ""} onChange={(e) => set({ disc: Number(e.target.value) })} placeholder="0" className="h-7 w-20 rounded border border-border bg-surface-2 px-2 text-right text-xs focus:border-primary focus:outline-none" />
        </div>
      )}
      {discLevel === "transaction" && totals.txnDisc > 0 && <Row k="Discount Applied" v={`- ${inr(totals.txnDisc)}`} tone="success" />}

      {showTax && (
        <>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">GST ({taxMethod})</span>
            {setInterState && (
              <div className="inline-flex overflow-hidden rounded-md border border-border">
                <button type="button" onClick={() => setInterState(false)} className={cn("px-2 py-0.5 text-[10px] font-bold transition", !interState ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>Intra (CGST+SGST)</button>
                <button type="button" onClick={() => setInterState(true)} className={cn("px-2 py-0.5 text-[10px] font-bold transition", interState ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>Inter (IGST)</button>
              </div>
            )}
          </div>
          {totals.taxBreakup.length === 0 && <Row k="GST" v={inr(0)} />}
          {totals.taxBreakup.map((r) => totals.interState
            ? <Row key={r.rate} k={`IGST @ ${r.rate}%`} v={inr(r.igst)} />
            : <div key={r.rate} className="space-y-0.5">
                <Row k={`CGST @ ${r.rate / 2}%`} v={inr(r.cgst)} />
                <Row k={`SGST @ ${r.rate / 2}%`} v={inr(r.sgst)} />
              </div>
          )}
        </>
      )}

      {/* TDS / TCS / Other taxes & charges */}
      {showTds && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">TDS %</span>
          <span className="flex items-center gap-2"><input type="number" value={txn.tds || ""} onChange={(e) => set({ tds: Number(e.target.value) })} placeholder="0" className="h-7 w-14 rounded border border-border bg-surface-2 px-2 text-right text-xs focus:border-primary focus:outline-none" />{totals.tds > 0 && <span className="text-danger">- {inr(totals.tds)}</span>}</span>
        </div>
      )}
      {showTcs && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">TCS %</span>
          <span className="flex items-center gap-2"><input type="number" value={txn.tcs || ""} onChange={(e) => set({ tcs: Number(e.target.value) })} placeholder="0" className="h-7 w-14 rounded border border-border bg-surface-2 px-2 text-right text-xs focus:border-primary focus:outline-none" />{totals.tcs > 0 && <span className="text-foreground">{inr(totals.tcs)}</span>}</span>
        </div>
      )}
      {showOther && (
        <div className="flex items-center justify-between gap-2">
          <input value={txn.otherLabel} onChange={(e) => set({ otherLabel: e.target.value })} className="h-7 w-28 rounded border border-transparent bg-transparent px-0 text-xs text-muted focus:border-border focus:bg-surface-2 focus:px-2 focus:outline-none" />
          <input type="number" value={txn.other || ""} onChange={(e) => set({ other: Number(e.target.value) })} placeholder="0" className="h-7 w-20 rounded border border-border bg-surface-2 px-2 text-right text-xs focus:border-primary focus:outline-none" />
        </div>
      )}

      <Row k="Round Off" v={inr(totals.roundoff)} />
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-bold text-foreground"><span>{totalLabel}</span><span>{inr(totals.total)}</span></div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "success" | "danger" }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className={cn("font-semibold", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground")}>{v}</span></div>;
}
