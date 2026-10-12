"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Bank account picker — shown only when the payment/receipt mode is NON-CASH
 * (Bank Transfer / UPI / Cheque / Card / NEFT…). Lists the user's branch-scoped
 * setup_banks and reports {bankId, bankName, bankAccount} to the parent form.
 */
export interface BankValue { bankId: number | null; bankName: string; bankAccount: string }
export const emptyBank: BankValue = { bankId: null, bankName: "", bankAccount: "" };
export const isNonCashMode = (m?: string | null) => !!m && !m.toLowerCase().includes("cash");

interface Bank { id: number; bankName: string; account: string; label: string }
let cache: Bank[] | null = null;

export function BankPicker({ mode, value, onChange, label = "Bank Account", required, showAccount = true, className }: { mode?: string | null; value: BankValue; onChange: (v: BankValue) => void; label?: string; required?: boolean; showAccount?: boolean; className?: string }) {
  const [banks, setBanks] = useState<Bank[]>(cache ?? []);
  const [loaded, setLoaded] = useState(cache != null);
  useEffect(() => {
    if (cache) return;
    fetch("/api/finance/banks", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { cache = j.banks; setBanks(j.banks); } setLoaded(true); }).catch(() => setLoaded(true));
  }, []);
  if (!isNonCashMode(mode)) return null;
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted"><Landmark className="h-3 w-3" /> {label}{required ? " *" : ""}</span>
      <select value={value.bankId ?? ""} onChange={(e) => { const id = Number(e.target.value) || null; const b = banks.find((x) => x.id === id); onChange({ bankId: id, bankName: b?.bankName ?? "", bankAccount: b?.account ?? "" }); }}
        className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none">
        <option value="">{loaded && banks.length === 0 ? "No banks configured in Setup" : "Select bank…"}</option>
        {banks.map((b) => <option key={b.id} value={b.id}>{showAccount ? b.label : b.bankName}</option>)}
      </select>
    </label>
  );
}
