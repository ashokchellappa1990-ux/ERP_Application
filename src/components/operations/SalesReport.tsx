"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileBarChart, Printer, FileSpreadsheet, Download, Search, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel } from "@/lib/export/download";
import {
  inp, lbl, esc, useCompany, useGeneratedAt, useReportColumns, ColumnPicker, StatCard, SectionHeading, CompanyLetterhead,
  printCss, printLetterheadHtml, buildPrintTable, type ReportColumn,
} from "@/components/operations/reportShared";
import type { SalesReportRow } from "@/app/api/operations/reports/sales/route";

interface ProductSummaryItem { name: string; uom: string; qty: number; net: number }
interface ReportData {
  rows: SalesReportRow[];
  filterOptions: { vehicles: string[]; customers: string[]; products: { id: number; name: string }[] };
  summary: {
    report: { totalLoads: number; subTotal: number; vehicleRent: number; tax: number; transitPass: number; driverBata: number; roundOff: number; total: number };
    productSalesSummary: ProductSummaryItem[];
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const TABLE_MAX_H = "max-h-[480px]";
const STORAGE_KEY = "sales-report";
const DEFAULT_COLUMNS: ReportColumn<keyof SalesReportRow>[] = [
  { key: "invoiceNo", label: "Invoice Number" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "type", label: "Type (Cash/Credit)" },
  { key: "customerName", label: "Customer Name" },
  { key: "vehicleNo", label: "Vehicle Number" },
  { key: "deliveryTo", label: "Delivery To" },
  { key: "productName", label: "Product Name" },
  { key: "price", label: "Price", money: true },
  { key: "qty", label: "Quantity", money: true },
  { key: "uom", label: "Per (UOM)" },
  { key: "subTotal", label: "Sub Total", money: true },
  { key: "vehicleRent", label: "Vehicle Rent", money: true },
  { key: "tax", label: "Tax", money: true },
  { key: "transitPass", label: "Transit Pass", money: true },
  { key: "driverBata", label: "Driver Batta", money: true },
  { key: "total", label: "Total", money: true },
  { key: "createdByName", label: "Created By" },
];
const SUMMED_COLS = new Set(["price", "qty", "subTotal", "vehicleRent", "tax", "transitPass", "driverBata", "total"]);
const GROUP_OPTS: { key: "" | keyof SalesReportRow; label: string }[] = [
  { key: "date", label: "Date" }, { key: "", label: "No Grouping" }, { key: "vehicleNo", label: "Vehicle" },
  { key: "customerName", label: "Customer" }, { key: "productName", label: "Product" }, { key: "type", label: "Type" },
];
const SECTION_OPTS = [
  { key: "main", label: "Main Table (Sales Detail)" }, { key: "product", label: "Product Sales Summary" },
] as const;
type SectionKey = (typeof SECTION_OPTS)[number]["key"];

/** Operation Reports → Sales Report — per-invoice sales lines for a date
 * range, grouped by Date by default (with subtotals) like the paper report,
 * plus a Report Summary and Product Sales Summary. Same feature set as Raw
 * Material Report: Search/Clear, S.No, fixed-height sticky-footer table,
 * column visibility + rename, Group By subtotals, a Print dialog with
 * company/GSTIN/section toggles + paged output, and CSV/Excel export. */
export function SalesReport() {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [type, setType] = useState("");
  const [customer, setCustomer] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [productId, setProductId] = useState("");
  const [q, setQ] = useState("");
  const [groupBy, setGroupBy] = useState<"" | keyof SalesReportRow>("date");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printOpen, setPrintOpen] = useState(false);
  const company = useCompany();
  const generatedAt = useGeneratedAt();
  const { cols, toggleCol, renameCol, columns, visibleCols } = useReportColumns(STORAGE_KEY, DEFAULT_COLUMNS);

  function load() {
    const p = new URLSearchParams({ from, to });
    if (type) p.set("type", type);
    if (customer) p.set("customer", customer);
    if (vehicleNo) p.set("vehicleNo", vehicleNo);
    if (productId) p.set("productId", productId);
    if (q) p.set("q", q);
    setLoading(true);
    fetch(`/api/operations/reports/sales?${p}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j); }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function clearFilters() {
    setFrom(today()); setTo(today()); setType(""); setCustomer(""); setVehicleNo(""); setProductId(""); setQ(""); setGroupBy("date");
    setLoading(true);
    fetch(`/api/operations/reports/sales?from=${today()}&to=${today()}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j); }).finally(() => setLoading(false));
  }

  const rows = data?.rows ?? [];
  type Entry = { kind: "row"; row: SalesReportRow } | { kind: "subtotal"; key: string; count: number; sums: Record<string, number> };
  const grouped: Entry[] = [];
  if (groupBy) {
    const order: string[] = []; const buckets = new Map<string, SalesReportRow[]>();
    for (const r of rows) { const k = String(r[groupBy] ?? "—"); if (!buckets.has(k)) { buckets.set(k, []); order.push(k); } buckets.get(k)!.push(r); }
    for (const k of order) {
      const grs = buckets.get(k)!;
      for (const r of grs) grouped.push({ kind: "row", row: r });
      const sums: Record<string, number> = {};
      for (const c of visibleCols) if (c.money && SUMMED_COLS.has(c.key)) sums[c.key] = grs.reduce((s, r) => s + Number(r[c.key]), 0);
      grouped.push({ kind: "subtotal", key: k, count: grs.length, sums });
    }
  } else for (const r of rows) grouped.push({ kind: "row", row: r });

  const footTotals = Object.fromEntries(visibleCols.filter((c) => c.money && SUMMED_COLS.has(c.key)).map((c) => [c.key, rows.reduce((s, r) => s + Number(r[c.key]), 0)]));
  const exportColumns = [{ key: "sno", label: "S.No" }, ...visibleCols];
  const rowsForExport = rows.map((r, i) => ({ sno: i + 1, ...Object.fromEntries(visibleCols.map((c) => [c.key, c.money ? Number(r[c.key]).toFixed(2) : (r[c.key] ?? "—")])) }));
  const subtitle = `${company?.name ?? ""}${company?.name ? " — " : ""}${from} to ${to}`;

  function doExcel() { downloadExcel(exportColumns.map((c) => ({ ...c, money: columns.find((x) => x.key === c.key)?.money })), rowsForExport, `SalesReport_${from}_to_${to}`, { title: `Sales Report — ${subtitle}`, totals: footTotals }); }
  function doCsv() { downloadCsv(exportColumns, rowsForExport, `SalesReport_${from}_to_${to}.csv`); }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/operations/reports" className="hover:text-primary">Operation Reports</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Sales Report</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileBarChart className="h-5 w-5 text-primary" /> Sales Report</h1>
          <p className="mt-0.5 text-sm text-muted">Per-invoice sales for a date range — Cash/Credit split, vehicle &amp; delivery detail, product summary.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/operations/reports"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Reports</Button></Link>
          <ColumnPicker columns={columns} cols={cols} onToggle={toggleCol} onRename={renameCol} />
          <Button variant="outline" size="md" onClick={doCsv}><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" size="md" onClick={doExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button size="md" onClick={() => setPrintOpen(true)}><Printer className="h-4 w-4" /> Print / PDF</Button>
        </div>
      </div>

      <CompanyLetterhead company={company} reportTitle="Sales Report" from={from} to={to} generatedAt={generatedAt} />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <div><label className={lbl}>From Date</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>To Date</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Type</label><select value={type} onChange={(e) => setType(e.target.value)} className={inp}><option value="">All</option><option value="cash">Cash</option><option value="credit">Credit</option></select></div>
          <div><label className={lbl}>Customer</label><select value={customer} onChange={(e) => setCustomer(e.target.value)} className={inp}><option value="">All Customers</option>{data?.filterOptions.customers.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className={lbl}>Vehicle</label><select value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={inp}><option value="">All Vehicles</option>{data?.filterOptions.vehicles.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
          <div><label className={lbl}>Product</label><select value={productId} onChange={(e) => setProductId(e.target.value)} className={inp}><option value="">All Products</option>{data?.filterOptions.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className={lbl}><Layers className="mr-1 inline h-3 w-3" />Group By (Sub Total)</label><select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)} className={inp}>{GROUP_OPTS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1 min-w-[220px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search Invoice, Customer, Vehicle…" className={cn(inp, "pl-9")} /></div>
          <Button size="md" onClick={load}><Search className="h-4 w-4" /> Search</Button>
          <Button variant="outline" size="md" onClick={clearFilters}><X className="h-4 w-4" /> Clear</Button>
        </div>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <StatCard label="Total Loads" value={data?.summary.report.totalLoads ?? 0} tone="primary" />
            <StatCard label="Sub Total" value={data?.summary.report.subTotal ?? 0} tone="info" />
            <StatCard label="Vehicle Rent" value={data?.summary.report.vehicleRent ?? 0} tone="neutral" />
            <StatCard label="Tax" value={data?.summary.report.tax ?? 0} tone="neutral" />
            <StatCard label="Transit Pass" value={data?.summary.report.transitPass ?? 0} tone="neutral" />
            <StatCard label="Driver Batta" value={data?.summary.report.driverBata ?? 0} tone="warning" />
            <StatCard label="Round Off" value={data?.summary.report.roundOff ?? 0} tone="neutral" />
            <StatCard label="Total" value={data?.summary.report.total ?? 0} tone="success" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <SectionHeading title="Sales Report — Detail" />
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
                      const labelSpan = 1 + (firstMoneyIdx === -1 ? visibleCols.length : firstMoneyIdx);
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
                            {c.key === "type" ? <Badge tone={r.type === "Credit" ? "warning" : "success"}>{r.type}</Badge> : c.money ? Number(r[c.key]).toFixed(2) : String(r[c.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    );
                  }); })()}
                  {rows.length === 0 && <tr><td colSpan={visibleCols.length + 1} className="px-3 py-10 text-center text-sm text-muted">No sales in this range.</td></tr>}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10">
                    <tr className="bg-surface-2 font-bold text-foreground">
                      <td className="border-t-2 border-primary/30 px-3 py-2.5 text-2xs">Total</td>
                      {visibleCols.map((c) => <td key={c.key} className={cn("border-t-2 border-primary/30 px-3 py-2.5 text-2xs", c.money && "text-right tabular-nums")}>{c.money && SUMMED_COLS.has(c.key) ? footTotals[c.key]?.toFixed(2) : ""}</td>)}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {rows.length > 0 && data && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <SectionHeading title="Product Sales Summary" />
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10"><tr className="bg-surface-2/70 text-2xs uppercase tracking-wide text-muted"><th className="border-b border-border px-4 py-2 text-left">Product Name</th><th className="border-b border-border px-4 py-2 text-left">UOM</th><th className="border-b border-border px-4 py-2 text-right">Qty</th><th className="border-b border-border px-4 py-2 text-right">Net Amount</th></tr></thead>
                  <tbody>{data.summary.productSalesSummary.map((p) => (
                    <tr key={p.name} className="hover:bg-surface-2/30"><td className="border-b border-border/60 px-4 py-2 text-2xs">{p.name}</td><td className="border-b border-border/60 px-4 py-2 text-2xs">{p.uom}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{p.qty.toFixed(2)}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{p.net.toFixed(2)}</td></tr>
                  ))}</tbody>
                  <tfoot className="sticky bottom-0 z-10"><tr className="bg-surface-2 font-bold text-foreground">
                    <td className="border-t-2 border-primary/30 px-4 py-2.5 text-2xs" colSpan={2}>Total</td>
                    <td className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{data.summary.productSalesSummary.reduce((s, p) => s + p.qty, 0).toFixed(2)}</td>
                    <td className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{data.summary.productSalesSummary.reduce((s, p) => s + p.net, 0).toFixed(2)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {printOpen && data && (
        <PrintOptionsModal onClose={() => setPrintOpen(false)} company={company} subtitle={subtitle} from={from} to={to} columns={visibleCols} rows={rows} footTotals={footTotals} data={data} groupBy={groupBy} />
      )}
    </div>
  );
}

function PrintOptionsModal({ onClose, company, subtitle, from, to, columns, rows, footTotals, data, groupBy }: {
  onClose: () => void; company: ReturnType<typeof useCompany>; subtitle: string; from: string; to: string;
  columns: ReportColumn<keyof SalesReportRow>[]; rows: SalesReportRow[]; footTotals: Record<string, number>; data: ReportData; groupBy: "" | keyof SalesReportRow;
}) {
  const [showCompany, setShowCompany] = useState(true);
  const [showGstin, setShowGstin] = useState(true);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ main: true, product: true });
  const toggleSection = (k: SectionKey) => setSections((s) => ({ ...s, [k]: !s[k] }));

  function buildMainRows(): Record<string, unknown>[] {
    const cell = (r: SalesReportRow, c: ReportColumn<keyof SalesReportRow>) => (c.money ? Number(r[c.key]).toFixed(2) : (r[c.key] ?? "—"));
    if (!groupBy) return rows.map((r, i) => ({ sno: i + 1, ...Object.fromEntries(columns.map((c) => [c.key, cell(r, c)])) }));
    const order: string[] = []; const buckets = new Map<string, SalesReportRow[]>();
    for (const r of rows) { const k = String(r[groupBy] ?? "—"); if (!buckets.has(k)) { buckets.set(k, []); order.push(k); } buckets.get(k)!.push(r); }
    const out: Record<string, unknown>[] = []; let sno = 0;
    for (const k of order) {
      const grs = buckets.get(k)!;
      for (const r of grs) { sno += 1; out.push({ sno, ...Object.fromEntries(columns.map((c) => [c.key, cell(r, c)])) }); }
      out.push({ __subtotal: true, sno: "", ...Object.fromEntries(columns.map((c, i) => [c.key, c.money && SUMMED_COLS.has(c.key) ? grs.reduce((s, r) => s + Number(r[c.key]), 0).toFixed(2) : (i === 0 ? `Subtotal — ${k} (${grs.length})` : "")])) });
    }
    return out;
  }

  function doPrint() {
    const parts: string[] = [];
    if (sections.main) parts.push(buildPrintTable("Sales Report — Detail", [{ key: "sno", label: "S.No" }, ...columns], buildMainRows(), footTotals));
    if (sections.product) parts.push(buildPrintTable("Product Sales Summary", [{ key: "name", label: "Product Name" }, { key: "uom", label: "UOM" }, { key: "qty", label: "Qty", money: true }, { key: "net", label: "Net Amount", money: true }], data.summary.productSalesSummary.map((p) => ({ ...p, qty: p.qty.toFixed(2), net: p.net.toFixed(2) }))));

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sales Report</title><style>${printCss()}</style></head><body>
    ${printLetterheadHtml(company, showCompany, showGstin)}
    <h1>Sales Report</h1><p class="sub">${esc(subtitle)} · Period: ${esc(from)} to ${esc(to)} · Generated: ${esc(new Date().toLocaleString())}</p>
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
            <div className="space-y-1.5">{SECTION_OPTS.map((s) => (<label key={s.key} className="flex cursor-pointer items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={sections[s.key]} onChange={() => toggleSection(s.key)} className="h-4 w-4 accent-primary" /> {s.label}</label>))}</div>
          </div>
          <p className="text-2xs text-muted">Each printed section shows its own Overall Total row; pages are numbered (Page X of Y) in the bottom-right margin.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={doPrint}><Printer className="h-4 w-4" /> Print</Button></div>
      </div>
    </div>
  );
}
