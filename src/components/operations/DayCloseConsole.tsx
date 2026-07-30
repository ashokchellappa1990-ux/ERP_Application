"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Sunrise, Activity, ArrowLeftRight, Landmark, Calculator, LogOut, CalendarCheck, Monitor } from "lucide-react";
import { cn } from "@/lib/cn";
import { DayOpeningTab } from "@/components/operations/tabs/DayOpeningTab";
import { LiveSummaryTab } from "@/components/operations/tabs/LiveSummaryTab";
import { CashClosingTab } from "@/components/operations/tabs/CashClosingTab";
import { ShiftClosingTab } from "@/components/operations/tabs/ShiftClosingTab";
import { FundTransferTab } from "@/components/operations/tabs/FundTransferTab";
import { BankDepositTab } from "@/components/operations/tabs/BankDepositTab";
import { DayClosingTab } from "@/components/operations/tabs/DayClosingTab";
import type { EodTerminalOptions } from "@/lib/contracts/eod";

export interface EodTabProps { terminalId?: string }

const TABS: { id: string; label: string; icon: typeof Sunrise; body: ComponentType<EodTabProps> }[] = [
  { id: "day-opening", label: "Day Opening", icon: Sunrise, body: DayOpeningTab },
  { id: "live-summary", label: "Live Summary", icon: Activity, body: LiveSummaryTab },
  { id: "fund-transfer", label: "Fund Transfer", icon: ArrowLeftRight, body: FundTransferTab },
  { id: "bank-deposit", label: "Bank Deposit", icon: Landmark, body: BankDepositTab },
  { id: "cash-closing", label: "Cash Closing", icon: Calculator, body: CashClosingTab },
  { id: "shift-closing", label: "Shift Closing", icon: LogOut, body: ShiftClosingTab },
  { id: "day-closing", label: "Day Closing", icon: CalendarCheck, body: DayClosingTab },
];

export function DayCloseConsole() {
  const [tab, setTab] = useState<string>("day-opening");
  const [opts, setOpts] = useState<EodTerminalOptions | null>(null);
  const [terminalId, setTerminalId] = useState(""); // "" = All

  useEffect(() => {
    fetch("/api/operations/day-close/terminal-options", { cache: "no-store" }).then((r) => r.json()).then((j: EodTerminalOptions) => {
      if (j.ok) { setOpts(j); if (j.defaultId != null) setTerminalId(String(j.defaultId)); }
    }).catch(() => {});
  }, []);

  const current = TABS.find((t) => t.id === tab)!;
  const Body = current.body;
  const showFilter = !!opts?.show;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Day Open / Close</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><CalendarCheck className="h-5 w-5 text-primary" /> Day Opening &amp; Day Closing</h1>
        <p className="mt-0.5 text-sm text-muted">Open the day, monitor live activity, reconcile cash and close shifts &amp; the business day.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border">
        <div className="flex flex-wrap items-center gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        {showFilter && (
          <label className="mb-1.5 inline-flex items-center gap-1.5 text-xs text-muted">
            <Monitor className="h-4 w-4 text-primary" />
            <select value={terminalId} onChange={(e) => setTerminalId(e.target.value)} className="h-8 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
              {!opts!.restricted && <option value="">All Terminals</option>}
              {opts!.terminals.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <Body terminalId={showFilter ? terminalId : ""} />
    </div>
  );
}
