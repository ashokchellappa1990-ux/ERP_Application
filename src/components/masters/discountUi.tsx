"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface Option { value: string; label: string }
/** Searchable master-driven picker with Select-all; multi by default, `single` opt-in. */
export function MultiSelect({ label, options, value, onChange, single, placeholder }: { label?: string; options: Option[]; value?: string[]; onChange: (v: string[]) => void; single?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const sel = value ?? [];
  const filtered = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())), [options, q]);
  const allVals = useMemo(() => options.map((o) => o.value), [options]);
  const allSelected = allVals.length > 0 && allVals.every((v) => sel.includes(v));
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) => { if (single) { onChange([v]); setOpen(false); return; } onChange(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]); };
  return (
    <div>
      {label && <label className={lbl}>{label}</label>}
      <div className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)} className={cn(inp, "flex min-h-9 flex-wrap items-center gap-1 py-1.5 pr-8 text-left")}>
          {sel.length === 0 ? <span className="text-subtle">{placeholder ?? (single ? "Select…" : "All (no restriction)")}</span> : sel.slice(0, 8).map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-semibold text-primary" onClick={(e) => { e.stopPropagation(); toggle(v); }}>{labelOf(v)}<X className="h-3 w-3" /></span>
          ))}
          {sel.length > 8 && <span className="text-2xs font-medium text-muted">+{sel.length - 8} more</span>}
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-subtle" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 z-50 mt-1 w-full min-w-[15rem] rounded-xl border border-border bg-card p-2 shadow-2xl">
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className={cn(inp, "mb-1.5 h-8")} />
              {!single && (
                <div className="mb-1 flex items-center justify-between px-1 text-2xs">
                  <button type="button" onClick={() => onChange(allSelected ? [] : allVals)} className="font-bold text-primary hover:underline">{allSelected ? "Clear all" : `Select all (${options.length})`}</button>
                  <span className="text-muted">{sel.length} selected</span>
                </div>
              )}
              <div className="max-h-56 overflow-y-auto">
                {filtered.length === 0 && <div className="px-2 py-3 text-center text-2xs text-muted">No matches.</div>}
                {filtered.map((o) => { const on = sel.includes(o.value); return (
                  <button type="button" key={o.value} onClick={() => toggle(o.value)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-surface-2", on && "bg-primary-subtle/50")}>
                    <span className={cn("grid h-4 w-4 shrink-0 place-items-center border", single ? "rounded-full" : "rounded", on ? "border-primary bg-primary text-white" : "border-border")}>{on && <Check className="h-3 w-3" />}</span>
                    <span className="truncate text-foreground">{o.label}</span>
                  </button>
                ); })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Shared primitives for the Discount Management console + full-page editor. */
export const API = "/api/discount";
export const inp = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
export const lbl = "mb-1 block text-2xs font-semibold text-muted";
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const lakh = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : inr(n));
export const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = { Active: "success", Draft: "warning", Inactive: "neutral", Expired: "danger" };

export const post = async (payload: Record<string, unknown>) => {
  const r = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false, message: "Network error." }));
};

export const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
export const F = ({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) => <div className={full ? "sm:col-span-2" : ""}><label className={lbl}>{label}</label>{children}</div>;
export const Sel = ({ v, opts, on }: { v: string; opts: string[]; on: (v: string) => void }) => <select className={inp} value={v} onChange={(e) => on(e.target.value)}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
export function Tog({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"><span className="text-foreground">{label}</span><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-primary" /></label>;
}
export function Chips({ label, opts, sel, on }: { label: string; opts: string[]; sel?: string[]; on: (v: string[]) => void }) {
  const arr = sel ?? [];
  return <div><span className={lbl}>{label}</span><div className="flex flex-wrap gap-1.5">{opts.map((o) => { const active = arr.includes(o); return <button key={o} type="button" onClick={() => on(active ? arr.filter((x) => x !== o) : [...arr, o])} className={cn("rounded-full border px-2.5 py-1 text-2xs font-semibold transition", active ? "border-primary bg-primary text-white" : "border-border bg-surface text-muted hover:border-primary")}>{o}</button>; })}</div></div>;
}
export function CSV({ label, val, on }: { label: string; val?: string[]; on: (v: string[]) => void }) {
  return <div><label className={lbl}>{label}</label><input className={inp} value={(val ?? []).join(", ")} onChange={(e) => on(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} placeholder="value1, value2" /></div>;
}
