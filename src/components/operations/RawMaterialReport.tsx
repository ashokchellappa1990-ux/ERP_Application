"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileBarChart, Printer, FileSpreadsheet, Download, Search, X, SlidersHorizontal, Building2, Pencil, Check, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel } from "@/lib/export/download";
import type { RawMaterialReportRow } from "@/app/api/operations/reports/raw-material/route";

interface SummaryItem { name: string; trips: number; uom: string; nw: number }
interface TripItem { date: string; product: string; details: string; trips: number; nw: number; uom: string }
interface ReportData {
  rows: RawMaterialReportRow[];
  filterOptions: { vehicles: string[]; suppliers: string[]; products: { id: number; name: string }[] };
  summary: {
    productDetails: SummaryItem[]; vehicleDetails: SummaryItem[]; supplierDetails: SummaryItem[]; driverDetails: SummaryItem[];
    tripSummary: TripItem[]; report: { totalLoads: number; totalQty: number; totalPurchase: number; avgProcessTime: number; avgLoadWeight: number };
  };
}
interface Company { name: string; address: string; gst: string; phone: string }

const today = () => new Date().toISOString().slice(0, 10);
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const COLS_STORAGE_KEY = "raw-material-report-columns";
const LABELS_STORAGE_KEY = "raw-material-report-column-labels";
const TABLE_MAX_H = "max-h-[480px]";

// key = data field; label = full form (abbreviation kept in parens so the
// on-screen table stays traceable to the source paper report); money = right
// aligned + summed in the footer totals row / group subtotals.
const DEFAULT_COLUMNS: { key: keyof RawMaterialReportRow; label: string; money?: boolean }[] = [
  { key: "date", label: "Date" },
  { key: "branch", label: "Branch" },
  { key: "passNo", label: "Pass Number (GRN No.)" },
  { key: "inTime", label: "In Time" },
  { key: "outTime", label: "Out Time" },
  { key: "vehicleNo", label: "Vehicle Number" },
  { key: "supplierName", label: "Supplier Name" },
  { key: "productName", label: "Product Name" },
  { key: "ew", label: "Empty Weight (EW)", money: true },
  { key: "lw", label: "Load Weight (LW)", money: true },
  { key: "nw", label: "Net Weight (NW)", money: true },
  { key: "uom", label: "Unit of Measure (UOM)" },
  { key: "price", label: "Price" },
  { key: "details", label: "Details" },
  { key: "transport", label: "Transport" },
  { key: "transportRate", label: "Transport Rate", money: true },
  { key: "createdByName", label: "Created By" },
  { key: "modifiedByName", label: "Modified By" },
];
const SUMMED_COLS = new Set(["ew", "lw", "nw", "transportRate"]);
const GROUP_OPTS: { key: "" | keyof RawMaterialReportRow; label: string }[] = [
  { key: "", label: "No Grouping" }, { key: "date", label: "Date" }, { key: "vehicleNo", label: "Vehicle" },
  { key: "supplierName", label: "Supplier" }, { key: "productName", label: "Product" }, { key: "details", label: "Details" },
];
const SECTION_OPTS = [
  { key: "main", label: "Main Table (Raw Material Detail)" }, { key: "product", label: "Product Details" },
  { key: "vehicle", label: "Vehicle Details" }, { key: "supplier", label: "Supplier Details" },
  { key: "driver", label: "Driver Details" }, { key: "trip", label: "Trip Summary" },
] as const;
type SectionKey = (typeof SECTION_OPTS)[number]["key"];

const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));

/** Operation Reports → Raw Material Report — inbound quarry/supplier receipts,
 * one row per product line, replicating the paper report's layout: a company
 * letterhead, filters (Search/Clear driven, not fetch-on-keystroke), a
 * fixed-height on-screen table (sticky header + a totals footer that stays
 * put while scrolling), optional group-by subtotals, a column visibility +
 * rename picker, a Print dialog with per-section/company toggles and paged
 * page-number output, and CSV/Excel export. */
export function RawMaterialReport() {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [vehicleNo, setVehicleNo] = useState("");
  const [supplier, setSupplier] = useState("");
  const [productId, setProductId] = useState("");
  const [details, setDetails] = useState("");
  const [q, setQ] = useState("");
  const [groupBy, setGroupBy] = useState<"" | keyof RawMaterialReportRow>("");
  // Computed only after mount — `new Date()` in the render body would produce
  // a different value on the server render pass vs. the client hydration
  // pass a moment later, causing a React hydration mismatch.
  const [generatedAt, setGeneratedAt] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState<Set<string>>(new Set(DEFAULT_COLUMNS.map((c) => c.key)));
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString());
    try { const saved = JSON.parse(localStorage.getItem(COLS_STORAGE_KEY) ?? "null"); if (Array.isArray(saved)) setCols(new Set(saved)); } catch { /* ignore */ }
    try { const savedLabels = JSON.parse(localStorage.getItem(LABELS_STORAGE_KEY) ?? "null"); if (savedLabels && typeof savedLabels === "object") setLabels(savedLabels); } catch { /* ignore */ }
    fetch("/api/company-setup", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok && j.exists) setCompany({ name: j.data.company.name, address: [j.data.company.address, j.data.company.city, j.data.company.state, j.data.company.pincode].filter(Boolean).join(", "), gst: j.data.company.gst, phone: j.data.company.phone });
    }).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCol = (k: string) => setCols((prev) => {
    const next = new Set(prev); if (next.has(k)) next.delete(k); else next.add(k);
    try { localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
    return next;
  });
  const renameCol = (k: string, name: string) => setLabels((prev) => {
    const next = { ...prev, [k]: name.trim() || DEFAULT_COLUMNS.find((c) => c.key === k)!.label };
    try { localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const labelFor = (k: string) => labels[k] || DEFAULT_COLUMNS.find((c) => c.key === k)?.label || k;
  const columns = DEFAULT_COLUMNS.map((c) => ({ ...c, label: labelFor(c.key) }));
  const visibleCols = columns.filter((c) => cols.has(c.key));

  function load() {
    const p = new URLSearchParams({ from, to });
    if (vehicleNo) p.set("vehicleNo", vehicleNo);
    if (supplier) p.set("supplier", supplier);
    if (productId) p.set("productId", productId);
    if (details) p.set("details", details);
    if (q) p.set("q", q);
    setLoading(true);
    fetch(`/api/operations/reports/raw-material?${p}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j); }).finally(() => setLoading(false));
  }
  function clearFilters() {
    setFrom(today()); setTo(today()); setVehicleNo(""); setSupplier(""); setProductId(""); setDetails(""); setQ(""); setGroupBy("");
    const p = new URLSearchParams({ from: today(), to: today() });
    setLoading(true);
    fetch(`/api/operations/reports/raw-material?${p}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j); }).finally(() => setLoading(false));
  }

  const rows = data?.rows ?? [];

  // Optional Group By — clusters rows by the chosen column and inserts a
  // subtotal row (sum of the summed columns) after each group, on screen.
  type Entry = { kind: "row"; row: RawMaterialReportRow } | { kind: "subtotal"; key: string; count: number; sums: Record<string, number> };
  const grouped: Entry[] = [];
  if (groupBy) {
    const order: string[] = [];
    const buckets = new Map<string, RawMaterialReportRow[]>();
    for (const r of rows) { const k = String(r[groupBy] ?? "—"); if (!buckets.has(k)) { buckets.set(k, []); order.push(k); } buckets.get(k)!.push(r); }
    for (const k of order) {
      const grs = buckets.get(k)!;
      for (const r of grs) grouped.push({ kind: "row", row: r });
      const sums: Record<string, number> = {};
      for (const c of visibleCols) if (c.money && SUMMED_COLS.has(c.key)) sums[c.key] = grs.reduce((s, r) => s + Number(r[c.key]), 0);
      grouped.push({ kind: "subtotal", key: k, count: grs.length, sums });
    }
  } else {
    for (const r of rows) grouped.push({ kind: "row", row: r });
  }

  const footTotals = Object.fromEntries(visibleCols.filter((c) => c.money && SUMMED_COLS.has(c.key)).map((c) => [c.key, rows.reduce((s, r) => s + Number(r[c.key]), 0)]));

  const exportColumns = [{ key: "sno", label: "S.No" }, ...visibleCols];
  const rowsForExport = rows.map((r, i) => ({ sno: i + 1, ...Object.fromEntries(visibleCols.map((c) => [c.key, c.money ? Number(r[c.key]).toFixed(2) : (r[c.key] ?? "—")])) }));
  const subtitle = `${company?.name ?? ""}${company?.name ? " — " : ""}${from} to ${to}`;

  function doExcel() { downloadExcel(exportColumns.map((c) => ({ ...c, money: columns.find((x) => x.key === c.key)?.money })), rowsForExport, `RawMaterialReport_${from}_to_${to}`, { title: `Raw Material Report — ${subtitle}`, totals: footTotals }); }
  function doCsv() { downloadCsv(exportColumns, rowsForExport, `RawMaterialReport_${from}_to_${to}.csv`); }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <Link href="/operations/reports" className="hover:text-primary">Operation Reports</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Raw Material Report</span>
          </div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileBarChart className="h-5 w-5 text-primary" /> Raw Material Report</h1>
          <p className="mt-0.5 text-sm text-muted">Inbound quarry / supplier receipts — vehicle, weighment, product and destination detail.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/operations/reports"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Reports</Button></Link>
          <ColumnPicker columns={columns} cols={cols} onToggle={toggleCol} onRename={renameCol} />
          <Button variant="outline" size="md" onClick={doCsv}><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" size="md" onClick={doExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button size="md" onClick={() => setPrintOpen(true)}><Printer className="h-4 w-4" /> Print / PDF</Button>
        </div>
      </div>

      {/* Company letterhead + report meta — matches the printed report's header block. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-brand-gradient p-[1px] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-sm"><Building2 className="h-5 w-5" /></span>
            <div>
              <p className="text-base font-bold text-foreground">{company?.name || "—"}</p>
              <p className="text-2xs text-muted">{[company?.address, company?.gst ? `GSTIN: ${company.gst}` : null, company?.phone ? `Ph: ${company.phone}` : null].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">Raw Material Report</p>
            <p className="text-2xs text-muted">Period: {from} to {to}{generatedAt ? ` · Generated: ${generatedAt}` : ""}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <div><label className={lbl}>From Date</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>To Date</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Vehicle</label><select value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={inp}><option value="">All Vehicles</option>{data?.filterOptions.vehicles.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
          <div><label className={lbl}>Supplier</label><select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inp}><option value="">All Suppliers</option>{data?.filterOptions.suppliers.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className={lbl}>Product</label><select value={productId} onChange={(e) => setProductId(e.target.value)} className={inp}><option value="">All Products</option>{data?.filterOptions.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className={lbl}>Details</label><select value={details} onChange={(e) => setDetails(e.target.value)} className={inp}><option value="">All</option><option value="crusher">Quarry To Crusher (Plant)</option><option value="stock">Quarry To Stock</option></select></div>
          <div><label className={lbl}><Layers className="mr-1 inline h-3 w-3" />Group By (Sub Total)</label><select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)} className={inp}>{GROUP_OPTS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1 min-w-[220px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search Pass No, Vehicle, Supplier…" className={cn(inp, "pl-9")} /></div>
          <Button size="md" onClick={load}><Search className="h-4 w-4" /> Search</Button>
          <Button variant="outline" size="md" onClick={clearFilters}><X className="h-4 w-4" /> Clear</Button>
        </div>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total No. of Loads" value={data?.summary.report.totalLoads ?? 0} tone="primary" />
            <StatCard label="Total Qty (Ton)" value={data?.summary.report.totalQty ?? 0} tone="info" />
            <StatCard label="Total Purchase (₹)" value={data?.summary.report.totalPurchase ?? 0} tone="success" />
            <StatCard label="Avg. Process Time (min)" value={data?.summary.report.avgProcessTime ?? 0} tone="warning" />
            <StatCard label="Avg. Load Weight" value={data?.summary.report.avgLoadWeight ?? 0} tone="neutral" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <h3 className="border-l-4 border-primary bg-primary-subtle/40 px-5 py-3 text-sm font-bold text-foreground">Raw Material Report — Detail</h3>
            <div className={cn("overflow-auto", TABLE_MAX_H)}>
              <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-primary-subtle text-2xs uppercase tracking-wide text-primary">
                    <th className="border-b border-border px-3 py-2.5 text-left">S.No</th>
                    {visibleCols.map((c) => <th key={c.key} className={cn("whitespace-nowrap border-b border-border px-3 py-2.5", c.money ? "text-right" : "text-left")}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(() => { let sno = 0; return grouped.map((e, idx) => {
                    if (e.kind === "subtotal") {
                      const firstMoneyIdx = visibleCols.findIndex((c) => c.money);
                      const labelSpan = 1 + (firstMoneyIdx === -1 ? visibleCols.length : firstMoneyIdx); // +1 for the S.No column
                      const tailCols = firstMoneyIdx === -1 ? [] : visibleCols.slice(firstMoneyIdx);
                      return (
                        <tr key={`sub-${idx}`} className="bg-primary-subtle/30 font-semibold text-foreground">
                          <td className="border-b border-t border-primary/20 px-3 py-2 text-2xs" colSpan={labelSpan}>Subtotal — {e.key} ({e.count})</td>
                          {tailCols.map((c) => <td key={c.key} className={cn("border-b border-t border-primary/20 px-3 py-2 text-2xs", c.money && "text-right tabular-nums")}>{c.money && SUMMED_COLS.has(c.key) ? e.sums[c.key]?.toFixed(2) : ""}</td>)}
                        </tr>
                      );
                    }
                    sno += 1;
                    const r = e.row;
                    return (
                      <tr key={r.id} className="hover:bg-surface-2/30">
                        <td className="border-b border-border/60 px-3 py-2 text-2xs text-muted">{sno}</td>
                        {visibleCols.map((c) => (
                          <td key={c.key} className={cn("whitespace-nowrap border-b border-border/60 px-3 py-2 text-2xs text-foreground", c.money && "text-right tabular-nums")}>
                            {c.key === "details" ? <Badge tone={r.details === "Quarry To Crusher (Plant)" ? "info" : "success"}>{r.details}</Badge>
                              : c.money ? Number(r[c.key]).toFixed(2) : String(r[c.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    );
                  }); })()}
                  {rows.length === 0 && <tr><td colSpan={visibleCols.length + 1} className="px-3 py-10 text-center text-sm text-muted">No raw material receipts in this range.</td></tr>}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10">
                    <tr className="bg-surface-2 font-bold text-foreground">
                      <td className="border-t-2 border-primary/30 px-3 py-2.5 text-2xs">Total</td>
                      {visibleCols.map((c) => (
                        <td key={c.key} className={cn("border-t-2 border-primary/30 px-3 py-2.5 text-2xs", c.money && "text-right tabular-nums")}>
                          {c.money && SUMMED_COLS.has(c.key) ? footTotals[c.key]?.toFixed(2) : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {rows.length > 0 && data && (
            <div className="grid gap-4 lg:grid-cols-2">
              <SummaryTable title="Product Details" items={data.summary.productDetails} />
              <SummaryTable title="Vehicle Details" items={data.summary.vehicleDetails} />
              <SummaryTable title="Supplier Details" items={data.summary.supplierDetails} />
              <SummaryTable title="Driver Details" items={data.summary.driverDetails} />
            </div>
          )}

          {rows.length > 0 && data && data.summary.tripSummary.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <h3 className="border-l-4 border-primary bg-primary-subtle/40 px-5 py-3 text-sm font-bold text-foreground">Trip Summary</h3>
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10"><tr className="bg-surface-2/70 text-2xs uppercase tracking-wide text-muted">
                    <th className="border-b border-border px-4 py-2.5 text-left">Date</th><th className="border-b border-border px-4 py-2.5 text-left">Product</th><th className="border-b border-border px-4 py-2.5 text-left">Details</th><th className="border-b border-border px-4 py-2.5 text-right">Trips</th><th className="border-b border-border px-4 py-2.5 text-right">Net Weight (NW)</th><th className="border-b border-border px-4 py-2.5 text-left">UOM</th>
                  </tr></thead>
                  <tbody>{data.summary.tripSummary.map((t, i) => (
                    <tr key={i} className="hover:bg-surface-2/30"><td className="border-b border-border/60 px-4 py-2 text-2xs">{t.date}</td><td className="border-b border-border/60 px-4 py-2 text-2xs">{t.product}</td><td className="border-b border-border/60 px-4 py-2 text-2xs">{t.details}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{t.trips}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{t.nw.toFixed(2)}</td><td className="border-b border-border/60 px-4 py-2 text-2xs">{t.uom}</td></tr>
                  ))}</tbody>
                  <tfoot className="sticky bottom-0 z-10"><tr className="bg-surface-2 font-bold text-foreground">
                    <td className="border-t-2 border-primary/30 px-4 py-2.5 text-2xs" colSpan={3}>Total</td>
                    <td className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{data.summary.tripSummary.reduce((s, t) => s + t.trips, 0)}</td>
                    <td className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{data.summary.tripSummary.reduce((s, t) => s + t.nw, 0).toFixed(2)}</td>
                    <td className="border-t-2 border-primary/30 px-4 py-2.5" />
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {printOpen && data && (
        <PrintOptionsModal
          onClose={() => setPrintOpen(false)} company={company} subtitle={subtitle} from={from} to={to}
          columns={visibleCols} rows={rows} footTotals={footTotals} data={data} groupBy={groupBy}
        />
      )}
    </div>
  );
}

function ColumnPicker({ columns, cols, onToggle, onRename }: { columns: { key: string; label: string }[]; cols: Set<string>; onToggle: (k: string) => void; onRename: (k: string, name: string) => void }) {
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

function StatCard({ label, value, tone }: { label: string; value: number; tone: "primary" | "info" | "success" | "warning" | "neutral" }) {
  const toneText: Record<string, string> = { primary: "text-primary", info: "text-info", success: "text-success", warning: "text-warning", neutral: "text-foreground" };
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <p className={cn("text-xl font-bold tabular-nums", toneText[tone])}>{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
      <p className="mt-1 text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
    </div>
  );
}
function SummaryTable({ title, items }: { title: string; items: SummaryItem[] }) {
  const totalTrips = items.reduce((s, it) => s + it.trips, 0);
  const totalNw = items.reduce((s, it) => s + it.nw, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <h3 className="border-l-4 border-primary bg-primary-subtle/40 px-5 py-3 text-sm font-bold text-foreground">{title}</h3>
      {items.length === 0 ? <p className="px-5 py-6 text-center text-2xs text-muted">No data.</p> : (
        <div className="max-h-[260px] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10"><tr className="bg-surface-2/70 text-2xs uppercase tracking-wide text-muted"><th className="border-b border-border px-4 py-2 text-left">Name</th><th className="border-b border-border px-4 py-2 text-right">Trips</th><th className="border-b border-border px-4 py-2 text-right">Net Weight (NW)</th><th className="border-b border-border px-4 py-2 text-left">UOM</th></tr></thead>
            <tbody>{items.map((it) => (
              <tr key={it.name} className="hover:bg-surface-2/30"><td className="border-b border-border/60 px-4 py-2 text-2xs">{it.name}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{it.trips}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{it.nw.toFixed(2)}</td><td className="border-b border-border/60 px-4 py-2 text-2xs">{it.uom}</td></tr>
            ))}</tbody>
            <tfoot className="sticky bottom-0 z-10"><tr className="bg-surface-2 font-bold text-foreground"><td className="border-t-2 border-primary/30 px-4 py-2.5 text-2xs">Total</td><td className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{totalTrips}</td><td className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{totalNw.toFixed(2)}</td><td className="border-t-2 border-primary/30 px-4 py-2.5" /></tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/** Print dialog — choose whether Company Name/GSTIN print, and which report
 * sections are included, before opening the browser print window (page
 * number / page total via CSS @page margin boxes, an "overall total" line
 * per section, same Save-as-PDF flow as the rest of the app). */
function PrintOptionsModal({ onClose, company, subtitle, from, to, columns, rows, footTotals, data, groupBy }: {
  onClose: () => void; company: Company | null; subtitle: string; from: string; to: string;
  columns: { key: keyof RawMaterialReportRow; label: string; money?: boolean }[]; rows: RawMaterialReportRow[]; footTotals: Record<string, number>; data: ReportData;
  groupBy: "" | keyof RawMaterialReportRow;
}) {
  const [showCompany, setShowCompany] = useState(true);
  const [showGstin, setShowGstin] = useState(true);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ main: true, product: true, vehicle: true, supplier: true, driver: true, trip: true });
  const toggleSection = (k: SectionKey) => setSections((s) => ({ ...s, [k]: !s[k] }));

  function buildTable(title: string, cols: { key: string; label: string; money?: boolean }[], data2: Record<string, unknown>[], totals?: Record<string, number>) {
    const th = cols.map((c) => `<th style="text-align:${c.money ? "right" : "left"}">${esc(c.label)}</th>`).join("");
    const tr = data2.map((r) => `<tr class="${r.__subtotal ? "subtotal" : ""}">${cols.map((c) => `<td style="text-align:${c.money ? "right" : "left"}">${esc(r[c.key])}</td>`).join("")}</tr>`).join("");
    const tfoot = totals ? `<tr class="tot">${cols.map((c, i) => i === 0 ? `<td><b>Overall Total</b></td>` : `<td style="text-align:${c.money ? "right" : "left"}">${c.key in totals ? `<b>${esc(totals[c.key].toFixed(2))}</b>` : ""}</td>`).join("")}</tr>` : "";
    return `<h2>${esc(title)}</h2><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody><tfoot>${tfoot}</tfoot></table>`;
  }

  // Mirrors the on-screen Group By behavior — when a grouping is active, the
  // printed main table gets the same subtotal rows inserted after each group
  // (not just a single overall total at the very end).
  function buildMainRows(): Record<string, unknown>[] {
    const cell = (r: RawMaterialReportRow, c: { key: keyof RawMaterialReportRow; money?: boolean }) => (c.money ? Number(r[c.key]).toFixed(2) : (r[c.key] ?? "—"));
    if (!groupBy) return rows.map((r, i) => ({ sno: i + 1, ...Object.fromEntries(columns.map((c) => [c.key, cell(r, c)])) }));
    const order: string[] = []; const buckets = new Map<string, RawMaterialReportRow[]>();
    for (const r of rows) { const k = String(r[groupBy] ?? "—"); if (!buckets.has(k)) { buckets.set(k, []); order.push(k); } buckets.get(k)!.push(r); }
    const out: Record<string, unknown>[] = [];
    let sno = 0;
    for (const k of order) {
      const grs = buckets.get(k)!;
      for (const r of grs) { sno += 1; out.push({ sno, ...Object.fromEntries(columns.map((c) => [c.key, cell(r, c)])) }); }
      out.push({
        __subtotal: true, sno: "",
        ...Object.fromEntries(columns.map((c, i) => [c.key, c.money && SUMMED_COLS.has(c.key) ? grs.reduce((s, r) => s + Number(r[c.key]), 0).toFixed(2) : (i === 0 ? `Subtotal — ${k} (${grs.length})` : "")])),
      });
    }
    return out;
  }

  function doPrint() {
    const parts: string[] = [];
    if (sections.main) {
      const exportCols = [{ key: "sno", label: "S.No" }, ...columns];
      parts.push(buildTable("Raw Material Report — Detail", exportCols, buildMainRows(), footTotals));
    }
    if (sections.product) parts.push(buildTable("Product Details", [{ key: "name", label: "Product" }, { key: "trips", label: "Trips", money: true }, { key: "nw", label: "Net Weight (NW)", money: true }, { key: "uom", label: "UOM" }], data.summary.productDetails.map((i) => ({ ...i, trips: i.trips, nw: i.nw.toFixed(2) }))));
    if (sections.vehicle) parts.push(buildTable("Vehicle Details", [{ key: "name", label: "Vehicle" }, { key: "trips", label: "Trips", money: true }, { key: "nw", label: "Net Weight (NW)", money: true }, { key: "uom", label: "UOM" }], data.summary.vehicleDetails.map((i) => ({ ...i, nw: i.nw.toFixed(2) }))));
    if (sections.supplier) parts.push(buildTable("Supplier Details", [{ key: "name", label: "Supplier" }, { key: "trips", label: "Trips", money: true }, { key: "nw", label: "Net Weight (NW)", money: true }, { key: "uom", label: "UOM" }], data.summary.supplierDetails.map((i) => ({ ...i, nw: i.nw.toFixed(2) }))));
    if (sections.driver) parts.push(buildTable("Driver Details", [{ key: "name", label: "Driver" }, { key: "trips", label: "Trips", money: true }, { key: "nw", label: "Net Weight (NW)", money: true }, { key: "uom", label: "UOM" }], data.summary.driverDetails.map((i) => ({ ...i, nw: i.nw.toFixed(2) }))));
    if (sections.trip) parts.push(buildTable("Trip Summary", [{ key: "date", label: "Date" }, { key: "product", label: "Product" }, { key: "details", label: "Details" }, { key: "trips", label: "Trips", money: true }, { key: "nw", label: "Net Weight (NW)", money: true }, { key: "uom", label: "UOM" }], data.summary.tripSummary.map((t) => ({ ...t, nw: t.nw.toFixed(2) }))));

    const header = (showCompany || showGstin) ? `
      <div class="letterhead">
        ${showCompany ? `<div class="coname">${esc(company?.name || "")}</div>` : ""}
        <div class="cometa">${[showCompany ? company?.address : null, showGstin && company?.gst ? `GSTIN: ${esc(company.gst)}` : null, showCompany ? company?.phone : null].filter(Boolean).join(" · ")}</div>
      </div>` : "";

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Raw Material Report</title>
    <style>
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
      @media print{button{display:none}}
    </style></head><body>
    ${header}
    <h1>Raw Material Report</h1><p class="sub">${esc(subtitle)} · Period: ${esc(from)} to ${esc(to)} · Generated: ${esc(new Date().toLocaleString())}</p>
    ${parts.join("")}
    <script>window.onload=function(){window.print()}</script></body></html>`;

    const w = window.open("", "_blank", "width=1100,height=800");
    if (w) { w.document.write(html); w.document.close(); w.focus(); }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Print / PDF Options</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Header</p>
            <div className="space-y-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={showCompany} onChange={(e) => setShowCompany(e.target.checked)} className="h-4 w-4 accent-primary" /> Show Company Name &amp; Address</label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={showGstin} onChange={(e) => setShowGstin(e.target.checked)} className="h-4 w-4 accent-primary" /> Show GSTIN</label>
            </div>
          </div>
          <div>
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Sections to Include</p>
            <div className="space-y-1.5">
              {SECTION_OPTS.map((s) => (
                <label key={s.key} className="flex cursor-pointer items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={sections[s.key]} onChange={() => toggleSection(s.key)} className="h-4 w-4 accent-primary" /> {s.label}</label>
              ))}
            </div>
          </div>
          <p className="text-2xs text-muted">Each printed section shows its own Overall Total row; pages are numbered (Page X of Y) in the bottom-right margin.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={doPrint}><Printer className="h-4 w-4" /> Print</Button></div>
      </div>
    </div>
  );
}
