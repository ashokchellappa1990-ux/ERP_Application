"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  isWeightUom, resolveWeightUnit, weightBreakdown, weightUnitOptions,
  convertWeight, fmtQty, weightLabel,
} from "@/lib/uom/weight";

/**
 * Weight-unit conversion affordance shown next to a quantity field/cell.
 *
 * Renders NOTHING unless `uom` is a weight unit (Kg / Gram / Quintal / Ton …).
 * Click the ⇄ button → a popover shows the current qty in every weight unit
 * (VIEW). When `onChange` is provided (entry screens), the user can also type a
 * value in any unit and it is converted back to `uom` and pushed via onChange
 * (CHANGE). Storage always stays in `uom`; this only converts for the human.
 */
export function UomConvert({
  qty,
  uom,
  onChange,
  className,
}: {
  qty: number | string;
  uom: string;
  onChange?: (qtyInUom: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const q = Number(qty) || 0;
  const editable = typeof onChange === "function";
  const options = weightUnitOptions(uom);
  const [unit, setUnit] = useState(() => resolveWeightUnit(uom)?.key ?? "kg");
  const [val, setVal] = useState(() => fmtQty(q));

  // Close when clicking outside the popover.
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Sync the picker to the current qty each time it opens.
  useEffect(() => {
    if (open) { setUnit(resolveWeightUnit(uom)?.key ?? "kg"); setVal(fmtQty(q)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!isWeightUom(uom)) return null;

  const rows = weightBreakdown(q, uom);
  const pickUnit = (k: string) => {
    const conv = convertWeight(Number(val) || 0, unit, k);
    setUnit(k);
    setVal(fmtQty(conv ?? 0));
  };
  const apply = () => {
    const base = convertWeight(Number(val) || 0, unit, uom);
    if (base != null && onChange) onChange(+base.toFixed(6));
    setOpen(false);
  };

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label="Convert units"
        title={`Convert ${weightLabel(uom)} to other units`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        className={cn(
          "grid h-6 w-6 place-items-center rounded-md border transition",
          open ? "border-primary bg-primary-subtle text-primary" : "border-border text-subtle hover:border-primary/40 hover:text-primary",
        )}
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div role="dialog" onClick={(e) => e.stopPropagation()} className="absolute right-0 top-7 z-50 w-60 rounded-xl border border-border bg-card p-3 text-xs shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-foreground">Unit conversion</span>
            <span className="text-2xs text-muted">{fmtQty(q)} {weightLabel(uom)}</span>
          </div>
          <table className="w-full">
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={cn("border-t border-border/50 first:border-t-0", resolveWeightUnit(uom)?.key === r.key && "text-primary")}>
                  <td className="py-1 text-muted">{r.label}</td>
                  <td className="py-1 text-right font-medium text-foreground">{fmtQty(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {editable && (
            <div className="mt-3 border-t border-border pt-2">
              <p className="mb-1.5 text-2xs font-medium text-muted">Enter in another unit → sets qty in {weightLabel(uom)}</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none"
                />
                <select
                  value={unit}
                  onChange={(e) => pickUnit(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-border bg-surface px-1 text-xs focus:border-primary focus:outline-none"
                >
                  {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={apply}
                  className="h-8 rounded-md bg-primary px-2 text-2xs font-semibold text-white transition hover:brightness-105"
                >
                  Set
                </button>
              </div>
              <p className="mt-1 text-2xs text-muted">= {fmtQty(convertWeight(Number(val) || 0, unit, uom) ?? 0)} {weightLabel(uom)}</p>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
