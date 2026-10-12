"use client";

import { type ReactNode } from "react";
import { ArrowLeft, Printer, Download, Calendar } from "lucide-react";
import {
  LEDGERS,
  GST_LEDGERS,
  COST_CENTERS,
  PROFIT_CENTERS,
  REPORTS,
  type AccountType,
} from "@/lib/finance/coaConfig";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";

/* Sample posted balances per ledger code (would come from journal_lines). */
const AMOUNTS: Record<string, number> = {
  "1101": 25000, "1102": 480000, "1103": 184500, "1110": 1275000,
  "2101": 342000, "2110": 48200, "3101": 1534300,
  "4101": 1850000, "4102": 920000,
  "5101": 1980000, "6101": 120000, "6102": 480000, "6201": 150000,
};
const GST_AMOUNTS: Record<string, number> = {
  "1151": 45000, "1152": 45000, "1153": 18000,
  "2151": 70000, "2152": 70000, "2153": 22000,
  "1160": 8000, "2160": 5000,
};

const inr = (n: number) => formatMoney(n);
const isDebit = (t: AccountType) => t === "Asset" || t === "Expense";
const amt = (code: string) => AMOUNTS[code] ?? 0;

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const ledgersByType = (t: AccountType) => LEDGERS.filter((l) => l.type === t);
const cogs = LEDGERS.filter((l) => l.group === "Purchase Cost" || l.group === "Freight Cost");
const opex = LEDGERS.filter((l) => l.type === "Expense" && !cogs.includes(l));

const totalSales = sum(ledgersByType("Income").map((l) => amt(l.code)));
const totalCogs = sum(cogs.map((l) => amt(l.code)));
const grossProfit = totalSales - totalCogs;
const totalOpex = sum(opex.map((l) => amt(l.code)));
const netProfit = grossProfit - totalOpex;
const totalAssets = sum(ledgersByType("Asset").map((l) => amt(l.code)));
const totalLiab = sum(ledgersByType("Liability").map((l) => amt(l.code)));
const totalEquity = sum(ledgersByType("Equity").map((l) => amt(l.code))) + netProfit;

/* ----------------------------------------------------- statement bits -- */
function Statement({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-surface-2 px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-subtle">
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Line({ label, value, indent, bold, tone }: { label: string; value?: string; indent?: boolean; bold?: boolean; tone?: "success" | "danger" }) {
  return (
    <tr className={cn("border-b border-border last:border-0", bold && "bg-surface-2")}>
      <td className={cn("px-4 py-2", indent && "pl-8", bold ? "font-bold text-foreground" : "text-muted")}>{label}</td>
      <td className={cn("px-4 py-2 text-right tabular-nums", bold ? "font-bold" : "font-medium", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground")}>{value}</td>
    </tr>
  );
}
function TwoColRow({ l, lv, r, rv, bold }: { l: string; lv: string; r: string; rv: string; bold?: boolean }) {
  return (
    <tr className={cn("border-b border-border last:border-0", bold && "bg-surface-2")}>
      <td className={cn("px-4 py-2", bold ? "font-bold text-foreground" : "text-muted")}>{l}</td>
      <td className={cn("px-4 py-2 text-right tabular-nums", bold ? "font-bold text-foreground" : "font-medium text-foreground")}>{lv}</td>
      <td className={cn("border-l border-border px-4 py-2", bold ? "font-bold text-foreground" : "text-muted")}>{r}</td>
      <td className={cn("px-4 py-2 text-right tabular-nums", bold ? "font-bold text-foreground" : "font-medium text-foreground")}>{rv}</td>
    </tr>
  );
}

/* ------------------------------------------------------- each report --- */
function TrialBalance() {
  const rows = LEDGERS.map((l) => ({ name: l.name, dr: isDebit(l.type) ? amt(l.code) : 0, cr: isDebit(l.type) ? 0 : amt(l.code) }));
  const tDr = sum(rows.map((r) => r.dr));
  const tCr = sum(rows.map((r) => r.cr));
  return (
    <Statement title="Trial Balance · as at 31 Mar 2026">
      <tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
        <td className="px-4 py-2">Account</td>
        <td className="px-4 py-2 text-right">Debit</td>
        <td className="px-4 py-2 text-right">Credit</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.name} className="border-b border-border last:border-0">
          <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
          <td className="px-4 py-2 text-right tabular-nums text-foreground">{r.dr ? inr(r.dr) : "—"}</td>
          <td className="px-4 py-2 text-right tabular-nums text-foreground">{r.cr ? inr(r.cr) : "—"}</td>
        </tr>
      ))}
      <tr className="bg-surface-2 font-bold text-foreground">
        <td className="px-4 py-2.5">Total</td>
        <td className="px-4 py-2.5 text-right tabular-nums">{inr(tDr)}</td>
        <td className="px-4 py-2.5 text-right tabular-nums">{inr(tCr)}</td>
      </tr>
    </Statement>
  );
}
function ProfitLoss() {
  return (
    <Statement title="Profit & Loss · 1 Apr 2025 – 31 Mar 2026">
      <Line label="Income" bold />
      {ledgersByType("Income").map((l) => <Line key={l.code} label={l.name} value={inr(amt(l.code))} indent />)}
      <Line label="Total Income" value={inr(totalSales)} bold />
      <Line label="Expenses" bold />
      {LEDGERS.filter((l) => l.type === "Expense").map((l) => <Line key={l.code} label={l.name} value={inr(amt(l.code))} indent />)}
      <Line label="Total Expenses" value={inr(totalCogs + totalOpex)} bold />
      <Line label="Net Profit" value={inr(netProfit)} bold tone={netProfit >= 0 ? "success" : "danger"} />
    </Statement>
  );
}
function TradingAccount() {
  return (
    <Statement title="Trading Account · 1 Apr 2025 – 31 Mar 2026">
      <Line label="Sales" value={inr(totalSales)} bold />
      <Line label="Less: Cost of Goods Sold" bold />
      {cogs.map((l) => <Line key={l.code} label={l.name} value={inr(amt(l.code))} indent />)}
      <Line label="Total COGS" value={inr(totalCogs)} bold />
      <Line label="Gross Profit" value={inr(grossProfit)} bold tone="success" />
    </Statement>
  );
}
function BalanceSheet() {
  return (
    <Statement title="Balance Sheet · as at 31 Mar 2026">
      <tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
        <td className="px-4 py-2" colSpan={2}>Liabilities &amp; Equity</td>
        <td className="border-l border-border px-4 py-2" colSpan={2}>Assets</td>
      </tr>
      <TwoColRow l="Capital + Net Profit" lv={inr(totalEquity)} r={ledgersByType("Asset")[0]?.name ?? ""} rv={inr(amt(ledgersByType("Asset")[0]?.code ?? ""))} />
      {ledgersByType("Liability").map((l, i) => (
        <TwoColRow key={l.code} l={l.name} lv={inr(amt(l.code))} r={ledgersByType("Asset")[i + 1]?.name ?? ""} rv={ledgersByType("Asset")[i + 1] ? inr(amt(ledgersByType("Asset")[i + 1].code)) : ""} />
      ))}
      <TwoColRow l="Total" lv={inr(totalLiab + totalEquity)} r="Total" rv={inr(totalAssets)} bold />
    </Statement>
  );
}
function CashFlow() {
  return (
    <Statement title="Cash Flow Statement · 1 Apr 2025 – 31 Mar 2026">
      <Line label="Operating Activities" bold />
      <Line label="Net profit" value={inr(netProfit)} indent />
      <Line label="Working capital changes" value={inr(392000)} indent />
      <Line label="Net cash from operations" value={inr(432000)} bold />
      <Line label="Investing Activities" bold />
      <Line label="Purchase of fixed assets" value={`(${inr(85000)})`} indent tone="danger" />
      <Line label="Financing Activities" bold />
      <Line label="Capital introduced" value={inr(0)} indent />
      <Line label="Net increase in cash" value={inr(347000)} bold tone="success" />
      <Line label="Opening cash & bank" value={inr(158000)} />
      <Line label="Closing cash & bank" value={inr(505000)} bold />
    </Statement>
  );
}
function GstReport() {
  const out = GST_LEDGERS.filter((g) => g.kind === "Output");
  const inp = GST_LEDGERS.filter((g) => g.kind === "Input");
  const tOut = sum(out.map((g) => GST_AMOUNTS[g.code] ?? 0));
  const tIn = sum(inp.map((g) => GST_AMOUNTS[g.code] ?? 0));
  return (
    <Statement title="GST Summary · Mar 2026">
      <Line label="Output GST (on sales)" bold />
      {out.map((g) => <Line key={g.code} label={g.name} value={inr(GST_AMOUNTS[g.code] ?? 0)} indent />)}
      <Line label="Total Output GST" value={inr(tOut)} bold />
      <Line label="Input GST (on purchases)" bold />
      {inp.map((g) => <Line key={g.code} label={g.name} value={inr(GST_AMOUNTS[g.code] ?? 0)} indent />)}
      <Line label="Total Input GST (ITC)" value={inr(tIn)} bold />
      <Line label="Net GST Payable" value={inr(tOut - tIn)} bold tone="danger" />
    </Statement>
  );
}
function CostCenterReport() {
  const alloc: Record<string, number> = { "CC-01": 250000, "CC-02": 180000, "CC-03": 140000, "CC-04": 90000, "CC-05": 90000 };
  const total = sum(COST_CENTERS.map((c) => alloc[c.code] ?? 0));
  return (
    <Statement title="Cost Center Report · 1 Apr 2025 – 31 Mar 2026">
      <tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
        <td className="px-4 py-2">Cost Center</td><td className="px-4 py-2 text-right">Expenses</td>
      </tr>
      {COST_CENTERS.map((c) => <Line key={c.code} label={`${c.name} (${c.code})`} value={inr(alloc[c.code] ?? 0)} />)}
      <Line label="Total Expenses" value={inr(total)} bold />
    </Statement>
  );
}
function ProfitCenterReport() {
  const data: Record<string, { rev: number; profit: number }> = {
    "PC-01": { rev: 1500000, profit: 22000 },
    "PC-02": { rev: 920000, profit: 12000 },
    "PC-03": { rev: 280000, profit: 5000 },
    "PC-04": { rev: 70000, profit: 1000 },
  };
  const tRev = sum(PROFIT_CENTERS.map((c) => data[c.code]?.rev ?? 0));
  const tProfit = sum(PROFIT_CENTERS.map((c) => data[c.code]?.profit ?? 0));
  return (
    <Statement title="Profit Center Report · 1 Apr 2025 – 31 Mar 2026">
      <tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
        <td className="px-4 py-2">Profit Center</td><td className="px-4 py-2 text-right">Revenue</td><td className="px-4 py-2 text-right">Profit</td>
      </tr>
      {PROFIT_CENTERS.map((c) => (
        <tr key={c.code} className="border-b border-border last:border-0">
          <td className="px-4 py-2 font-medium text-foreground">{c.name}</td>
          <td className="px-4 py-2 text-right tabular-nums text-foreground">{inr(data[c.code]?.rev ?? 0)}</td>
          <td className="px-4 py-2 text-right tabular-nums font-semibold text-success">{inr(data[c.code]?.profit ?? 0)}</td>
        </tr>
      ))}
      <tr className="bg-surface-2 font-bold text-foreground">
        <td className="px-4 py-2.5">Total</td>
        <td className="px-4 py-2.5 text-right tabular-nums">{inr(tRev)}</td>
        <td className="px-4 py-2.5 text-right tabular-nums">{inr(tProfit)}</td>
      </tr>
    </Statement>
  );
}

const BODIES: Record<string, () => ReactNode> = {
  trial: TrialBalance,
  pl: ProfitLoss,
  trading: TradingAccount,
  bs: BalanceSheet,
  cashflow: CashFlow,
  gst: GstReport,
  cost: CostCenterReport,
  profit: ProfitCenterReport,
};

export function ReportView({ reportId, onBack }: { reportId: string; onBack: () => void }) {
  const report = REPORTS.find((r) => r.id === reportId);
  const Body = BODIES[reportId];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to reports
          </button>
          <h3 className="text-base font-bold text-foreground">{report?.name}</h3>
          <p className="text-2xs text-muted">{report?.desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted">
            <Calendar className="h-3.5 w-3.5" /> FY 2025–26
          </span>
          <Button variant="outline" size="sm"><Printer className="h-3.5 w-3.5" /> Print</Button>
          <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Export</Button>
        </div>
      </div>
      {Body ? <Body /> : <p className="text-sm text-muted">Report template coming soon.</p>}
      <p className="text-2xs text-subtle">Figures are generated from the configured chart of accounts (sample postings). Wire to /api/reports for live data.</p>
    </div>
  );
}
