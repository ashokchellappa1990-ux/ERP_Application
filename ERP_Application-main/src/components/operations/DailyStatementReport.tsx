"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileBarChart, Printer, FileSpreadsheet, Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel } from "@/lib/export/download";
import {
  inp, lbl, esc, useCompany, useGeneratedAt, useReportColumns, ColumnPicker, StatCard, SectionHeading, CompanyLetterhead,
  printCss, printLetterheadHtml, buildPrintTable, type ReportColumn,
} from "@/components/operations/reportShared";
import type { BillRow, DailyStatementData } from "@/app/api/operations/reports/daily-statement/route";

const today = () => new Date().toISOString().slice(0, 10);
const TABLE_MAX_H = "max-h-[360px]";
const STORAGE_KEY = "daily-statement-bill-cols";
const BILL_COLUMNS: ReportColumn<keyof BillRow>[] = [
  { key: "invoiceNo", label: "Invoice Number" },
  { key: "date", label: "Date" },
  { key: "customerName", label: "Customer Name" },
  { key: "vehicleNo", label: "Vehicle Number" },
  { key: "deliveryTo", label: "Delivery To" },
  { key: "productName", label: "Product Name" },
  { key: "qty", label: "Quantity", money: true },
  { key: "rate", label: "Rate", money: true },
  { key: "rateGst", label: "Rate (Incl. GST)", money: true },
  { key: "bata", label: "Driver Batta", money: true },
  { key: "pass", label: "Transit Pass", money: true },
  { key: "total", label: "Total", money: true },
  { key: "difference", label: "Difference", money: true },
  { key: "to", label: "Paid To" },
  { key: "status", label: "Status" },
  { key: "createdByName", label: "Created By" },
];
const SECTION_OPTS = [
  { key: "kpi", label: "Sales KPI" }, { key: "accounts", label: "Account Breakdown" }, { key: "product", label: "Product Sales Summary" },
  { key: "expenses", label: "Expenses Summary" }, { key: "cash", label: "Cash Sales Detail" }, { key: "credit", label: "Credit Sales Detail" },
] as const;
type SectionKey = (typeof SECTION_OPTS)[number]["key"];

/** Operation Reports → Daily Statement Report — a single-day (or range)
 * rollup: Sales KPI cards, payment/account breakdown, Product Sales Summary,
 * Expenses Summary, and Cash/Credit bill-level detail tables. Same shared
 * conventions as the other Operation Reports: company letterhead, fixed-
 * height sticky-footer tables, a column picker (for the bill tables) with
 * rename, and a Print dialog with company/GSTIN/section toggles + paged
 * output plus CSV/Excel export. */
export function DailyStatementReport() {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<DailyStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printOpen, setPrintOpen] = useState(false);
  const company = useCompany();
  const generatedAt = useGeneratedAt();
  const { cols, toggleCol, renameCol, columns, visibleCols } = useReportColumns(STORAGE_KEY, BILL_COLUMNS);

  function load() {
    setLoading(true);
    fetch(`/api/operations/reports/daily-statement?from=${from}&to=${to}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j); }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function clearFilters() {
    setFrom(today()); setTo(today());
    setLoading(true);
    fetch(`/api/operations/reports/daily-statement?from=${today()}&to=${today()}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j); }).finally(() => setLoading(false));
  }

  const subtitle = `${company?.name ?? ""}${company?.name ? " — " : ""}${from} to ${to}`;

  function billRowsForExport(rows: BillRow[]) {
    return rows.map((r, i) => ({ sno: i + 1, ...Object.fromEntries(visibleCols.map((c) => [c.key, c.money ? Number(r[c.key]).toFixed(2) : (r[c.key] ?? "—")])) }));
  }
  function doExcel() {
    if (!data) return;
    const exportColumns = [{ key: "sno", label: "S.No" }, ...visibleCols];
    downloadExcel(exportColumns.map((c) => ({ ...c, money: columns.find((x) => x.key === c.key)?.money })), [...billRowsForExport(data.cashBills), ...billRowsForExport(data.creditBills)], `DailyStatement_${from}_to_${to}`, { title: `Daily Statement — ${subtitle}` });
  }
  function doCsv() {
    if (!data) return;
    const exportColumns = [{ key: "sno", label: "S.No" }, ...visibleCols];
    downloadCsv(exportColumns, [...billRowsForExport(data.cashBills), ...billRowsForExport(data.creditBills)], `DailyStatement_${from}_to_${to}.csv`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/operations/reports" className="hover:text-primary">Operation Reports</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Daily Statement Report</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileBarChart className="h-5 w-5 text-primary" /> Daily Statement Report</h1>
          <p className="mt-0.5 text-sm text-muted">Sales KPIs, account breakdown, product summary, expenses, and Cash/Credit bill detail for the selected period.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/operations/reports"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Reports</Button></Link>
          <ColumnPicker columns={columns} cols={cols} onToggle={toggleCol} onRename={renameCol} />
          <Button variant="outline" size="md" onClick={doCsv}><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" size="md" onClick={doExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button size="md" onClick={() => setPrintOpen(true)}><Printer className="h-4 w-4" /> Print / PDF</Button>
        </div>
      </div>

      <CompanyLetterhead company={company} reportTitle="Daily Statement Report" from={from} to={to} generatedAt={generatedAt} />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={lbl}>From Date</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>To Date</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="md" onClick={load}>Search</Button>
          <Button variant="outline" size="md" onClick={clearFilters}><X className="h-4 w-4" /> Clear</Button>
        </div>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : !data ? null : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <SectionHeading title="Sales KPI" />
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Total # Loads" value={data.kpi.totalLoads} tone="primary" />
              <StatCard label="Cancelled Sales" value={data.kpi.cancelledSales} tone="danger" />
              <StatCard label="Total Sales" value={data.kpi.totalSales} tone="success" />
              <StatCard label="Cash Sales" value={data.kpi.cashSales} tone="info" />
              <StatCard label="Credit Sales" value={data.kpi.creditSales} tone="warning" />
              <StatCard label="Vehicle Rent" value={data.kpi.vehicleRent} tone="neutral" />
              <StatCard label="Total Transit Pass" value={data.kpi.transitPass} tone="neutral" />
              <StatCard label="Total Driver Bata" value={data.kpi.driverBata} tone="neutral" />
              <StatCard label="Total Discount" value={data.kpi.discount} tone="neutral" />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <SectionHeading title="Account Breakdown" />
              {data.accountBreakdown.length === 0 ? <p className="px-5 py-6 text-center text-2xs text-muted">No data.</p> : (
                <div className="max-h-[220px] overflow-auto"><table className="w-full border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10"><tr className="bg-surface-2/70 text-2xs uppercase tracking-wide text-muted"><th className="border-b border-border px-4 py-2 text-left">Account</th><th className="border-b border-border px-4 py-2 text-right">Count</th><th className="border-b border-border px-4 py-2 text-right">Amount</th></tr></thead>
                  <tbody>{data.accountBreakdown.map((a) => (<tr key={a.name} className="hover:bg-surface-2/30"><td className="border-b border-border/60 px-4 py-2 text-2xs">{a.name}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{a.count}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{a.amount.toFixed(2)}</td></tr>))}</tbody>
                  <tfoot className="sticky bottom-0 z-10"><tr className="bg-surface-2 font-bold text-foreground"><td className="border-t-2 border-primary/30 px-4 py-2.5 text-2xs">Total</td><td className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{data.accountBreakdown.reduce((s, a) => s + a.count, 0)}</td><td className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{data.accountBreakdown.reduce((s, a) => s + a.amount, 0).toFixed(2)}</td></tr></tfoot>
                </table></div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <SectionHeading title="Expenses Summary" />
              {data.expenses.length === 0 ? <p className="px-5 py-6 text-center text-2xs text-muted">No expenses recorded.</p> : (
                <div className="max-h-[220px] overflow-auto"><table className="w-full border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10"><tr className="bg-surface-2/70 text-2xs uppercase tracking-wide text-muted"><th className="border-b border-border px-4 py-2 text-left">Category</th><th className="border-b border-border px-4 py-2 text-right">Total Amount</th></tr></thead>
                  <tbody>{data.expenses.map((e) => (<tr key={e.category} className="hover:bg-surface-2/30"><td className="border-b border-border/60 px-4 py-2 text-2xs">{e.category}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{e.amount.toFixed(2)}</td></tr>))}</tbody>
                  <tfoot className="sticky bottom-0 z-10"><tr className="bg-surface-2 font-bold text-foreground"><td className="border-t-2 border-primary/30 px-4 py-2.5 text-2xs">Total Expenses</td><td className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{data.expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}</td></tr></tfoot>
                </table></div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <SectionHeading title="Product Sales Summary" />
            <div className="max-h-[300px] overflow-auto"><table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10"><tr className="bg-surface-2/70 text-2xs uppercase tracking-wide text-muted">
                <th className="border-b border-border px-4 py-2 text-left">Product</th><th className="border-b border-border px-4 py-2 text-right">Total Qty (Unit)</th><th className="border-b border-border px-4 py-2 text-right">Total Qty (Ton)</th><th className="border-b border-border px-4 py-2 text-right">Pass</th><th className="border-b border-border px-4 py-2 text-right">Credit</th><th className="border-b border-border px-4 py-2 text-right">Cash</th><th className="border-b border-border px-4 py-2 text-right">Cash without Pass</th>
              </tr></thead>
              <tbody>{data.productSummary.map((p) => (
                <tr key={p.name} className="hover:bg-surface-2/30"><td className="border-b border-border/60 px-4 py-2 text-2xs">{p.name}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{p.qtyUnit.toFixed(2)}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{p.qtyTon.toFixed(2)}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{p.pass.toFixed(2)}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{p.credit.toFixed(2)}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{p.cash.toFixed(2)}</td><td className="border-b border-border/60 px-4 py-2 text-right text-2xs">{p.cashWithoutPass.toFixed(2)}</td></tr>
              ))}</tbody>
              <tfoot className="sticky bottom-0 z-10"><tr className="bg-surface-2 font-bold text-foreground">
                <td className="border-t-2 border-primary/30 px-4 py-2.5 text-2xs">Total</td>
                {(["qtyUnit", "qtyTon", "pass", "credit", "cash", "cashWithoutPass"] as const).map((k) => <td key={k} className="border-t-2 border-primary/30 px-4 py-2.5 text-right text-2xs">{data.productSummary.reduce((s, p) => s + p[k], 0).toFixed(2)}</td>)}
              </tr></tfoot>
            </table></div>
          </div>

          <BillTable title="Sales Individual Bill Details — Cash Sales" rows={data.cashBills} columns={visibleCols} />
          <BillTable title="Sales Individual Bill Details — Credit Sales" rows={data.creditBills} columns={visibleCols} />
        </>
      )}

      {printOpen && data && <PrintOptionsModal onClose={() => setPrintOpen(false)} company={company} subtitle={subtitle} from={from} to={to} columns={visibleCols} data={data} />}
    </div>
  );
}

function BillTable({ title, rows, columns }: { title: string; rows: BillRow[]; columns: ReportColumn<keyof BillRow>[] }) {
  const totals = Object.fromEntries(columns.filter((c) => c.money).map((c) => [c.key, rows.reduce((s, r) => s + Number(r[c.key]), 0)]));
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <SectionHeading title={title} />
      {rows.length === 0 ? <p className="px-5 py-6 text-center text-2xs text-muted">No bills in this range.</p> : (
        <div className={cn("overflow-auto", TABLE_MAX_H)}>
          <table className="w-full min-w-[1300px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10"><tr className="bg-primary-subtle text-2xs uppercase tracking-wide text-primary"><th className="border-b border-border px-3 py-2.5 text-left">S.No</th>{columns.map((c) => <th key={c.key} className={cn("whitespace-nowrap border-b border-border px-3 py-2.5", c.money ? "text-right" : "text-left")}>{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-surface-2/30">
                <td className="border-b border-border/60 px-3 py-2 text-2xs text-muted">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c.key} className={cn("whitespace-nowrap border-b border-border/60 px-3 py-2 text-2xs text-foreground", c.money && "text-right tabular-nums")}>
                    {c.key === "status" ? <Badge tone={r.status === "Cancelled" ? "danger" : "success"}>{r.status}</Badge> : c.money ? Number(r[c.key]).toFixed(2) : String(r[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}</tbody>
            <tfoot className="sticky bottom-0 z-10"><tr className="bg-surface-2 font-bold text-foreground">
              <td className="border-t-2 border-primary/30 px-3 py-2.5 text-2xs">Total</td>
              {columns.map((c) => <td key={c.key} className={cn("border-t-2 border-primary/30 px-3 py-2.5 text-2xs", c.money && "text-right tabular-nums")}>{c.money ? totals[c.key]?.toFixed(2) : ""}</td>)}
            </tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function PrintOptionsModal({ onClose, company, subtitle, from, to, columns, data }: {
  onClose: () => void; company: ReturnType<typeof useCompany>; subtitle: string; from: string; to: string; columns: ReportColumn<keyof BillRow>[]; data: DailyStatementData;
}) {
  const [showCompany, setShowCompany] = useState(true);
  const [showGstin, setShowGstin] = useState(true);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ kpi: true, accounts: true, product: true, expenses: true, cash: true, credit: true });
  const toggleSection = (k: SectionKey) => setSections((s) => ({ ...s, [k]: !s[k] }));

  function billTableHtml(rows: BillRow[]) {
    const cols = [{ key: "sno", label: "S.No" }, ...columns];
    const exportRows = rows.map((r, i) => ({ sno: i + 1, ...Object.fromEntries(columns.map((c) => [c.key, c.money ? Number(r[c.key]).toFixed(2) : (r[c.key] ?? "—")])) }));
    const totals = Object.fromEntries(columns.filter((c) => c.money).map((c) => [c.key, rows.reduce((s, r) => s + Number(r[c.key]), 0)]));
    return { cols, exportRows, totals };
  }

  function doPrint() {
    const parts: string[] = [];
    if (sections.kpi) {
      const kpiHtml = `<div class="kpis">${Object.entries({ "Total # Loads": data.kpi.totalLoads, "Cancelled Sales": data.kpi.cancelledSales, "Total Sales": data.kpi.totalSales.toFixed(2), "Cash Sales": data.kpi.cashSales.toFixed(2), "Credit Sales": data.kpi.creditSales.toFixed(2), "Vehicle Rent": data.kpi.vehicleRent.toFixed(2), "Total Transit Pass": data.kpi.transitPass.toFixed(2), "Total Driver Bata": data.kpi.driverBata.toFixed(2), "Total Discount": data.kpi.discount.toFixed(2) }).map(([l, v]) => `<div class="kpi"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join("")}</div>`;
      parts.push(`<h2>Sales KPI</h2>${kpiHtml}`);
    }
    if (sections.accounts) parts.push(buildPrintTable("Account Breakdown", [{ key: "name", label: "Account" }, { key: "count", label: "Count", money: true }, { key: "amount", label: "Amount", money: true }], data.accountBreakdown.map((a) => ({ ...a, amount: a.amount.toFixed(2) }))));
    if (sections.product) parts.push(buildPrintTable("Product Sales Summary", [{ key: "name", label: "Product" }, { key: "qtyUnit", label: "Qty (Unit)", money: true }, { key: "qtyTon", label: "Qty (Ton)", money: true }, { key: "pass", label: "Pass", money: true }, { key: "credit", label: "Credit", money: true }, { key: "cash", label: "Cash", money: true }, { key: "cashWithoutPass", label: "Cash without Pass", money: true }], data.productSummary.map((p) => ({ ...p, qtyUnit: p.qtyUnit.toFixed(2), qtyTon: p.qtyTon.toFixed(2), pass: p.pass.toFixed(2), credit: p.credit.toFixed(2), cash: p.cash.toFixed(2), cashWithoutPass: p.cashWithoutPass.toFixed(2) }))));
    if (sections.expenses) parts.push(buildPrintTable("Expenses Summary", [{ key: "category", label: "Category" }, { key: "amount", label: "Total Amount", money: true }], data.expenses.map((e) => ({ ...e, amount: e.amount.toFixed(2) }))));
    if (sections.cash) { const t = billTableHtml(data.cashBills); parts.push(buildPrintTable("Cash Sales Detail", t.cols, t.exportRows, t.totals)); }
    if (sections.credit) { const t = billTableHtml(data.creditBills); parts.push(buildPrintTable("Credit Sales Detail", t.cols, t.exportRows, t.totals)); }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Daily Statement Report</title><style>${printCss()}</style></head><body>
    ${printLetterheadHtml(company, showCompany, showGstin)}
    <h1>Daily Statement Report</h1><p class="sub">${esc(subtitle)} · Period: ${esc(from)} to ${esc(to)} · Generated: ${esc(new Date().toLocaleString())}</p>
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
          <p className="text-2xs text-muted">Each printed table shows its own Overall Total row; pages are numbered (Page X of Y) in the bottom-right margin.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={doPrint}><Printer className="h-4 w-4" /> Print</Button></div>
      </div>
    </div>
  );
}
