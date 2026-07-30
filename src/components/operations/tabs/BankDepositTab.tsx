"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import type { BankDepositRow } from "@/lib/contracts/eodTransfer";

const inp = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";

export function BankDepositTab() {
  const toast = useToast();
  const fmt = useFmt();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BankDepositRow[]>([]);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [depositSlip, setDepositSlip] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/operations/day-close/bank-deposit", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setRows(j.rows);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!bankName.trim()) { toast.error("Enter the bank name."); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Enter an amount."); return; }
    setBusy(true);
    const j = await fetch("/api/operations/day-close/bank-deposit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName: bankName.trim(), bankAccount: bankAccount.trim() || undefined, depositSlip: depositSlip.trim() || undefined, amount: Number(amount), remarks: remarks.trim() || undefined }),
    }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (toast.result(j, "Bank deposit recorded.", "Could not record the deposit.")) { setBankName(""); setBankAccount(""); setDepositSlip(""); setAmount(""); setRemarks(""); load(); }
  }

  if (loading) return <div className="py-12"><AppLoader label="Loading bank deposits…" /></div>;

  return (
    <div className="space-y-5">
      <SectionCard title="Bank Deposit" icon={Landmark}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Bank Name *"><input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inp} placeholder="e.g. HDFC Bank" /></Field>
          <Field label="Bank Account"><input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={inp} /></Field>
          <Field label="Deposit Slip No."><input value={depositSlip} onChange={(e) => setDepositSlip(e.target.value)} className={inp} /></Field>
          <Field label="Amount *"><input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" className={inp} placeholder="0.00" /></Field>
          <div className="sm:col-span-2"><Field label="Remarks"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inp} /></Field></div>
        </div>
        <p className="mt-2 text-2xs text-subtle">Recording a deposit reduces the safe-locker balance by the deposited amount.</p>
        <div className="mt-4 flex justify-end"><Button size="md" onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {busy ? "Saving…" : "Record Deposit"}</Button></div>
      </SectionCard>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Recent Bank Deposits</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Bank</th><th className="px-4 py-3">Slip</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.depositNo}</td>
                  <td className="px-4 py-3 text-muted">{r.depositDate}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.bankName}{r.bankAccount ? ` · ${r.bankAccount}` : ""}</td>
                  <td className="px-4 py-3 text-muted">{r.depositSlip || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{fmt.money(r.amount)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={r.status === "Completed" ? "success" : "neutral"}>{r.status}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No bank deposits yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>{children}</label>;
}
