"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Coins, ArrowLeft, Save, CheckCircle2, Plus, Trash2, User, Wallet, X, Search, FileText, Calculator, Paperclip, Target, Building2, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import { BankPicker, emptyBank } from "@/components/finance/BankPicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { linkedFeatureHref, linkedFeatureLabel, type ExpenseHeadDto as Head } from "@/lib/contracts/finance";
import type { BudgetUsageDto } from "@/lib/contracts/budget";
import type { CentreOption } from "@/lib/contracts/costCentre";

interface Party { id: number; name: string; phone: string; category?: string }
interface Line { headId: string; description: string; hsn: string; gstPct: string; taxable: string; amount: string }
interface Pay { mode: string; amount: string; reference: string }
const EMPTY_LINE: Line = { headId: "", description: "", hsn: "", gstPct: "", taxable: "", amount: "" };
const n = (v: unknown) => Number(v) || 0;
const inr = (x: number) => formatMoney(x || 0);
const today = () => new Date().toISOString().slice(0, 10);
const MODES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"];
const PAYEE_TYPES = ["Supplier", "Vendor", "Employee"];

export function PettyCashForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aiDraftId = searchParams.get("aiDraft"); // one-click prefill from an AI Command Center draft
  const aiPrefilled = useRef(false);
  const [aiBanner, setAiBanner] = useState(false);
  const [heads, setHeads] = useState<Head[]>([]);
  const [budgets, setBudgets] = useState<Record<number, number>>({});
  const [actuals, setActuals] = useState<Record<number, number>>({});
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [budgetScope, setBudgetScope] = useState("all");
  const [budgetUsage, setBudgetUsage] = useState<Record<number, BudgetUsageDto>>({}); // Budget Planning: per-head period budget/used/balance
  const [gstCfg, setGstCfg] = useState(false);
  const [gstOn, setGstOn] = useState(false);

  const [payeeType, setPayeeType] = useState("Supplier");
  const [party, setParty] = useState<Party | null>(null);
  const [partyQuery, setPartyQuery] = useState("");
  const [partyHits, setPartyHits] = useState<Party[]>([]);
  // Payee advances available to apply against this expense (Advance Management).
  const [avail, setAvail] = useState<{ id: number; advanceNo: string; advanceDate: string; advanceTypeName: string; balance: number }[]>([]);
  const [advAdj, setAdvAdj] = useState<Record<number, string>>({});
  const [addingParty, setAddingParty] = useState(false);
  const [newParty, setNewParty] = useState({ name: "", phone: "" });

  // Financial dimensions (Cost Centre / Profit Centre) captured on the journal.
  const [dims, setDims] = useState<{ costCentres: CentreOption[]; profitCentres: CentreOption[] }>({ costCentres: [], profitCentres: [] });
  const [costCenterId, setCostCenterId] = useState("");
  const [profitCenterId, setProfitCenterId] = useState("");
  const [department, setDepartment] = useState("");
  const [project, setProject] = useState("");

  const [voucherDate, setVoucherDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  // A head flagged with a Linked Feature has its own dedicated entry screen —
  // picking it here is blocked (this generic line would lose that feature's
  // structured data, e.g. vehicle/odometer for Fuel Purchase) and the user is
  // redirected to that screen instead.
  const [blockedFeature, setBlockedFeature] = useState<{ label: string; href: string } | null>(null);
  const [payments, setPayments] = useState<Pay[]>([{ mode: "Cash", amount: "", reference: "" }]);
  const [bank, setBank] = useState(emptyBank);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Enterprise Expense — Petty vs Business, posting type, GST/TDS/TCS + invoice details.
  const [expenseType, setExpenseType] = useState<"petty" | "business">("petty");
  const [postingType, setPostingType] = useState<"ap" | "paynow">("ap");
  const [biz, setBiz] = useState({ invoiceNo: "", invoiceDate: "", dueDate: "", supplierGstin: "", tdsSection: "", tdsRate: "", tcsRate: "", reverseCharge: false });
  const business = expenseType === "business";
  const setBizF = (k: string, v: string | boolean) => setBiz((b) => ({ ...b, [k]: v }));
  const [attachments, setAttachments] = useState<{ fileName: string; fileUrl: string; fileType?: string | null; size?: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  async function upload(files: FileList | null) {
    if (!files?.length) return; setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f);
      const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
      if (j?.ok) setAttachments((a) => [...a, j.file]); else setError(j?.message || "Upload failed.");
    }
    setUploading(false);
  }

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/finance/petty-cash/config", { cache: "no-store" }).then((r) => r.json());
        if (j.ok) { setHeads(j.heads); setBudgets(j.budgets ?? {}); setActuals(j.actuals ?? {}); setBudgetEnabled(j.config.budgetEnabled); setBudgetScope(j.config.budgetScope); setGstCfg(j.config.gstEnabled); setGstOn(j.config.gstEnabled); }
      } catch { /* */ }
    })();
    (async () => {
      try {
        const j = await fetch("/api/finance/dimensions", { cache: "no-store" }).then((r) => r.json());
        if (j.ok) setDims({ costCentres: j.costCentres ?? [], profitCentres: j.profitCentres ?? [] });
      } catch { /* */ }
    })();
  }, []);

  // One-click prefill from an AI Command Center draft (?aiDraft=<id>). The AI prepared
  // the values; the user reviews here and Saves — the real validation/posting happens
  // on THIS screen, never from the AI. Runs once, after the expense heads have loaded.
  useEffect(() => {
    if (!aiDraftId || heads.length === 0 || aiPrefilled.current) return;
    aiPrefilled.current = true;
    (async () => {
      const j = await fetch(`/api/ai/drafts?id=${aiDraftId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (!j?.ok || !j.draft?.values) return;
      const v = j.draft.values as Record<string, string>;
      const gstYes = /^y/i.test(v.gst || "");
      if (gstCfg && gstYes) setGstOn(true);
      if (v.party) { setPayeeType("Supplier"); setParty({ id: 0, name: v.party, phone: "" }); }
      const match = heads.find((h) => h.parentId != null && h.active && h.name.toLowerCase() === String(v.head || "").toLowerCase());
      setLines([{ ...EMPTY_LINE, headId: match ? String(match.id) : "", description: match ? "" : v.head || "", ...(gstYes ? { taxable: v.amount || "", gstPct: "18" } : { amount: v.amount || "" }) }]);
      setAiBanner(true);
    })();
  }, [aiDraftId, heads, gstCfg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Budget Planning: fetch the current-period budget snapshot for each selected head
  // (refetches when the head set or the voucher date changes).
  const selectedHeadKey = lines.map((l) => l.headId).filter(Boolean).join(",");
  useEffect(() => {
    const ids = [...new Set(lines.map((l) => Number(l.headId)).filter(Boolean))];
    if (!ids.length) { setBudgetUsage({}); return; }
    let active = true;
    (async () => {
      const entries = await Promise.all(ids.map(async (id) => {
        const j = await fetch(`/api/finance/budget/usage?headId=${id}&date=${voucherDate}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
        return [id, j?.usage as BudgetUsageDto | undefined] as const;
      }));
      if (!active) return;
      const map: Record<number, BudgetUsageDto> = {};
      for (const [id, u] of entries) if (u) map[id] = u;
      setBudgetUsage(map);
    })();
    return () => { active = false; };
  }, [voucherDate, selectedHeadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!partyQuery.trim() || party) { setPartyHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => { try { const j = await fetch(`/api/masters/suppliers?category=${encodeURIComponent(payeeType)}&q=${encodeURIComponent(partyQuery)}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()); if (j.ok) setPartyHits(j.suppliers); } catch { /* */ } }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [partyQuery, payeeType, party]);

  // Fetch the payee's open (paid) advances when a master party is selected.
  useEffect(() => {
    if (!party?.id || party.id <= 0) { setAvail([]); setAdvAdj({}); return; }
    fetch(`/api/finance/advance/available?partyType=${encodeURIComponent(payeeType)}&partyId=${party.id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setAvail(j.rows); }).catch(() => {});
  }, [party?.id, payeeType]);

  const categories = useMemo(() => heads.filter((h) => h.parentId == null), [heads]);
  const leafHeads = useMemo(() => heads.filter((h) => h.parentId != null && h.active), [heads]);
  const headName = (id: string) => heads.find((h) => h.id === Number(id))?.name ?? "";

  const setLine = (i: number, patch: Partial<Line>) => setLines((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addLine = () => setLines((c) => [...c, { ...EMPTY_LINE }]);
  const removeLine = (i: number) => setLines((c) => (c.length > 1 ? c.filter((_, j) => j !== i) : c));

  // Per-line: GST mode → gross = taxable + (taxable × gst%); else the entered amount.
  const lineTax = (l: Line) => (gstOn ? +(n(l.taxable) * n(l.gstPct) / 100).toFixed(2) : 0);
  const lineGross = (l: Line) => (gstOn ? +(n(l.taxable) + lineTax(l)).toFixed(2) : n(l.amount));
  const total = useMemo(() => +lines.reduce((s, l) => s + lineGross(l), 0).toFixed(2), [lines, gstOn]);
  const taxableTotal = useMemo(() => +lines.reduce((s, l) => s + (gstOn ? n(l.taxable) : 0), 0).toFixed(2), [lines, gstOn]);
  const taxTotal = useMemo(() => +lines.reduce((s, l) => s + lineTax(l), 0).toFixed(2), [lines, gstOn]);
  const cgst = +(taxTotal / 2).toFixed(2); const sgst = +(taxTotal - cgst).toFixed(2);

  // Business Expense — TDS (deducted by us, on value excl GST), TCS (charged by supplier), net payable.
  const tdsBase = gstOn ? taxableTotal : total;
  const tdsAmt = business && n(biz.tdsRate) ? +(tdsBase * n(biz.tdsRate) / 100).toFixed(2) : 0;
  const tcsAmt = business && n(biz.tcsRate) ? +(total * n(biz.tcsRate) / 100).toFixed(2) : 0;
  const netPayable = business ? +(total + tcsAmt - tdsAmt).toFixed(2) : total;
  const isAp = business && postingType === "ap";
  // Payee advances applied reduce the amount owed now (Cr the advance asset).
  const advanceTotal = +Object.entries(advAdj).reduce((s, [id, v]) => { const a = avail.find((x) => x.id === Number(id)); return s + Math.min(n(v), a?.balance ?? 0); }, 0).toFixed(2);
  const due = isAp ? 0 : +(netPayable - advanceTotal).toFixed(2); // amount to tender now

  const setPay = (i: number, patch: Partial<Pay>) => setPayments((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addPay = () => setPayments((c) => [...c, { mode: "Bank Transfer", amount: "", reference: "" }]);
  const removePay = (i: number) => setPayments((c) => (c.length > 1 ? c.filter((_, j) => j !== i) : c));
  const tendered = useMemo(() => +payments.reduce((s, p) => s + n(p.amount), 0).toFixed(2), [payments]);
  const payDiff = +(due - tendered).toFixed(2);
  useEffect(() => { setPayments((p) => (p.length === 1 ? [{ ...p[0], amount: due > 0 ? String(due) : "" }] : p)); }, [due]);

  // Remaining budget for a head after this voucher's lines.
  function remaining(headId: string): number | null {
    const id = Number(headId); if (!budgetEnabled || budgetScope !== "head" || !id || budgets[id] == null) return null;
    const thisVoucher = lines.filter((l) => Number(l.headId) === id).reduce((s, l) => s + lineGross(l), 0);
    return +(budgets[id] - (actuals[id] ?? 0) - thisVoucher).toFixed(2);
  }

  async function saveParty() {
    if (!newParty.name.trim()) return;
    const j = await fetch("/api/masters/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newParty.name, phone: newParty.phone, category: payeeType }) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setParty(j.supplier); setAddingParty(false); setNewParty({ name: "", phone: "" }); }
  }

  async function save() {
    setError("");
    const validLines = lines.filter((l) => lineGross(l) > 0);
    if (!validLines.length) { setError("Add at least one expense head with an amount."); return; }
    if (business && !party) { setError("Select a supplier / vendor for a business expense."); return; }
    if (!isAp && Math.abs(payDiff) > 0.01) { setError(`Payments (${inr(tendered)}) must equal the amount payable (${inr(due)}).`); return; }
    setBusy(true);
    const payload = {
      voucherDate, payeeType, payeeId: party?.id, payeeName: party?.name, notes, gstApplicable: gstOn,
      expenseType, attachments,
      advanceAdjustments: avail.map((a) => ({ advanceId: a.id, amount: Math.min(n(advAdj[a.id]), a.balance) })).filter((x) => x.amount > 0),
      costCenterId: costCenterId ? Number(costCenterId) : null, profitCenterId: profitCenterId ? Number(profitCenterId) : null, department: department || undefined, project: project || undefined,
      ...(business ? { postingType, invoiceNo: biz.invoiceNo, invoiceDate: biz.invoiceDate, dueDate: biz.dueDate, supplierGstin: biz.supplierGstin, reverseCharge: biz.reverseCharge, tdsSection: biz.tdsSection, tdsRate: n(biz.tdsRate), tcsRate: n(biz.tcsRate) } : {}),
      lines: validLines.map((l) => (gstOn
        ? { headId: l.headId ? Number(l.headId) : null, headName: headName(l.headId), description: l.description, hsn: l.hsn, gstPct: n(l.gstPct), taxable: n(l.taxable) }
        : { headId: l.headId ? Number(l.headId) : null, headName: headName(l.headId), description: l.description, amount: n(l.amount) })),
      payments: isAp ? [] : payments.filter((p) => n(p.amount) > 0).map((p) => ({ mode: p.mode, amount: n(p.amount), reference: p.reference })),
      bankId: bank.bankId, bankName: bank.bankName, bankAccount: bank.bankAccount,
    };
    try {
      const res = await fetch("/api/finance/petty-cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.message || "Could not save."); setBusy(false); return; }
      // Close the loop: mark the originating AI draft as handed off (the AI never posted).
      if (aiDraftId) await fetch("/api/ai/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", id: Number(aiDraftId) }) }).catch(() => {});
      router.push(`/finance/petty-cash/${j.id}`);
    } catch { setError("Network error."); setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {aiBanner && <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-subtle/30 px-4 py-2.5 text-sm font-medium text-primary">✨ Prefilled from your AI Copilot draft — review the details below and <b>Save</b> to create the voucher. (The AI never posts; you confirm here.)</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance/petty-cash" className="hover:text-foreground">Expense</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Coins className="h-5 w-5 text-primary" /> New {business ? "Business" : "Petty"} Expense Voucher</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/finance/petty-cash"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Voucher"}</Button>
        </div>
      </div>

      <SectionCard icon={Coins} title="Expense Type">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-md border border-border text-sm">
            {(["petty", "business"] as const).map((v) => <button key={v} onClick={() => { setExpenseType(v); if (v === "business") setGstOn(true); }} className={cn("px-4 py-1.5 font-semibold transition", expenseType === v ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{v === "petty" ? "Petty Expense" : "Business Expense"}</button>)}
          </div>
          {business && <div className="flex items-center gap-2"><span className="text-2xs font-semibold text-muted">Posting Type:</span><div className="inline-flex overflow-hidden rounded-md border border-border text-sm">{(["ap", "paynow"] as const).map((v) => <button key={v} onClick={() => setPostingType(v)} className={cn("px-3 py-1.5 font-semibold transition", postingType === v ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{v === "ap" ? "Post to Accounts Payable" : "Pay Now"}</button>)}</div></div>}
          <span className="text-2xs text-muted">{business ? (isAp ? "Creates a supplier outstanding (payable) — settle later from Finance › Payables." : "Books the expense and pays immediately (net of TDS).") : "Simple cash expense — GST / TDS / TCS & payables are hidden."}</span>
        </div>
      </SectionCard>

      {business && (
        <SectionCard icon={FileText} title="Invoice & Tax Details">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className={lbl}>Invoice Number</label><input value={biz.invoiceNo} onChange={(e) => setBizF("invoiceNo", e.target.value)} className={inp} placeholder="INV-0001" /></div>
            <div><label className={lbl}>Invoice Date</label><input type="date" value={biz.invoiceDate} onChange={(e) => setBizF("invoiceDate", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Due Date</label><input type="date" value={biz.dueDate} onChange={(e) => setBizF("dueDate", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Supplier GSTIN</label><input value={biz.supplierGstin} onChange={(e) => setBizF("supplierGstin", e.target.value)} className={inp} placeholder="29ABCDE1234F1Z5" /></div>
            <div><label className={lbl}>TDS Section</label><input value={biz.tdsSection} onChange={(e) => setBizF("tdsSection", e.target.value)} className={inp} placeholder="194C / 194J / 194I" /></div>
            <div><label className={lbl}>TDS Rate %</label><input type="number" value={biz.tdsRate} onChange={(e) => setBizF("tdsRate", e.target.value)} className={inp} placeholder="0" /></div>
            <div><label className={lbl}>TCS Rate % (by supplier)</label><input type="number" value={biz.tcsRate} onChange={(e) => setBizF("tcsRate", e.target.value)} className={inp} placeholder="0" /></div>
            <label className="flex items-end gap-2 pb-2 text-xs font-medium text-foreground"><input type="checkbox" checked={biz.reverseCharge} onChange={(e) => setBizF("reverseCharge", e.target.checked)} className="h-4 w-4 accent-primary" /> Reverse Charge (RCM)</label>
          </div>
        </SectionCard>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          {/* Payee */}
          <SectionCard icon={User} title="Payee" allowOverflow action={party && <button onClick={() => setParty(null)} className="text-2xs font-semibold text-danger hover:underline">Change</button>}>
            <div className="mb-3 inline-flex overflow-hidden rounded-md border border-border text-xs">
              {PAYEE_TYPES.map((t) => <button key={t} onClick={() => { setPayeeType(t); setParty(null); }} className={cn("px-3 py-1.5 font-semibold transition", payeeType === t ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{t}</button>)}
            </div>
            {party ? (
              <div className="rounded-lg bg-primary-subtle/40 px-3 py-2 text-sm"><span className="font-semibold text-foreground">{party.name}</span>{party.phone ? <span className="text-2xs text-muted"> · {party.phone}</span> : ""}</div>
            ) : (
              <div className="relative max-w-md">
                <div className="flex gap-2">
                  <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={partyQuery} onChange={(e) => setPartyQuery(e.target.value)} placeholder={`Search ${payeeType.toLowerCase()} by name / phone…`} className="h-9 w-full rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm focus:border-primary focus:outline-none" /></div>
                  <Button size="sm" variant="outline" onClick={() => { setNewParty({ name: partyQuery, phone: "" }); setAddingParty(true); }}><Plus className="h-3.5 w-3.5" /> New</Button>
                </div>
                {partyQuery && partyHits.length > 0 && <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl">{partyHits.map((c) => <button key={c.id} onClick={() => { setParty(c); setPartyQuery(""); }} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{c.name}</span><span className="text-2xs text-subtle">{c.phone}</span></button>)}</div>}
                {addingParty && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary-subtle/20 p-2.5">
                    <input value={newParty.name} onChange={(e) => setNewParty({ ...newParty, name: e.target.value })} placeholder={`${payeeType} name *`} className="h-8 flex-1 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none" />
                    <input value={newParty.phone} onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })} placeholder="Phone" className="h-8 w-28 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none" />
                    <Button size="sm" onClick={saveParty} disabled={!newParty.name.trim()}>Save</Button>
                    <button onClick={() => setAddingParty(false)} className="text-muted hover:text-danger"><X className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {party && (party.id ?? 0) > 0 && avail.length > 0 && (
            <SectionCard icon={HandCoins} title={<>Apply {payeeType} Advance <span className="text-2xs font-normal text-muted">({avail.length})</span></>}>
              <div className="space-y-2">
                {avail.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm">
                    <div className="min-w-0"><span className="font-mono text-xs font-semibold text-primary">{a.advanceNo}</span><span className="block text-2xs text-subtle">{a.advanceTypeName} · Balance {inr(a.balance)}</span></div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={advAdj[a.id] ?? ""} onChange={(e) => setAdvAdj((p) => ({ ...p, [a.id]: e.target.value }))} placeholder="0.00" className="h-8 w-24 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" />
                      <button type="button" onClick={() => setAdvAdj((p) => ({ ...p, [a.id]: String(Math.max(0, Math.min(a.balance, netPayable - advanceTotal + Math.min(n(advAdj[a.id]), a.balance)))) }))} className="rounded border border-border bg-surface px-2 py-1 text-2xs font-semibold text-primary hover:border-primary">Max</button>
                    </div>
                  </div>
                ))}
                {advanceTotal > 0 && <div className="flex items-center justify-between pt-1 text-sm font-semibold"><span className="text-foreground">Advance Applied</span><span className="text-success">− {inr(advanceTotal)}</span></div>}
              </div>
              <p className="mt-1.5 text-2xs text-subtle">Reduces the amount to pay now &amp; auto-posts a settlement against the advance.</p>
            </SectionCard>
          )}

          {/* Financial dimensions — Cost Centre / Profit Centre / Department / Project */}
          {(dims.costCentres.length > 0 || dims.profitCentres.length > 0) && (
            <SectionCard icon={Building2} title="Cost / Profit Centre" action={<span className="text-2xs text-subtle">Optional · captured on the journal</span>}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><label className={lbl}>Cost Centre</label><select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} className={inp}><option value="">— None —</option>{dims.costCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></div>
                <div><label className={lbl}>Profit Centre</label><select value={profitCenterId} onChange={(e) => setProfitCenterId(e.target.value)} className={inp}><option value="">— None —</option>{dims.profitCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></div>
                <div><label className={lbl}>Department</label><input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Optional" className={inp} /></div>
                <div><label className={lbl}>Project</label><input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Optional" className={inp} /></div>
              </div>
            </SectionCard>
          )}

          {/* Expense heads */}
          <SectionCard icon={Coins} title="Expense Heads" bodyClass=""
            action={
              <div className="flex items-center gap-2">
                {gstCfg && (
                  <span className="flex items-center gap-1 text-2xs"><span className="font-medium text-muted">GST:</span><div className="inline-flex overflow-hidden rounded-md border border-border">{([["yes", "Yes"], ["no", "No"]] as const).map(([v, lbl]) => <button key={v} onClick={() => setGstOn(v === "yes")} className={cn("px-2 py-0.5 font-semibold transition", (gstOn ? "yes" : "no") === v ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{lbl}</button>)}</div></span>
                )}
                <button onClick={addLine} className="text-2xs font-semibold text-primary hover:underline"><Plus className="mr-0.5 inline h-3.5 w-3.5" />Add head</button>
              </div>
            }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Expense Head</th><th className="px-3 py-2.5">Description</th>{gstOn && <><th className="px-3 py-2.5">HSN/SAC</th><th className="px-3 py-2.5 text-right">GST%</th><th className="px-3 py-2.5 text-right">Taxable</th><th className="px-3 py-2.5 text-right">Tax</th></>}<th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5" /></tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const rem = remaining(l.headId);
                    const bu = budgetUsage[Number(l.headId)];
                    const thisVoucherForHead = lines.filter((x) => x.headId === l.headId).reduce((s, x) => s + lineGross(x), 0);
                    const projBal = bu?.hasBudget ? +(bu.balance - thisVoucherForHead).toFixed(2) : null;
                    return (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <select
                          value={l.headId}
                          onChange={(e) => {
                            const picked = heads.find((h) => h.id === Number(e.target.value));
                            if (picked?.linkedFeature) {
                              const href = linkedFeatureHref(picked.linkedFeature);
                              if (href) { setBlockedFeature({ label: linkedFeatureLabel(picked.linkedFeature) ?? picked.name, href }); return; }
                            }
                            setLine(i, { headId: e.target.value });
                          }}
                          className="h-9 w-full min-w-[150px] rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none"
                        >
                          <option value="">Select head…</option>
                          {categories.map((cat) => { const hs = leafHeads.filter((h) => h.parentId === cat.id); return hs.length ? <optgroup key={cat.id} label={cat.name}>{hs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</optgroup> : null; })}
                        </select>
                        {l.headId && (
                          bu?.hasBudget ? (
                            <div className="mt-1 rounded-md border border-primary/25 bg-primary-subtle/25 px-2 py-1 text-2xs leading-tight">
                              <div className="flex items-center gap-1 font-semibold text-primary"><Target className="h-3 w-3" /> Budget · {bu.periodLabel}{bu.control !== "warning" ? ` · ${bu.control === "stop" ? "Stop" : "Approval"}` : ""}</div>
                              <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-muted">
                                <span>Budget <b className="text-foreground">{inr(bu.budget)}</b></span>
                                <span>Used <b className="text-foreground">{inr(bu.utilized)}</b></span>
                                {bu.committed > 0 && <span>Committed <b className="text-foreground">{inr(bu.committed)}</b></span>}
                                <span className={cn(projBal != null && projBal < 0 ? "font-semibold text-danger" : "text-success")}>Balance <b>{inr(projBal ?? bu.balance)}</b>{projBal != null && projBal < 0 ? " (over)" : ""}</span>
                              </div>
                            </div>
                          ) : rem != null ? (
                            <div className={cn("mt-0.5 text-2xs", rem < 0 ? "font-semibold text-danger" : "text-muted")}>Budget left: {inr(rem)}{rem < 0 ? " (over)" : ""}</div>
                          ) : bu ? (
                            <div className="mt-0.5 flex items-center gap-1 text-2xs text-subtle"><Target className="h-3 w-3" /> No active budget for this head. <Link href="/finance/budget" className="font-medium text-primary hover:underline">Plan budget</Link></div>
                          ) : (
                            <div className="mt-0.5 text-2xs text-subtle">Checking budget…</div>
                          )
                        )}
                      </td>
                      <td className="px-3 py-2"><input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Optional" className="h-9 w-full min-w-[120px] rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none" /></td>
                      {gstOn && <>
                        <td className="px-3 py-2"><input value={l.hsn} onChange={(e) => setLine(i, { hsn: e.target.value })} placeholder="HSN/SAC" className="h-9 w-24 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="px-3 py-2 text-right"><input type="number" value={l.gstPct} onChange={(e) => setLine(i, { gstPct: e.target.value })} placeholder="0" className="h-9 w-16 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="px-3 py-2 text-right"><input type="number" value={l.taxable} onChange={(e) => setLine(i, { taxable: e.target.value })} placeholder="0.00" className="h-9 w-24 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{inr(lineTax(l))}</td>
                      </>}
                      <td className="px-3 py-2 text-right">{gstOn ? <span className="font-semibold tabular-nums text-foreground">{inr(lineGross(l))}</span> : <input type="number" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder="0.00" className="h-9 w-28 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" />}</td>
                      <td className="px-3 py-2 text-right">{lines.length > 1 && <button onClick={() => removeLine(i)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button>}</td>
                    </tr>
                  );})}
                </tbody>
                <tfoot><tr className="border-t-2 border-border bg-surface-2 font-bold text-foreground"><td className="px-3 py-2.5" colSpan={gstOn ? 6 : 2}>Total</td><td className="px-3 py-2.5 text-right tabular-nums">{inr(total)}</td><td /></tr></tfoot>
              </table>
            </div>
          </SectionCard>

          {/* Attachments — invoice / receipt / GST invoice / agreement (PDF, image, Excel). */}
          <SectionCard icon={Paperclip} title="Attachments" action={<label className="cursor-pointer text-2xs font-semibold text-primary hover:underline"><Plus className="mr-0.5 inline h-3.5 w-3.5" />{uploading ? "Uploading…" : "Add file"}<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label>}>
            {attachments.length === 0 ? <p className="py-2 text-2xs text-muted">Attach invoice, receipt, GST invoice, quotation or agreement (PDF / image / Excel).</p> : (
              <div className="space-y-1.5">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-1.5">
                    <a href={a.fileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-foreground hover:text-primary"><FileText className="h-4 w-4 shrink-0 text-muted" /><span className="truncate">{a.fileName}</span>{a.size ? <span className="shrink-0 text-2xs text-subtle">{(a.size / 1024).toFixed(0)} KB</span> : null}</a>
                    <button onClick={() => setAttachments((c) => c.filter((_, j) => j !== i))} className="shrink-0 text-muted hover:text-danger"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <aside>
          <SectionCard icon={Wallet} title="Payment">
            <div className="space-y-3">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Voucher Date</label><input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className={inp} /></div>
              {!isAp ? (
                <div>
                  <div className="mb-1 flex items-center justify-between"><label className="block text-2xs font-semibold text-muted">Payment Mode(s)</label><button onClick={addPay} className="text-2xs font-semibold text-primary hover:underline">+ Split</button></div>
                  <div className="space-y-2">
                    {payments.map((p, i) => (
                      <div key={i} className="rounded-lg border border-border bg-surface-2/40 p-2">
                        <div className="flex items-center gap-1.5">
                          <select value={p.mode} onChange={(e) => setPay(i, { mode: e.target.value })} className="h-8 w-28 shrink-0 rounded-md border border-border-strong bg-surface px-2 text-xs focus:border-primary focus:outline-none">{MODES.map((m) => <option key={m}>{m}</option>)}</select>
                          <input type="number" value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value })} placeholder="Amount" className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" />
                          {payments.length > 1 && <button onClick={() => removePay(i)} className="grid h-8 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><X className="h-3.5 w-3.5" /></button>}
                        </div>
                        <input value={p.reference} onChange={(e) => setPay(i, { reference: e.target.value })} placeholder="Reference / UTR / cheque no." className="mt-1.5 h-8 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none" />
                      </div>
                    ))}
                  </div>
                  {due > 0 && <div className="mt-1 flex items-center justify-between text-2xs"><span className="text-muted">Tendered {inr(tendered)}</span>{Math.abs(payDiff) > 0.01 ? <span className="font-semibold text-danger">{payDiff > 0 ? `${inr(payDiff)} short` : `${inr(-payDiff)} over`}</span> : <span className="font-semibold text-success">matches ✓</span>}</div>}
                  <div className="mt-2"><BankPicker mode={payments.find((p) => !p.mode.toLowerCase().includes("cash"))?.mode} value={bank} onChange={setBank} required /></div>
                </div>
              ) : (
                <div className="rounded-lg border border-info/30 bg-info-subtle/40 p-3 text-2xs text-info">Post to Accounts Payable — no payment now. A <strong>supplier outstanding of {inr(netPayable)}</strong> will be created{biz.dueDate ? ` · due ${biz.dueDate}` : ""}. Settle later in Finance › Payables.</div>
              )}
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" className={cn(inp, "h-auto py-2")} /></div>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              {gstOn && (<div className="space-y-1 text-sm"><Row k="Taxable Value" v={inr(taxableTotal)} /><Row k="CGST" v={inr(cgst)} /><Row k="SGST" v={inr(sgst)} /></div>)}
              <div className={cn("flex items-center justify-between", business ? "text-sm" : "text-lg font-bold text-foreground")}><span>{business ? "Invoice Total" : "Total"}</span><span className={business ? "tabular-nums text-foreground" : ""}>{inr(total)}</span></div>
              {business && <div className="mt-1 space-y-1 text-sm">
                {tcsAmt > 0 && <Row k={`TCS (${biz.tcsRate}%)`} v={`+ ${inr(tcsAmt)}`} />}
                {tdsAmt > 0 && <Row k={`TDS (${biz.tdsRate}%)`} v={`− ${inr(tdsAmt)}`} />}
                <div className="my-1 h-px bg-border" />
                <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>{isAp ? "Payable" : "Net Payable"}</span><span>{inr(netPayable)}</span></div>
              </div>}
            </div>
            <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-2xs font-bold text-foreground"><Calculator className="h-3.5 w-3.5 text-primary" /> Accounting Preview</div>
              <div className="space-y-0.5 text-2xs">
                {([{ a: "Indirect Expenses", dr: gstOn ? taxableTotal : total, cr: 0 }, { a: "Input GST (ITC)", dr: gstOn ? taxTotal : 0, cr: 0 }, { a: "TCS Receivable", dr: tcsAmt, cr: 0 }, { a: "TDS Payable", dr: 0, cr: tdsAmt }, isAp ? { a: "Supplier Payable", dr: 0, cr: netPayable } : { a: "Cash / Bank", dr: 0, cr: due }] as { a: string; dr: number; cr: number }[]).filter((x) => x.dr > 0.001 || x.cr > 0.001).map((x, i) => <div key={i} className="flex justify-between"><span className="text-muted">{x.a}</span><span className="tabular-nums text-foreground">{x.dr > 0 ? `Dr ${inr(x.dr)}` : `Cr ${inr(x.cr)}`}</span></div>)}
              </div>
            </div>
            {error && <p className="mt-2 rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{error}</p>}
            <Button size="lg" className="mt-3 w-full" onClick={save} disabled={busy || total <= 0}><CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : isAp ? `Book Expense (${inr(netPayable)})` : `Save Voucher (${inr(due)})`}</Button>
          </SectionCard>
        </aside>
      </div>

      <ConfirmDialog
        open={!!blockedFeature}
        title={`Use the ${blockedFeature?.label ?? ""} screen instead`}
        message={`This expense has its own dedicated screen — recording it here as a generic line would lose its structured details (e.g. vehicle, odometer, quantity). Go to ${blockedFeature?.label ?? "that"} to record it properly.`}
        icon={FileText}
        confirmLabel={`Go to ${blockedFeature?.label ?? "screen"}`}
        cancelLabel="Stay here"
        onCancel={() => setBlockedFeature(null)}
        onConfirm={() => { if (blockedFeature) router.push(blockedFeature.href); }}
      />
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="tabular-nums text-foreground">{v}</span></div>;
}
