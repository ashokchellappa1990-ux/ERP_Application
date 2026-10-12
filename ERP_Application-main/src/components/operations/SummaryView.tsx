"use client";

import { ShoppingCart, Wallet, Banknote, Landmark, Plus, Minus, Equal, Hourglass, Vault } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { LiveSummary } from "@/lib/contracts/eod";

/** Presentational Live/Day summary — used by Live Summary and Day Closing tabs.
 *  Shows the cash-expected FORMULA and Bank/Finance closing balances clearly. */
export function SummaryView({ data }: { data: LiveSummary }) {
  const fmt = useFmt();
  const m = (n: number) => fmt.money(n);
  const c = data.cash, b = data.bank, f = data.finance, s = data.safe;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Sales */}
      <Card title="Sales" icon={ShoppingCart} tone="primary">
        <Stat k="B2C Sales" v={m(data.sales.b2cTotal)} sub={`${data.sales.b2cCount} bills`} />
        <Stat k="B2B Sales" v={m(data.sales.b2bTotal)} sub={`${data.sales.b2bCount} invoices`} />
        <Stat k="Returns" v={m(data.sales.returnsTotal)} sub={`${data.sales.returnsCount}`} tone="danger" />
        <Stat k="Tax (GST)" v={m(data.sales.taxTotal)} />
      </Card>

      {/* Collection */}
      <Card title="Collection by Mode" icon={Wallet} tone="success">
        {Object.keys(data.collection.byMode).length === 0 && <p className="col-span-full text-xs text-subtle">No collections yet.</p>}
        {Object.entries(data.collection.byMode).map(([mode, v]) => <Stat key={mode} k={mode} v={m(v)} />)}
        <Stat k="Total Collected" v={m(data.collection.total)} strong />
      </Card>

      {/* Cash details in the terminal / cash drawer — expected-cash formula */}
      <Card title="Cash Details — Terminal / Cash Drawer" icon={Banknote} tone="warning">
        <div className="col-span-full space-y-1.5">
          <FormulaRow sign="opening" label="Opening Cash" value={m(c.opening)} />
          <FormulaRow sign="+" label="Cash Sales" value={m(c.cashSales)} />
          <FormulaRow sign="+" label="Cash Collections" value={m(f.collections)} />
          <FormulaRow sign="+" label="Cash Deposits In" value={m(c.deposits)} />
          <FormulaRow sign="+" label="Safe Transfer In (to drawer)" value={m(c.safeTransferIn)} />
          <FormulaRow sign="-" label="Cash Refunds" value={m(c.cashRefund)} />
          <FormulaRow sign="-" label="Petty Cash" value={m(c.pettyCash)} />
          <FormulaRow sign="-" label="Cash Withdrawals" value={m(c.withdrawals)} />
          <FormulaRow sign="-" label="Safe Transfer Out" value={m(c.safeTransferOut)} />
          <FormulaRow sign="-" label="Bank Deposit" value={m(c.bankDeposit)} />
          <div className="!mt-2 flex items-center justify-between rounded-lg bg-primary px-3 py-2 text-white">
            <span className="flex items-center gap-1.5 text-sm font-semibold"><Equal className="h-3.5 w-3.5" /> Expected Cash</span>
            <span className="text-base font-bold tabular-nums">{m(c.expected)}</span>
          </div>
        </div>
      </Card>

      {/* Bank */}
      <Card title="Bank" icon={Landmark} tone="info">
        <div className="col-span-full space-y-1.5">
          <FormulaRow sign="opening" label="Opening Balance" value={m(b.openingBalance)} />
          <FormulaRow sign="+" label="Deposited Today" value={m(b.deposited)} />
          <FormulaRow sign="-" label="Withdrawn (to safe)" value={m(b.withdrawn)} />
          <ClosingRow label="Closing Balance" value={m(b.closing)} />
          <div className="!mt-2 flex items-center justify-between rounded-lg border border-warning/30 bg-warning-subtle/40 px-3 py-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Hourglass className="h-3.5 w-3.5 text-warning" /> In Transit</span>
            <span className="text-base font-bold tabular-nums text-foreground">{m(b.inTransit)}</span>
          </div>
          <p className="px-1 text-2xs text-subtle">Card / UPI / wallet / bank-transfer collected today — pending settlement to the bank.</p>
        </div>
      </Card>

      {/* Safe Locker */}
      <Card title="Safe Locker" icon={Vault} tone="warning">
        <div className="col-span-full space-y-1.5">
          <FormulaRow sign="opening" label="Opening Balance" value={m(s.opening)} />
          <FormulaRow sign="+" label="In from Terminals" value={m(s.inFromTerminal)} />
          <FormulaRow sign="+" label="In from Bank (withdrawal)" value={m(s.inFromBank)} />
          <FormulaRow sign="-" label="Out to Terminals" value={m(s.outToTerminal)} />
          <FormulaRow sign="-" label="Out to Bank Deposit" value={m(s.outToBank)} />
          <ClosingRow label="Closing Balance" value={m(s.closing)} />
        </div>
      </Card>

      {/* Finance */}
      <Card title="Finance" icon={Wallet} tone="info">
        <Stat k="Receipt Vouchers" v={String(f.receipt)} />
        <Stat k="Payment Vouchers" v={String(f.payment)} />
        <Stat k="Contra" v={String(f.contra)} />
        <Stat k="Journal" v={String(f.journal)} />
        <div className="col-span-full mt-1 space-y-1.5 border-t border-border pt-2">
          <FormulaRow sign="+" label="Collections (in)" value={m(f.collections)} />
          <FormulaRow sign="-" label="Supplier Payments (out)" value={m(f.supplierPayments)} />
          <FormulaRow sign="-" label="Petty Cash (out)" value={m(f.pettyCash)} />
          <ClosingRow label="Net Finance Movement" value={m(f.net)} />
        </div>
      </Card>
    </div>
  );
}

// Uses the canonical SectionCard heading (tinted strip, brand-bold title, primary
// icon chip) so headings match GRN and the rest of the app. `tone` is accepted but
// no longer drives the chip colour (kept for call-site compatibility).
function Card({ title, icon: Icon, wide, children }: { title: string; icon: typeof Wallet; tone?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <SectionCard title={title} icon={Icon} className={cn(wide && "lg:col-span-2")} bodyClass="grid gap-2.5 p-4 sm:grid-cols-2">
      {children}
    </SectionCard>
  );
}
function Stat({ k, v, sub, strong, tone }: { k: string; v: string; sub?: string; strong?: boolean; tone?: "danger" }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-2.5", strong && "border-primary/30 bg-primary-subtle/30")}>
      <p className="text-2xs uppercase tracking-wide text-subtle">{k}</p>
      <p className={cn("tabular-nums", strong ? "text-base font-bold text-foreground" : "text-sm font-semibold", tone === "danger" ? "text-danger" : "text-foreground")}>{v}</p>
      {sub && <p className="text-2xs text-muted">{sub}</p>}
    </div>
  );
}
function FormulaRow({ sign, label, value }: { sign: "+" | "-" | "opening"; label: string; value: string }) {
  const isPlus = sign === "+";
  const isMinus = sign === "-";
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 text-muted">
        <span className={cn("grid h-4 w-4 place-items-center rounded", isPlus ? "bg-success/15 text-success" : isMinus ? "bg-danger/15 text-danger" : "bg-surface-2 text-subtle")}>
          {isPlus ? <Plus className="h-3 w-3" /> : isMinus ? <Minus className="h-3 w-3" /> : "•"}
        </span>
        {label}
      </span>
      <span className={cn("tabular-nums font-medium", isMinus ? "text-danger" : "text-foreground")}>{isMinus ? `(${value})` : value}</span>
    </div>
  );
}
function ClosingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="!mt-2 flex items-center justify-between rounded-lg border border-info/30 bg-info-subtle/40 px-3 py-2">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Equal className="h-3.5 w-3.5 text-info" /> {label}</span>
      <span className="text-base font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
