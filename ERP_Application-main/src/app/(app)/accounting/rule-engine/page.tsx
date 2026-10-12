"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Workflow, Settings2, ArrowRight, Lock } from "lucide-react";
import { getRules, type RuleGroup } from "@/lib/finance/rulesStore";
import { cn } from "@/lib/cn";

// View-only reference. This screen is a MIRROR of the system's posting code, not a
// configuration surface — GL posting is driven in code (src/lib/accounting/post.ts
// with the ACC chart-of-accounts codes), so there is no add / edit / delete here.
// Merge any saved config over defaults for display, always refreshing the
// Live/Planned (`wired`) flag and surfacing newly-added default transactions.
function mergeRules(saved: RuleGroup[]): RuleGroup[] {
  const base = getRules();
  const byModule = new Map(saved.map((g) => [g.module, g]));
  const merged = base.map((g) => {
    const s = byModule.get(g.module);
    if (!s) return g;
    const defByTxn = new Map(g.rules.map((r) => [r.txn, r]));
    const savedTxns = new Set(s.rules.map((r) => r.txn));
    const savedRules = s.rules.map((r) => ({ ...r, wired: defByTxn.get(r.txn)?.wired ?? r.wired }));
    const newDefaults = g.rules.filter((r) => !savedTxns.has(r.txn));
    return { ...g, auto: s.auto, rules: [...savedRules, ...newDefaults] };
  });
  for (const s of saved) if (!base.some((g) => g.module === s.module)) merged.push(s);
  return merged;
}

export default function RuleEnginePage() {
  const [groups, setGroups] = useState<RuleGroup[]>(() => getRules());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const j = await fetch("/api/accounting/rules", { cache: "no-store" }).then((r) => r.json());
        if (active && j.ok && Array.isArray(j.config) && j.config.length) setGroups(mergeRules(j.config as RuleGroup[]));
      } catch { /* keep defaults */ }
    })();
    return () => { active = false; };
  }, []);

  const liveCount = groups.reduce((n, g) => n + g.rules.filter((r) => r.wired !== false).length, 0);
  const plannedCount = groups.reduce((n, g) => n + g.rules.filter((r) => r.wired === false).length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/accounting/chart-of-accounts" className="hover:text-foreground">Accounting</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Accounting Rule Engine</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Workflow className="h-5 w-5 text-primary" /> Accounting Rule Engine</h1>
          <p className="mt-0.5 text-sm text-muted">The Dr/Cr ledger mapping (with account codes) for every ERP transaction — a mirror of the system&apos;s actual posting code. <span className="font-semibold text-success">Live</span> rows are auto-posted today; <span className="font-semibold text-muted">Planned</span> rows are documented but not yet wired.</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-2xs font-semibold text-muted"><Lock className="h-3.5 w-3.5" /> View only · system-defined</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-info/30 bg-info-subtle px-4 py-2.5 text-xs font-medium text-info">
        <Settings2 className="h-4 w-4 shrink-0" />
        <span>Posting rules are defined by the system and are not editable here — they reflect exactly how the General Ledger is posted in code.</span>
        <span className="ml-auto flex items-center gap-3 font-semibold"><span className="text-success">{liveCount} Live</span><span className="text-muted">{plannedCount} Planned</span></span>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.module} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary-subtle/30 px-5 py-3">
              <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold text-foreground">{g.module}</h2><span className="rounded-full bg-surface px-2 py-0.5 text-2xs font-medium text-muted">{g.rules.length} rules</span></div>
              <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", g.auto ? "bg-success-subtle text-success" : "bg-surface text-muted")}>{g.auto ? "Auto-Post ON" : "Manual"}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-5 py-2.5">Transaction</th><th className="px-4 py-2.5">Debit (Dr)</th><th className="px-4 py-2.5 text-center"></th><th className="px-4 py-2.5">Credit (Cr)</th></tr></thead>
                <tbody>
                  {g.rules.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-5 py-2.5 font-medium text-foreground"><div className="flex items-center gap-2"><span>{r.txn}</span>{r.wired === false ? <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Planned</span> : <span className="rounded-full bg-success-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">Live</span>}</div></td>
                      <td className="px-4 py-2.5"><span className="rounded-md bg-primary-subtle/60 px-2 py-1 text-2xs font-medium text-primary">{r.dr}</span></td>
                      <td className="px-4 py-2.5 text-center text-subtle"><ArrowRight className="mx-auto h-3.5 w-3.5" /></td>
                      <td className="px-4 py-2.5"><span className="rounded-md bg-secondary-subtle/60 px-2 py-1 text-2xs font-medium text-secondary">{r.cr}</span></td>
                    </tr>
                  ))}
                  {g.rules.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-sm text-muted">No rules defined for this module.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">This mapping mirrors the system&apos;s posting engine — account legs resolve against the Chart of Accounts (codes shown), and tax legs (CGST/SGST/IGST, TDS, TCS) post automatically. <span className="font-semibold">Live</span> transactions are auto-posted to the GL today; <span className="font-semibold">Planned</span> ones are documented for reference.</p>
    </div>
  );
}
