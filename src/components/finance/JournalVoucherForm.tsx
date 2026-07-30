"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotebookPen, ArrowLeft, Plus, Trash2, CheckCircle2, Scale, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import type { CentreOption } from "@/lib/contracts/costCentre";

interface Account { id: number; code: string; name: string; type: string; group: string }
interface Line { code: string; debit: string; credit: string; narration: string }
const EMPTY: Line = { code: "", debit: "", credit: "", narration: "" };
const n = (v: unknown) => Number(v) || 0;
const inr = (x: number) => formatMoney(x || 0);
const today = () => new Date().toISOString().slice(0, 10);
const TYPE_ORDER = ["Asset", "Liability", "Income", "Expense", "Equity"];

export function JournalVoucherForm() {
  const router = useRouter();
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dims, setDims] = useState<{ costCentres: CentreOption[]; profitCentres: CentreOption[] }>({ costCentres: [], profitCentres: [] });
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(today);
  const [refNo, setRefNo] = useState("");
  const [narration, setNarration] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [profitCenterId, setProfitCenterId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY }, { ...EMPTY }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, d] = await Promise.all([
        fetch("/api/accounting/chart-of-accounts", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/finance/dimensions", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (a?.ok) setAccounts(a.rows);
      if (d?.ok) setDims({ costCentres: d.costCentres ?? [], profitCentres: d.profitCentres ?? [] });
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const by = new Map<string, Account[]>();
    for (const a of accounts) { if (!by.has(a.type)) by.set(a.type, []); by.get(a.type)!.push(a); }
    return TYPE_ORDER.filter((t) => by.has(t)).map((t) => ({ type: t, items: by.get(t)! }));
  }, [accounts]);

  const setLine = (i: number, patch: Partial<Line>) => setLines((c) => c.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((c) => [...c, { ...EMPTY }]);
  const removeLine = (i: number) => setLines((c) => (c.length > 2 ? c.filter((_, j) => j !== i) : c));

  const drTotal = useMemo(() => +lines.reduce((s, l) => s + n(l.debit), 0).toFixed(2), [lines]);
  const crTotal = useMemo(() => +lines.reduce((s, l) => s + n(l.credit), 0).toFixed(2), [lines]);
  const diff = +(drTotal - crTotal).toFixed(2);
  const filled = lines.filter((l) => l.code && (n(l.debit) > 0 || n(l.credit) > 0)).length;
  const balanced = drTotal > 0 && Math.abs(diff) < 0.01;
  const canPost = balanced && filled >= 2;

  async function post() {
    if (!canPost) return;
    setBusy(true);
    const payload = {
      date, refNo, narration,
      costCenterId: costCenterId ? Number(costCenterId) : null, profitCenterId: profitCenterId ? Number(profitCenterId) : null,
      lines: lines.filter((l) => l.code && (n(l.debit) > 0 || n(l.credit) > 0)).map((l) => ({ code: l.code, debit: n(l.debit), credit: n(l.credit), narration: l.narration })),
    };
    const j = await fetch("/api/finance/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (j?.ok) { toast.show(j.message || "Posted.", { type: "success" }); router.push("/finance/journal"); }
    else toast.show(j?.message || "Could not post the voucher.", { type: "error" });
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance/journal" className="hover:text-foreground">Journal</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New Voucher</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><NotebookPen className="h-5 w-5 text-primary" /> New Journal Voucher</h1>
          <p className="mt-0.5 text-sm text-muted">Manually record a balanced double-entry voucher. It posts straight to the General Ledger.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/finance/journal"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={post} disabled={!canPost || busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Posting…" : "Post Voucher"}</Button>
        </div>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading accounts…" /></div> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <SectionCard icon={NotebookPen} title="Journal Lines (double-entry)">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-subtle"><th className="px-2 py-2 text-left">Account</th><th className="px-2 py-2 text-left">Line Narration</th><th className="px-2 py-2 text-right">Debit</th><th className="px-2 py-2 text-right">Credit</th><th className="px-2 py-2" /></tr></thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="px-2 py-2">
                          <select value={l.code} onChange={(e) => setLine(i, { code: e.target.value })} className="h-9 w-full min-w-[180px] rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none">
                            <option value="">Select account…</option>
                            {grouped.map((g) => <optgroup key={g.type} label={g.type}>{g.items.map((a) => <option key={a.id} value={a.code}>{a.code} · {a.name}</option>)}</optgroup>)}
                          </select>
                        </td>
                        <td className="px-2 py-2"><input value={l.narration} onChange={(e) => setLine(i, { narration: e.target.value })} placeholder="Optional" className="h-9 w-full min-w-[120px] rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="px-2 py-2"><input type="number" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} placeholder="0.00" className="h-9 w-28 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="px-2 py-2"><input type="number" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} placeholder="0.00" className="h-9 w-28 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="px-2 py-2 text-right">{lines.length > 2 && <button onClick={() => removeLine(i)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-border bg-surface-2/50 font-bold text-foreground"><td className="px-2 py-2.5" colSpan={2}>Total</td><td className="px-2 py-2.5 text-right tabular-nums">{inr(drTotal)}</td><td className="px-2 py-2.5 text-right tabular-nums">{inr(crTotal)}</td><td /></tr></tfoot>
                </table>
              </div>
              <button onClick={addLine} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Add line</button>
            </SectionCard>

            {(dims.costCentres.length > 0 || dims.profitCentres.length > 0) && (
              <SectionCard icon={Building2} title="Cost / Profit Centre" action={<span className="text-2xs text-subtle">Optional · stamped on the voucher</span>}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={lbl}>Cost Centre</label><select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} className={inp}><option value="">— None —</option>{dims.costCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></div>
                  <div><label className={lbl}>Profit Centre</label><select value={profitCenterId} onChange={(e) => setProfitCenterId(e.target.value)} className={inp}><option value="">— None —</option>{dims.profitCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></div>
                </div>
              </SectionCard>
            )}
          </div>

          <aside className="space-y-4">
            <SectionCard icon={Scale} title="Voucher">
              <div className="space-y-3">
                <div><label className={lbl}>Voucher No.</label><input readOnly value="JV — auto on post" className="h-9 w-full rounded-md border border-border bg-surface-2/50 px-3 font-mono text-sm text-primary" /></div>
                <div><label className={lbl}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Reference No.</label><input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Optional (bill / doc ref)" className={inp} /></div>
                <div><label className={lbl}>Narration</label><textarea value={narration} onChange={(e) => setNarration(e.target.value)} rows={2} placeholder="Reason for this entry" className={cn(inp, "h-auto py-2")} /></div>
              </div>
              <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted">Total Debit</span><span className="font-semibold tabular-nums text-foreground">{inr(drTotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Total Credit</span><span className="font-semibold tabular-nums text-foreground">{inr(crTotal)}</span></div>
                <div className={cn("mt-1 flex items-center justify-between border-t border-border pt-1 font-bold", balanced ? "text-success" : "text-danger")}><span>{balanced ? "Balanced ✓" : "Difference"}</span><span className="tabular-nums">{inr(Math.abs(diff))}</span></div>
              </div>
              <Button size="lg" className="mt-3 w-full" onClick={post} disabled={!canPost || busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Posting…" : "Post Voucher"}</Button>
              {!canPost && <p className="mt-2 text-center text-2xs font-medium text-danger">{filled < 2 ? "Add at least two account lines with amounts." : "Debit must equal Credit."}</p>}
            </SectionCard>
          </aside>
        </div>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
