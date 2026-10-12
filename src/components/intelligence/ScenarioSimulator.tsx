"use client";

import { useState } from "react";
import { SlidersHorizontal, Play, Save, RotateCcw } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { ScenarioCompare } from "./charts";
import { jsend, type ScenarioResultT } from "./api";

/** SCENARIO SIMULATOR (Module 12) — sliders → instant recompute of revenue/profit/cash/etc. */

interface Inputs { salesChangePct: number; expenseChangePct: number; discountPct: number; marketingBudget: number; supplierPriceChangePct: number; gstChangePct: number; salaryChangePct: number; newBranch: boolean }
const ZERO: Inputs = { salesChangePct: 0, expenseChangePct: 0, discountPct: 0, marketingBudget: 0, supplierPriceChangePct: 0, gstChangePct: 0, salaryChangePct: 0, newBranch: false };

const SLIDERS: { key: keyof Inputs; label: string; min: number; max: number; step: number; suffix: string }[] = [
  { key: "salesChangePct", label: "Sales change", min: -50, max: 100, step: 1, suffix: "%" },
  { key: "expenseChangePct", label: "Expense change", min: -50, max: 100, step: 1, suffix: "%" },
  { key: "discountPct", label: "Extra discount", min: 0, max: 50, step: 1, suffix: "%" },
  { key: "supplierPriceChangePct", label: "Supplier price change", min: -30, max: 50, step: 1, suffix: "%" },
  { key: "gstChangePct", label: "GST rate change", min: -50, max: 50, step: 1, suffix: "%" },
  { key: "salaryChangePct", label: "Salary revision", min: -20, max: 50, step: 1, suffix: "%" },
];

export function ScenarioSimulator() {
  const toast = useToast();
  const [inputs, setInputs] = useState<Inputs>(ZERO);
  const [result, setResult] = useState<ScenarioResultT | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Inputs>) => setInputs((p) => ({ ...p, ...patch }));

  const run = async () => { setBusy(true); const j = await jsend<{ ok: boolean; result: ScenarioResultT }>("/api/ai/decision/scenario", "POST", { inputs }); setBusy(false); if (j.ok) setResult(j.result); };
  const save = async () => { const name = prompt("Name this scenario:"); if (!name) return; const j = await jsend<{ ok: boolean }>("/api/ai/decision/scenario", "POST", { inputs, save: true, name }); if (j.ok) toast.success("Scenario saved."); };
  const reset = () => { setInputs(ZERO); setResult(null); };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-sm font-bold text-foreground"><SlidersHorizontal className="h-4 w-4 text-primary" /> What-if levers</div>
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex justify-between text-2xs"><span className="text-muted">{s.label}</span><span className="font-semibold text-foreground">{inputs[s.key] as number > 0 ? "+" : ""}{inputs[s.key] as number}{s.suffix}</span></div>
            <input type="range" min={s.min} max={s.max} step={s.step} value={inputs[s.key] as number} onChange={(e) => set({ [s.key]: Number(e.target.value) } as Partial<Inputs>)} className="w-full accent-[var(--color-primary,#6366f1)]" />
          </div>
        ))}
        <div><div className="flex justify-between text-2xs"><span className="text-muted">Extra marketing budget</span><span className="font-semibold text-foreground">₹{inputs.marketingBudget.toLocaleString("en-IN")}</span></div>
          <input type="range" min={0} max={500000} step={10000} value={inputs.marketingBudget} onChange={(e) => set({ marketingBudget: Number(e.target.value) })} className="w-full accent-[var(--color-primary,#6366f1)]" /></div>
        <label className="flex items-center gap-2 text-2xs font-semibold text-foreground"><input type="checkbox" checked={inputs.newBranch} onChange={(e) => set({ newBranch: e.target.checked })} /> Open a new branch</label>
        <div className="flex gap-2 pt-1">
          <button onClick={run} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-2xs font-bold text-white disabled:opacity-50"><Play className="h-4 w-4" /> Simulate</button>
          <button onClick={reset} className="rounded-lg border border-border px-3 py-2 text-2xs font-semibold text-muted"><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        {busy ? <AppLoader label="Recomputing…" /> : !result ? <p className="grid h-40 place-items-center text-center text-2xs text-muted">Adjust the levers and hit Simulate to see the projected impact on revenue, profit, cash flow, working capital, inventory and customers — instantly, without posting anything.</p> : (
          <div className="space-y-3">
            <div className="flex items-center justify-between"><p className="text-2xs text-foreground">{result.summary}</p><button onClick={save} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted hover:text-primary"><Save className="h-3 w-3" /> Save</button></div>
            <ScenarioCompare metrics={result.metrics} />
          </div>
        )}
      </div>
    </div>
  );
}
