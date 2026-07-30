"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet, Save, CheckCircle2, Plus, Trash2, FolderTree, Target, Users, Hash, Receipt } from "lucide-react";
// Target is used for both Budget Tracking (section) and the per-head "Budget" toggle.
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { cn } from "@/lib/cn";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import type { ExpenseHeadDto as Head, ExpenseAccountDto as Acct, PettyCashConfigDto as Cfg } from "@/lib/contracts/finance";

const YEAR_FORMATS = [{ v: "fy_short", l: "FY 26-27" }, { v: "fy_full", l: "FY 2026-2027" }, { v: "cal_full", l: "2026" }, { v: "cal_short", l: "26" }];
const RESET_FREQ = [{ v: "never", l: "Never (continuous)" }, { v: "monthly", l: "Monthly" }, { v: "financial_year", l: "Financial Year" }];
function yearTok(fmt: string) { const d = new Date(); const y = d.getFullYear(); const fs = d.getMonth() >= 3 ? y : y - 1; if (fmt === "fy_full") return `${fs}-${fs + 1}`; if (fmt === "cal_full") return `${y}`; if (fmt === "cal_short") return String(y).slice(-2); return `${String(fs).slice(-2)}-${String(fs + 1).slice(-2)}`; }
const n = (v: unknown) => Number(v) || 0;

export default function PettyCashConfigPage() {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [cfg, setCfg] = useState<Cfg>({ budgetEnabled: false, budgetScope: "all", partySource: "both", gstEnabled: false, voucherPrefix: "PCV", voucherPadding: 4, voucherSeparator: "-", voucherIncludeYear: false, voucherIncludeMonth: false, voucherYearFormat: "fy_short", voucherResetFrequency: "never", voucherSeq: 0 });
  const [heads, setHeads] = useState<Head[]>([]);
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [budgets, setBudgets] = useState<Record<number, number>>({});
  const [actuals, setActuals] = useState<Record<number, number>>({});
  const [newCat, setNewCat] = useState("");
  const [newHead, setNewHead] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const j = await fetch("/api/finance/petty-cash/config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setCfg(j.config); setHeads(j.heads); setAccounts(j.accounts ?? []); setBudgets(j.budgets ?? {}); setActuals(j.actuals ?? {}); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => heads.filter((h) => h.parentId == null), [heads]);
  const headsOf = (catId: number) => heads.filter((h) => h.parentId === catId);

  async function addHead(name: string, parentId: number | null) {
    if (!name.trim()) return;
    const j = await fetch("/api/finance/petty-cash/heads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentId }) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setHeads((h) => [...h, j.head]);
  }
  async function renameHead(id: number, name: string) {
    setHeads((h) => h.map((x) => (x.id === id ? { ...x, name } : x)));
    await fetch("/api/finance/petty-cash/heads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }) }).catch(() => {});
  }
  async function toggleHead(id: number, active: boolean) {
    setHeads((h) => h.map((x) => (x.id === id ? { ...x, active } : x)));
    await fetch("/api/finance/petty-cash/heads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active }) }).catch(() => {});
  }
  async function setHeadAccount(id: number, accountId: number | null) {
    const a = accountId ? accounts.find((x) => x.id === accountId) : null;
    setHeads((h) => h.map((x) => (x.id === id ? { ...x, accountId, accountCode: a?.code ?? null, accountName: a?.name ?? null } : x)));
    await fetch("/api/finance/petty-cash/heads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, accountId }) }).catch(() => {});
  }
  async function setHeadTrackBudget(id: number, trackBudget: boolean) {
    setHeads((h) => h.map((x) => (x.id === id ? { ...x, trackBudget } : x)));
    await fetch("/api/finance/petty-cash/heads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, trackBudget }) }).catch(() => {});
  }
  async function deleteHead(id: number) {
    await fetch(`/api/finance/petty-cash/heads?id=${id}`, { method: "DELETE" }).catch(() => {});
    setHeads((h) => h.filter((x) => x.id !== id && x.parentId !== id));
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/finance/petty-cash/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cfg, budgets: Object.entries(budgets).map(([headId, amount]) => ({ headId: Number(headId), amount })) }) });
      setSaved(true); window.setTimeout(() => setSaved(false), 1800);
    } catch { /* */ } finally { setSaving(false); }
  }

  const voucherPreview = useMemo(() => {
    const sep = cfg.voucherSeparator || "";
    const parts = [cfg.voucherPrefix];
    if (cfg.voucherIncludeYear) parts.push(yearTok(cfg.voucherYearFormat));
    if (cfg.voucherIncludeMonth) parts.push(String(new Date().getMonth() + 1).padStart(2, "0"));
    parts.push(String((cfg.voucherSeq || 0) + 1).padStart(Math.max(1, cfg.voucherPadding || 1), "0"));
    return parts.join(sep);
  }, [cfg]);
  const showBudget = cfg.budgetEnabled;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Petty Cash / Expense Configuration</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wallet className="h-5 w-5 text-primary" /> Petty Cash / Expense Configuration</h1>
          <p className="mt-0.5 text-sm text-muted">Set up expense categories &amp; heads, budgets, party source and the voucher number series.</p>
        </div>
        <Button size="md" onClick={save} disabled={saving || loading}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Configuration"}{saved && <CheckCircle2 className="h-4 w-4" />}</Button>
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* Expense categories & heads */}
          <SectionCard icon={FolderTree} title="Expense Categories & Heads">
            <div className="space-y-3">
              <p className="rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-2xs text-muted">Map each expense head to its <span className="font-semibold text-foreground">GL account</span> (Accounts Head Mapping). When an expense voucher is submitted, its amount posts to the mapped account. Unmapped heads (⚠) post to <span className="font-medium">Indirect Expenses</span> by default.</p>
              {categories.map((cat) => (
                <div key={cat.id} className="rounded-xl border border-border bg-surface-2/30 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input value={cat.name} onChange={(e) => setHeads((h) => h.map((x) => (x.id === cat.id ? { ...x, name: e.target.value } : x)))} onBlur={(e) => renameHead(cat.id, e.target.value)} className="h-8 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-bold text-foreground hover:border-border focus:border-primary focus:bg-surface focus:outline-none" />
                    <button onClick={() => deleteHead(cat.id)} title="Delete category" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-1.5 pl-3">
                    {headsOf(cat.id).map((h) => (
                      <div key={h.id} className="flex items-center gap-2">
                        <input value={h.name} onChange={(e) => setHeads((hs) => hs.map((x) => (x.id === h.id ? { ...x, name: e.target.value } : x)))} onBlur={(e) => renameHead(h.id, e.target.value)} className={cn("h-8 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-border focus:border-primary focus:bg-surface focus:outline-none", h.active ? "text-foreground" : "text-subtle line-through")} />
                        <select value={h.accountId ?? ""} onChange={(e) => setHeadAccount(h.id, e.target.value ? Number(e.target.value) : null)} title="Accounts head mapping — the GL account this head posts to" className={cn("h-8 w-44 shrink-0 rounded-md border bg-surface px-2 text-xs focus:border-primary focus:outline-none", h.accountId ? "border-border-strong text-foreground" : "border-warning/60 text-warning")}>
                          <option value="">⚠ Map account…</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                        </select>
                        <button type="button" onClick={() => setHeadTrackBudget(h.id, !h.trackBudget)} title="Track this head against a budget (auto-loads into Budget Planning)" className={cn("inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-2xs font-semibold transition", h.trackBudget ? "border-primary/40 bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:text-foreground")}><Target className="h-3.5 w-3.5" /> Budget</button>
                        {showBudget && cfg.budgetScope === "head" && (
                          <div className="flex items-center gap-1">
                            <input type="number" value={budgets[h.id] ?? ""} onChange={(e) => setBudgets((b) => ({ ...b, [h.id]: n(e.target.value) }))} placeholder="Budget" className="h-8 w-24 rounded-md border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" />
                            {actuals[h.id] != null && <span className={cn("w-20 text-right text-2xs font-medium", (budgets[h.id] ?? 0) - (actuals[h.id] ?? 0) < 0 ? "text-danger" : "text-muted")} title="Spent / Remaining">{inr(actuals[h.id])}</span>}
                          </div>
                        )}
                        <Switch checked={h.active} onChange={(v) => toggleHead(h.id, v)} aria-label="active" />
                        <button onClick={() => deleteHead(h.id)} title="Delete head" className="grid h-8 w-7 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <input value={newHead[cat.id] ?? ""} onChange={(e) => setNewHead((s) => ({ ...s, [cat.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { addHead(newHead[cat.id] ?? "", cat.id); setNewHead((s) => ({ ...s, [cat.id]: "" })); } }} placeholder="Add expense head…" className="h-8 flex-1 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none" />
                      <button onClick={() => { addHead(newHead[cat.id] ?? "", cat.id); setNewHead((s) => ({ ...s, [cat.id]: "" })); }} className="inline-flex h-8 items-center gap-1 rounded-md border border-primary/40 bg-primary-subtle px-2 text-2xs font-semibold text-primary hover:bg-primary hover:text-white"><Plus className="h-3.5 w-3.5" /> Head</button>
                    </div>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p className="py-2 text-2xs text-muted">No categories yet. Add one below.</p>}
              <div className="flex items-center gap-2 border-t border-border pt-3">
                <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addHead(newCat, null); setNewCat(""); } }} placeholder="Add expense category…" className="h-9 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none" />
                <Button size="sm" onClick={() => { addHead(newCat, null); setNewCat(""); }}><Plus className="h-3.5 w-3.5" /> Category</Button>
              </div>
            </div>
          </SectionCard>

          <aside className="space-y-4">
            {/* Budget */}
            <SectionCard icon={Target} title="Budget Tracking">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"><span><span className="block text-sm font-medium text-foreground">Track expenses against budget</span><span className="text-2xs text-muted">Compare actual spend to a budget.</span></span><Switch checked={cfg.budgetEnabled} onChange={(v) => setCfg({ ...cfg, budgetEnabled: v })} aria-label="budget" /></label>
              {cfg.budgetEnabled && (
                <div className="mt-3">
                  <label className="mb-1 block text-2xs font-semibold text-muted">Budget Scope</label>
                  <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
                    {([["all", "All heads (overall)"], ["head", "Head-wise"]] as const).map(([v, lbl]) => <button key={v} onClick={() => setCfg({ ...cfg, budgetScope: v })} className={cn("px-3 py-1.5 font-semibold transition", cfg.budgetScope === v ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>)}
                  </div>
                  {cfg.budgetScope === "head" && <p className="mt-2 text-2xs text-muted">Enter the budget against each head in the list on the left.</p>}
                </div>
              )}
            </SectionCard>

            {/* Party source */}
            <SectionCard icon={Users} title="Expense Party Source">
              <p className="mb-2 text-2xs text-muted">Where the payee list is drawn from (all stored in the Supplier master, categorised).</p>
              <div className="space-y-1.5">
                {([["both", "Supplier master + Expense parties"], ["supplier", "Supplier master only"], ["expense", "Expense parties only"]] as const).map(([v, lbl]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"><input type="radio" name="partysrc" checked={cfg.partySource === v} onChange={() => setCfg({ ...cfg, partySource: v })} className="accent-[var(--primary)]" /> {lbl}</label>
                ))}
              </div>
            </SectionCard>

            {/* Voucher number */}
            <SectionCard icon={Receipt} title="GST on Expenses">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"><span><span className="block text-sm font-medium text-foreground">GST-based expense applicable</span><span className="text-2xs text-muted">Capture HSN/SAC, GST % &amp; taxable amount per line; posts Input GST.</span></span><Switch checked={cfg.gstEnabled} onChange={(v) => setCfg({ ...cfg, gstEnabled: v })} aria-label="gst" /></label>
            </SectionCard>

            <SectionCard icon={Hash} title="Voucher Number Series">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Prefix</label><input value={cfg.voucherPrefix} onChange={(e) => setCfg({ ...cfg, voucherPrefix: e.target.value })} className={inp} /></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Separator</label><input value={cfg.voucherSeparator} onChange={(e) => setCfg({ ...cfg, voucherSeparator: e.target.value })} maxLength={3} className={inp} /></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Number Padding</label><input type="number" min={1} max={8} value={cfg.voucherPadding} onChange={(e) => setCfg({ ...cfg, voucherPadding: n(e.target.value) })} className={inp} /></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Reset Sequence</label><select value={cfg.voucherResetFrequency} onChange={(e) => setCfg({ ...cfg, voucherResetFrequency: e.target.value })} className={inp}>{RESET_FREQ.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
              </div>
              <div className="mt-3 space-y-2">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"><span className="font-medium text-foreground">Include Year / FY in number</span><Switch checked={cfg.voucherIncludeYear} onChange={(v) => setCfg({ ...cfg, voucherIncludeYear: v })} aria-label="year" /></label>
                {cfg.voucherIncludeYear && <div><label className="mb-1 block text-2xs font-semibold text-muted">Year Format</label><select value={cfg.voucherYearFormat} onChange={(e) => setCfg({ ...cfg, voucherYearFormat: e.target.value })} className={inp}>{YEAR_FORMATS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>}
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"><span className="font-medium text-foreground">Include Month in number</span><Switch checked={cfg.voucherIncludeMonth} onChange={(v) => setCfg({ ...cfg, voucherIncludeMonth: v })} aria-label="month" /></label>
              </div>
              <div className="mt-3"><label className="mb-1 block text-2xs font-semibold text-muted">Next No. (preview)</label><input readOnly value={voucherPreview} className={cn(inp, "bg-surface-2 font-mono text-primary")} /></div>
            </SectionCard>
          </aside>
        </div>
      )}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
