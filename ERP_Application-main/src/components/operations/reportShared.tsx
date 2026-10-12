"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SlidersHorizontal, Pencil, Check } from "lucide-react";

/** Shared building blocks for the Operation Reports screens (Raw Material,
 * Sales, Daily Statement, …) — column visibility + rename (persisted),
 * the company letterhead fetch, and small display primitives — so each
 * report only needs to define its own columns/data/print sections. */

export const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
export const lbl = "mb-1 block text-2xs font-semibold text-muted";
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));

export interface Company { name: string; address: string; gst: string; phone: string }

export function useCompany(): Company | null {
  const [company, setCompany] = useState<Company | null>(null);
  useEffect(() => {
    fetch("/api/company-setup", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok && j.exists) setCompany({ name: j.data.company.name, address: [j.data.company.address, j.data.company.city, j.data.company.state, j.data.company.pincode].filter(Boolean).join(", "), gst: j.data.company.gst, phone: j.data.company.phone });
    }).catch(() => {});
  }, []);
  return company;
}

/** Computed only after mount — avoids a React hydration mismatch from
 * `new Date()` differing between the server render pass and client hydration. */
export function useGeneratedAt(): string {
  const [t, setT] = useState("");
  useEffect(() => { setT(new Date().toLocaleString()); }, []);
  return t;
}

export interface ReportColumn<K extends string = string> { key: K; label: string; money?: boolean }

/** Column visibility + rename, persisted to localStorage under `storageKey`.
 * `labelFor`/`columns` reflect any custom names, used consistently across
 * the on-screen table, Print, Excel and CSV. */
export function useReportColumns<K extends string>(storageKey: string, defaultColumns: ReportColumn<K>[]) {
  const [cols, setCols] = useState<Set<string>>(new Set(defaultColumns.map((c) => c.key)));
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(`${storageKey}-cols`) ?? "null"); if (Array.isArray(saved)) setCols(new Set(saved)); } catch { /* ignore */ }
    try { const savedLabels = JSON.parse(localStorage.getItem(`${storageKey}-labels`) ?? "null"); if (savedLabels && typeof savedLabels === "object") setLabels(savedLabels); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggleCol = (k: string) => setCols((prev) => {
    const next = new Set(prev); if (next.has(k)) next.delete(k); else next.add(k);
    try { localStorage.setItem(`${storageKey}-cols`, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
    return next;
  });
  const renameCol = (k: string, name: string) => setLabels((prev) => {
    const next = { ...prev, [k]: name.trim() || defaultColumns.find((c) => c.key === k)!.label };
    try { localStorage.setItem(`${storageKey}-labels`, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const labelFor = (k: string) => labels[k] || defaultColumns.find((c) => c.key === k)?.label || k;
  const columns = defaultColumns.map((c) => ({ ...c, label: labelFor(c.key) }));
  const visibleCols = columns.filter((c) => cols.has(c.key));
  return { cols, toggleCol, renameCol, columns, visibleCols };
}

export function ColumnPicker({ columns, cols, onToggle, onRename }: { columns: { key: string; label: string }[]; cols: Set<string>; onToggle: (k: string) => void; onRename: (k: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  return (
    <div className="relative">
      <Button variant="outline" size="md" onClick={() => setOpen((o) => !o)}><SlidersHorizontal className="h-4 w-4" /> Columns</Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setEditing(null); }} />
          <div className="absolute right-0 top-full z-20 mt-2 max-h-96 w-80 overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-xl">
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Visible Columns — click the pencil to rename</p>
            <div className="space-y-1.5">
              {columns.map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={cols.has(c.key)} onChange={() => onToggle(c.key)} className="h-4 w-4 shrink-0 accent-primary" />
                    {editing === c.key ? (
                      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { onRename(c.key, draft); setEditing(null); } if (e.key === "Escape") setEditing(null); }} className="h-7 flex-1 rounded border border-border-strong bg-surface px-1.5 text-xs" />
                    ) : <span className="truncate">{c.label}</span>}
                  </label>
                  {editing === c.key ? (
                    <button type="button" onClick={() => { onRename(c.key, draft); setEditing(null); }} className="shrink-0 text-success"><Check className="h-3.5 w-3.5" /></button>
                  ) : (
                    <button type="button" onClick={() => { setEditing(c.key); setDraft(c.label); }} className="shrink-0 text-muted hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 border-t border-border pt-2 text-2xs text-subtle">S.No always shows. Renamed columns are remembered and used everywhere (screen, print, Excel, CSV).</p>
          </div>
        </>
      )}
    </div>
  );
}

export function StatCard({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "primary" | "info" | "success" | "warning" | "danger" | "neutral" }) {
  const toneText: Record<string, string> = { primary: "text-primary", info: "text-info", success: "text-success", warning: "text-warning", danger: "text-danger", neutral: "text-foreground" };
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <p className={cn("text-xl font-bold tabular-nums", toneText[tone])}>{typeof value === "number" ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : value}</p>
      <p className="mt-1 text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
    </div>
  );
}

/** Section heading bar used above every table (main + summaries) so every
 * section in a report shares one consistent look, on screen and in print. */
export function SectionHeading({ title }: { title: string }) {
  return <h3 className="border-l-4 border-primary bg-primary-subtle/40 px-5 py-3 text-sm font-bold text-foreground">{title}</h3>;
}

export function CompanyLetterhead({ company, reportTitle, from, to, generatedAt }: { company: Company | null; reportTitle: string; from: string; to: string; generatedAt: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-brand-gradient p-[1px] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-sm text-white"><BuildingIcon /></span>
          <div>
            <p className="text-base font-bold text-foreground">{company?.name || "—"}</p>
            <p className="text-2xs text-muted">{[company?.address, company?.gst ? `GSTIN: ${company.gst}` : null, company?.phone ? `Ph: ${company.phone}` : null].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-primary">{reportTitle}</p>
          <p className="text-2xs text-muted">Period: {from} to {to}{generatedAt ? ` · Generated: ${generatedAt}` : ""}</p>
        </div>
      </div>
    </div>
  );
}
function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg>
  );
}

export function printCss(): string {
  return `
    @page { margin: 16mm 10mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #666; } }
    body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#111;font-size:12px}
    .letterhead{border-bottom:2px solid #6d28d9;padding-bottom:8px;margin-bottom:10px}
    .coname{font-size:16px;font-weight:bold}
    .cometa{color:#555;font-size:11px}
    h1{font-size:16px;margin:0 0 2px;color:#6d28d9}
    p.sub{color:#555;margin:0 0 14px;font-size:11px}
    h2{font-size:13px;margin:18px 0 6px;color:#6d28d9;background:#f3f0ff;border-left:4px solid #6d28d9;padding:6px 8px}
    table{border-collapse:collapse;width:100%;font-size:10.5px;margin-bottom:6px}
    th,td{border:1px solid #ccc;padding:4px 6px}
    th{background:#f2f4f7}
    tr.tot td{background:#f8fafc;font-weight:bold}
    tr.subtotal td{background:#ede9fe;font-weight:bold}
    .kpis{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
    .kpi{border:1px solid #ccc;border-radius:6px;padding:6px 10px;min-width:110px}
    .kpi .v{font-size:14px;font-weight:bold}
    .kpi .l{font-size:9px;color:#666;text-transform:uppercase}
    @media print{button{display:none}}
  `;
}
export function printLetterheadHtml(company: Company | null, showCompany: boolean, showGstin: boolean): string {
  if (!showCompany && !showGstin) return "";
  return `<div class="letterhead">
    ${showCompany ? `<div class="coname">${esc(company?.name || "")}</div>` : ""}
    <div class="cometa">${[showCompany ? company?.address : null, showGstin && company?.gst ? `GSTIN: ${esc(company.gst)}` : null, showCompany ? company?.phone : null].filter(Boolean).join(" · ")}</div>
  </div>`;
}
export function buildPrintTable(title: string, cols: { key: string; label: string; money?: boolean }[], data: Record<string, unknown>[], totals?: Record<string, number>): string {
  const th = cols.map((c) => `<th style="text-align:${c.money ? "right" : "left"}">${esc(c.label)}</th>`).join("");
  const tr = data.map((r) => `<tr class="${r.__subtotal ? "subtotal" : ""}">${cols.map((c) => `<td style="text-align:${c.money ? "right" : "left"}">${esc(r[c.key])}</td>`).join("")}</tr>`).join("");
  const tfoot = totals ? `<tr class="tot">${cols.map((c, i) => i === 0 ? `<td><b>Overall Total</b></td>` : `<td style="text-align:${c.money ? "right" : "left"}">${c.key in totals ? `<b>${esc(totals[c.key].toFixed(2))}</b>` : ""}</td>`).join("")}</tr>` : "";
  return `<h2>${esc(title)}</h2><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody><tfoot>${tfoot}</tfoot></table>`;
}
