"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { X, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

/**
 * Shared drill-down for the Sales / Purchase dashboards — styled to match the Finance
 * dashboard's detail modal. Widgets don't render an icon; hovering a widget reveals a
 * "View details →" affordance (<DrillDot/>) that opens this popup with the widget's
 * description + a live breakup fetched from the dashboard's `/drill` endpoint.
 */

export interface DrillCol { key: string; label: string; type?: "money" | "number" | "percent" | "text" | "date"; align?: "left" | "right" | "center" }
export interface DrillData { ok: boolean; title: string; subtitle?: string; summary?: { label: string; value: string; tone?: string }[]; columns: DrillCol[]; rows: Record<string, string | number>[]; next?: { widget: string; keyField: string; labelField?: string } | null; message?: string }

interface OpenArgs { widget: string; title: string; description?: string; href?: string; hrefLabel?: string }
interface Ctx { base: string; qs: string; open: (a: OpenArgs) => void }
export const DrillContext = createContext<Ctx | null>(null);
export const useDrill = () => useContext(DrillContext);

/** Wrap a dashboard's active area; provides the drill endpoint + filters and renders the modal once. */
export function DrillProvider({ base, qs, children }: { base: string; qs: string; children: React.ReactNode }) {
  const [args, setArgs] = useState<OpenArgs | null>(null);
  const open = useCallback((a: OpenArgs) => setArgs(a), []);
  return (
    <DrillContext.Provider value={{ base, qs, open }}>
      {children}
      {args && <DrillModal base={base} qs={qs} root={{ widget: args.widget, label: args.title }} description={args.description} href={args.href} hrefLabel={args.hrefLabel} onClose={() => setArgs(null)} />}
    </DrillContext.Provider>
  );
}

/** Hover-revealed "View details →" trigger placed inside a widget (whose container has `group`). */
export function DrillDot({ id, title, description, light, className }: { id: string; title?: string; description?: string; light?: boolean; className?: string }) {
  const ctx = useDrill();
  if (!ctx) return null;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); ctx.open({ widget: id, title: title ?? id, description }); }}
      className={cn("hidden items-center gap-0.5 whitespace-nowrap rounded text-2xs font-semibold group-hover:inline-flex focus:inline-flex", light ? "text-white/90 hover:text-white" : "text-primary hover:underline", className)}>
      View details <ArrowRight className="h-3 w-3" />
    </button>
  );
}

interface Frame { widget: string; key?: string; label: string }
export function DrillModal({ base, qs, root, description, href, hrefLabel, onClose }: { base: string; qs: string; root: Frame; description?: string; href?: string; hrefLabel?: string; onClose: () => void }) {
  const fmt = useFmt();
  const [stack, setStack] = useState<Frame[]>([root]);
  const [data, setData] = useState<DrillData | null>(null);
  const [loading, setLoading] = useState(true);
  const cur = stack[stack.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams(qs); p.set("widget", cur.widget); if (cur.key != null) p.set("key", String(cur.key));
    const j = await fetch(`${base}?${p}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setData(j?.ok ? j : { ok: false, title: cur.label, columns: [], rows: [], message: j?.message || "Failed to load." });
    setLoading(false);
  }, [base, qs, cur]);
  useEffect(() => { load(); }, [load]);

  const fmtCell = (v: string | number, type?: DrillCol["type"]) => v == null || v === "" ? "—" : type === "money" ? fmt.money(Number(v) || 0) : type === "percent" ? `${(Number(v) || 0).toFixed(2)}%` : type === "number" ? (Number(v) || 0).toLocaleString("en-IN") : String(v);
  const rowClick = (row: Record<string, string | number>) => {
    if (!data?.next) return;
    const key = row[data.next.keyField]; const label = String(row[data.next.labelField ?? data.next.keyField] ?? key);
    setStack((s) => [...s, { widget: data.next!.widget, key: String(key), label }]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header bar (Finance-style) */}
        <div className="flex items-center justify-between bg-primary px-5 py-3 text-white">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">{data?.title || cur.label}</h3>
            {stack.length > 1 ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-2xs text-white/80">
                {stack.map((f, i) => <span key={i} className="flex items-center gap-1">{i > 0 && <ChevronRight className="h-3 w-3" />}<button onClick={() => setStack(stack.slice(0, i + 1))} className={cn("hover:text-white", i === stack.length - 1 && "font-semibold text-white")}>{f.label}</button></span>)}
              </div>
            ) : data?.subtitle ? <p className="text-2xs text-white/80">{data.subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-1">
            {stack.length > 1 && <button onClick={() => setStack(stack.slice(0, -1))} className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white" title="Back"><ArrowLeft className="h-4 w-4" /></button>}
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {description && stack.length === 1 && <p className="whitespace-pre-line text-sm text-muted">{description}</p>}

          {data?.summary && data.summary.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.summary.map((s, i) => <div key={i} className="rounded-lg border border-border bg-surface-2/40 px-3 py-1.5"><div className="text-2xs uppercase tracking-wide text-muted">{s.label}</div><div className={cn("text-sm font-bold tabular-nums", s.tone === "success" ? "text-success" : s.tone === "danger" ? "text-danger" : "text-foreground")}>{s.value}</div></div>)}
            </div>
          )}

          {loading ? <div className="py-8"><AppLoader label="Loading breakup…" /></div>
            : !data || !data.ok ? <p className="py-8 text-center text-sm text-muted">{data?.message || "No detail available."}</p>
            : data.rows.length === 0 ? <p className="py-8 text-center text-sm text-muted">No records for this selection.</p>
            : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-surface-2/50 text-2xs uppercase tracking-wide text-muted">
                    {data.columns.map((c) => <th key={c.key} className={cn("px-3 py-2", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}>{c.label}</th>)}
                    {data.next && <th className="px-2 py-2" />}
                  </tr></thead>
                  <tbody>
                    {data.rows.map((row, ri) => (
                      <tr key={ri} onClick={() => rowClick(row)} className={cn("border-b border-border/50 last:border-0", data.next && "cursor-pointer hover:bg-primary-subtle/40")}>
                        {data.columns.map((c) => <td key={c.key} className={cn("px-3 py-1.5 tabular-nums", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left", c.type === "text" && "font-medium text-foreground")}>{fmtCell(row[c.key], c.type)}</td>)}
                        {data.next && <td className="px-2 py-1.5 text-right text-subtle"><ChevronRight className="h-4 w-4" /></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          {data?.next && !loading && data.rows.length > 0 && <p className="text-2xs text-subtle">Tip: click a row to drill deeper.</p>}
        </div>

        {href && (
          <div className="border-t border-border px-5 py-3 text-right">
            <a href={href} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">{hrefLabel ?? "Open in module"} <ArrowRight className="h-4 w-4" /></a>
          </div>
        )}
      </div>
    </div>
  );
}
