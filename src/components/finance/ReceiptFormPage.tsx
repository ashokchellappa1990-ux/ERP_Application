"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText, Save, Loader2, Paperclip, Trash2, Plus, Users, ListTree, CreditCard, Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { PAYMENT_MODES, PARTY_TYPES, QUICK_ADD_PARTY_TYPES, BANK_MODES, type ReceiptDetail, type ReceiptMeta, type ReceiptCategoryRow, type ReceiptPartyRow } from "@/lib/contracts/receipt";
import { BankPicker, emptyBank, type BankValue } from "@/components/finance/BankPicker";

const API = "/api/finance/receipts";
const today = () => new Date().toISOString().slice(0, 10);
const inputCls = "h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none";
const num = (v: unknown) => Number(v) || 0;

interface Line { subHeadId?: number; headName: string; taxable: string; taxType: string; gstRate: string }

export function ReceiptFormPage({ id }: { id?: number }) {
  const router = useRouter();
  const toast = useToast();
  const [meta, setMeta] = useState<ReceiptMeta | null>(null);
  const [edit, setEdit] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const metaJ = await fetch(API, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (metaJ.ok) setMeta(metaJ.meta);
      if (id) {
        const j = await fetch(`${API}/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
        if (j.ok) { if (j.data.status !== "Draft") { toast.error("Only a draft receipt can be edited."); router.replace("/finance/receipt"); return; } setEdit(j.data); }
      }
      setLoading(false);
    })();
  }, [id, router, toast]);

  if (loading || !meta) return <div className="py-16"><AppLoader label="Loading…" /></div>;
  return <FormBody meta={meta} edit={edit} onDone={() => router.push("/finance/receipt")} />;
}

function FormBody({ meta, edit, onDone }: { meta: ReceiptMeta; edit: ReceiptDetail | null; onDone: () => void }) {
  const toast = useToast();
  const fmt = useFmt();
  const cfg = meta.config;
  const [busy, setBusy] = useState(false);

  // Party & voucher
  const [partyType, setPartyType] = useState(edit?.partyType || "");
  const [partyName, setPartyName] = useState(edit?.partyName || "");
  const [partyId, setPartyId] = useState<number | undefined>(edit?.partyId ?? undefined);
  const [partyGstin, setPartyGstin] = useState(edit?.partyGstin || "");
  const [parties, setParties] = useState<ReceiptPartyRow[]>([]);
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const canQuickAdd = QUICK_ADD_PARTY_TYPES.includes((partyType || "Other") as never);
  useEffect(() => {
    const t = partyType || "Other";
    fetch(`/api/finance/receipt-parties?type=${encodeURIComponent(t)}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setParties(j.parties); }).catch(() => {});
  }, [partyType]);
  const changePartyType = (t: string) => { setPartyType(t); setPartyName(""); setPartyId(undefined); setPartyGstin(""); };
  const pickParty = (name: string) => { setPartyName(name); const p = parties.find((x) => x.name === name); setPartyId(p?.id); setPartyGstin(p?.gstin || ""); };
  const [categoryId, setCategoryId] = useState<string>(edit?.categoryId ? String(edit.categoryId) : "");
  const [voucherDate, setVoucherDate] = useState(edit?.voucherDate || today());
  // Lines
  const [lines, setLines] = useState<Line[]>(edit?.heads?.length ? edit.heads.map((h) => ({ subHeadId: h.subHeadId ?? undefined, headName: h.headName, taxable: String(h.taxable), taxType: h.taxType || "None", gstRate: String(h.gstRate || "") })) : [{ headName: "", taxable: "", taxType: "None", gstRate: "" }]);
  // Payment & reference
  const [mode, setMode] = useState(edit?.mode || "Cash");
  const [bank, setBank] = useState<BankValue>({ ...emptyBank, bankName: edit?.bankName || "" });
  const [referenceNo, setReferenceNo] = useState(edit?.referenceNo || "");
  const [referenceDate, setReferenceDate] = useState(edit?.referenceDate || "");
  const [narration, setNarration] = useState(edit?.narration || "");
  // Accounting
  const [debitCode, setDebitCode] = useState(edit?.debitCode || "");
  const [costCenter, setCostCenter] = useState(edit?.costCenter || "");
  const [department, setDepartment] = useState(edit?.department || "");
  const [project, setProject] = useState(edit?.project || "");
  const [remarks, setRemarks] = useState(edit?.remarks || "");
  const [attachments, setAttachments] = useState<{ docType: string; fileName: string; fileUrl: string; fileType: string; size: number }[]>(edit?.attachments?.map((a) => ({ docType: a.docType, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType, size: a.size })) ?? []);

  const cat: ReceiptCategoryRow | undefined = meta.categories.find((c) => String(c.id) === categoryId);
  // Show sub-head lines whenever the selected category actually has sub-heads.
  const useSubHeads = !!cat?.subHeads.length;
  const isBank = BANK_MODES.includes(mode as never);
  const effDebit = debitCode || (isBank ? "1010" : "1000");
  const acc = (code: string) => meta.accounts.find((a) => a.code === code);

  const newLine = (sh?: ReceiptCategoryRow["subHeads"][number], fallbackName = ""): Line => sh
    ? { subHeadId: sh.id, headName: sh.name, taxable: "", taxType: sh.taxType, gstRate: sh.taxRate ? String(sh.taxRate) : "" }
    : { headName: fallbackName, taxable: "", taxType: "None", gstRate: "" };
  function pickCategory(idv: string) {
    setCategoryId(idv);
    const c = meta.categories.find((x) => String(x.id) === idv);
    setLines([c?.subHeads.length ? newLine(c.subHeads[0]) : newLine(undefined, c?.name || "")]);
  }
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, x) => (x === i ? { ...l, ...patch } : l)));
  function pickSubHead(i: number, subId: string) { const sh = cat?.subHeads.find((s) => String(s.id) === subId); if (sh) setLine(i, { subHeadId: sh.id, headName: sh.name, taxType: sh.taxType, gstRate: sh.taxRate ? String(sh.taxRate) : "" }); }

  // Per-line tax: GST→CGST+SGST (added), TCS→added, TDS→deducted. net = cash received.
  const calc = useMemo(() => {
    let taxable = 0, gst = 0, cgst = 0, sgst = 0, tds = 0, tcs = 0, net = 0;
    const rows = lines.map((l) => {
      const t = num(l.taxable), rate = num(l.gstRate), taxAmt = +(t * rate / 100).toFixed(2);
      let lc = 0, ls = 0, lt = 0, lx = 0, lg = 0, lnet = t;
      if (l.taxType === "GST") { lg = taxAmt; lc = +(taxAmt / 2).toFixed(2); ls = +(taxAmt - lc).toFixed(2); lnet = +(t + taxAmt).toFixed(2); }
      else if (l.taxType === "TCS") { lx = taxAmt; lnet = +(t + taxAmt).toFixed(2); }
      else if (l.taxType === "TDS") { lt = taxAmt; lnet = +(t - taxAmt).toFixed(2); }
      taxable += t; gst += lg; cgst += lc; sgst += ls; tds += lt; tcs += lx; net += lnet;
      return { t, rate, cgst: lc, sgst: ls, tds: lt, tcs: lx, taxAmt, net: lnet };
    });
    return { rows, taxable: +taxable.toFixed(2), gst: +gst.toFixed(2), cgst: +cgst.toFixed(2), sgst: +sgst.toFixed(2), tds: +tds.toFixed(2), tcs: +tcs.toFixed(2), total: +net.toFixed(2) };
  }, [lines]);
  const hasGst = calc.gst > 0;

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const dataUrl: string = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
      setAttachments((p) => [...p, { docType: "supporting", fileName: file.name, fileUrl: dataUrl, fileType: file.type, size: file.size }]);
    }
  }

  const canSave = !!categoryId && calc.total > 0;
  async function save() {
    if (!canSave) { toast.error("Select a category and enter at least one amount."); return; }
    setBusy(true);
    const heads = lines.filter((l) => num(l.taxable) > 0).map((l) => {
      const sh = cat?.subHeads.find((s) => s.id === l.subHeadId);
      return { subHeadId: l.subHeadId, headName: l.headName || sh?.name || cat?.name, taxable: num(l.taxable), taxType: l.taxType, gstRate: num(l.gstRate), creditCode: sh?.creditCode || cat?.creditCode, creditName: sh?.creditName || cat?.creditName };
    });
    const body = {
      voucherDate, categoryId: Number(categoryId), amount: calc.total, gstApplicable: hasGst,
      mode, bankName: isBank ? bank.bankName : undefined, bankId: isBank ? bank.bankId : undefined, bankAccount: isBank ? bank.bankAccount : undefined, partyType: partyType || undefined, partyId, partyName: partyName || undefined, partyGstin: hasGst ? partyGstin : undefined,
      referenceNo, referenceDate, narration, debitCode: effDebit, debitName: acc(effDebit)?.name, creditCode: cat?.creditCode, creditName: cat?.creditName,
      costCenter: cfg.enableCostCenter ? costCenter : undefined, department: cfg.enableDepartment ? department : undefined, project: cfg.enableProject ? project : undefined,
      remarks, heads, attachments: cfg.enableAttachment ? attachments : [],
    };
    const url = edit ? `${API}/${edit.id}` : API;
    const j = await fetch(url, { method: edit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (toast.result(j, edit ? "Receipt updated." : "Receipt created.")) onDone();
  }

  const ActionButtons = (
    <div className="flex items-center gap-2">
      <Link href="/finance/receipt"><Button variant="ghost" size="md">Cancel</Button></Link>
      <Button size="md" disabled={!canSave || busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {busy ? "Saving…" : edit ? "Update Receipt" : "Submit Receipt"}</Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><Link href="/finance/receipt" className="hover:text-foreground">Income Receipt Transaction</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{edit ? "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> {edit ? `Edit Receipt ${edit.voucherNo}` : "New Receipt"}</h1>
        </div>
        {ActionButtons}
      </div>

      {/* 1. Party & Voucher */}
      <Card icon={Users} title="Party & Voucher Details">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Party Type"><select value={partyType} onChange={(e) => changePartyType(e.target.value)} className={inputCls}>{PARTY_TYPES.map((p) => <option key={p} value={p}>{p || "—"}</option>)}</select></F>
          <F label="Party Name" hint={canQuickAdd ? "Pick or add a new party" : "Pick from master"}>
            <div className="flex gap-1.5">
              <select value={partyName} onChange={(e) => pickParty(e.target.value)} className={inputCls}>
                <option value="">Select party…</option>
                {partyName && !parties.some((p) => p.name === partyName) && <option value={partyName}>{partyName}</option>}
                {parties.map((p) => <option key={`${p.source}-${p.id}`} value={p.name}>{p.name}{p.gstin ? ` · ${p.gstin}` : ""}</option>)}
              </select>
              {canQuickAdd && <Button type="button" size="sm" variant="outline" onClick={() => setAddPartyOpen(true)} title="Add new party"><Plus className="h-3.5 w-3.5" /></Button>}
            </div>
          </F>
          {(cfg.enableGst || hasGst) && <F label="Party GSTIN"><input value={partyGstin} onChange={(e) => setPartyGstin(e.target.value.toUpperCase())} placeholder="GSTIN" className={inputCls} /></F>}
          <F label="Receipt Category" req><select value={categoryId} onChange={(e) => pickCategory(e.target.value)} className={inputCls}><option value="">Select category…</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>
          <F label="Voucher Date"><input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className={inputCls} /></F>
          <F label="Total Receipt Amount"><div className="flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-bold text-foreground">{fmt.money(calc.total)}</div></F>
        </div>
      </Card>

      {/* 2. Sub-head / amount lines */}
      <Card icon={ListTree} title={useSubHeads ? "Sub Head Details" : "Receipt Amount"} action={useSubHeads ? <button onClick={() => setLines((l) => [...l, newLine(cat?.subHeads[0])])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Add line</button> : undefined}>
        {!categoryId ? <p className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-4 text-center text-sm text-muted">Select a receipt category first.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="py-2 pr-3">{useSubHeads ? "Sub Head" : "Head"}</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3 text-center">Tax</th><th className="py-2 pr-3 text-right">Rate %</th><th className="py-2 pr-3 text-right">Tax Amount</th><th className="py-2 pr-3 text-right">Line Net</th>{useSubHeads && <th></th>}</tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const cr = calc.rows[i]; const isTds = l.taxType === "TDS";
                  return (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">{useSubHeads ? <select value={l.subHeadId ?? ""} onChange={(e) => pickSubHead(i, e.target.value)} className={inputCls}>{cat!.subHeads.map((s) => <option key={s.id} value={s.id}>{s.name}{s.taxType !== "None" ? ` (${s.taxType})` : ""}</option>)}</select> : <div className="flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm text-muted">{cat?.name}</div>}</td>
                      <td className="py-2 pr-3"><input type="number" value={l.taxable} onChange={(e) => setLine(i, { taxable: e.target.value })} placeholder="0.00" className={cn(inputCls, "w-28 text-right")} /></td>
                      <td className="py-2 pr-3 text-center">{l.taxType === "None" ? <span className="text-2xs text-subtle">—</span> : <span className={cn("rounded-full px-1.5 py-0.5 text-2xs font-semibold", l.taxType === "GST" ? "bg-info-subtle text-info" : l.taxType === "TDS" ? "bg-warning-subtle text-warning" : "bg-success-subtle text-success")}>{l.taxType}</span>}</td>
                      <td className="py-2 pr-3">{l.taxType === "None" ? <div className="text-right text-2xs text-subtle">—</div> : <input type="number" value={l.gstRate} onChange={(e) => setLine(i, { gstRate: e.target.value })} placeholder="0" className={cn(inputCls, "w-16 text-right")} />}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted">{l.taxType === "GST" ? <span title="CGST + SGST">{fmt.money(cr?.cgst || 0)} + {fmt.money(cr?.sgst || 0)}</span> : l.taxType === "None" ? "—" : `${isTds ? "-" : "+"}${fmt.money(cr?.taxAmt || 0)}`}</td>
                      <td className="py-2 pr-3 text-right font-semibold tabular-nums text-foreground">{fmt.money(cr?.net || 0)}</td>
                      {useSubHeads && <td className="py-2 text-right"><button onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, x) => x !== i) : ls)} disabled={lines.length === 1} className="text-danger hover:text-danger/70 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t border-border font-bold"><td className="py-2 pr-3 text-right">Total</td><td className="py-2 pr-3 text-right tabular-nums">{fmt.money(calc.taxable)}</td><td></td><td></td><td className="py-2 pr-3 text-right tabular-nums text-muted">{fmt.money(calc.gst + calc.tcs - calc.tds)}</td><td className="py-2 pr-3 text-right tabular-nums text-primary">{fmt.money(calc.total)}</td>{useSubHeads && <td></td>}</tr></tfoot>
            </table>
            {(calc.gst > 0 || calc.tds > 0 || calc.tcs > 0) && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                {calc.gst > 0 && <span>CGST <b className="text-foreground">{fmt.money(calc.cgst)}</b> · SGST <b className="text-foreground">{fmt.money(calc.sgst)}</b></span>}
                {calc.tds > 0 && <span>TDS receivable <b className="text-warning">{fmt.money(calc.tds)}</b></span>}
                {calc.tcs > 0 && <span>TCS payable <b className="text-success">{fmt.money(calc.tcs)}</b></span>}
                <span>Net cash <b className="text-primary">{fmt.money(calc.total)}</b></span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 3. Payment & reference */}
      <Card icon={CreditCard} title="Payment & Reference">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Receipt Mode" req><select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>{PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></F>
          {isBank && <F label="Bank"><BankPicker mode={mode} value={bank} onChange={setBank} label="" showAccount required /></F>}
          <F label="Reference No"><input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Cheque / UTR / slip" className={inputCls} /></F>
          <F label="Reference Date"><input type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} className={inputCls} /></F>
          <F label="Narration" className="lg:col-span-2"><input value={narration} onChange={(e) => setNarration(e.target.value)} className={inputCls} /></F>
        </div>
      </Card>

      {/* 4. Attachments */}
      {cfg.enableAttachment && (
        <Card icon={Paperclip} title="Attachments">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-muted hover:border-primary/40 hover:text-primary"><Paperclip className="h-3.5 w-3.5" /> Add file (receipt copy / bank advice / supporting)<input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} /></label>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">{attachments.map((a, i) => <div key={i} className="flex items-center justify-between rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs"><span className="truncate text-foreground">{a.fileName}</span><button onClick={() => setAttachments((p) => p.filter((_, x) => x !== i))} className="text-danger hover:text-danger/70"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
        </Card>
      )}

      {/* 5. Account posting */}
      <Card icon={Calculator} title="Account Posting">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Debit Account (Cash / Bank)"><select value={effDebit} onChange={(e) => setDebitCode(e.target.value)} className={inputCls}>{meta.accounts.filter((a) => a.type === "Asset").map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></F>
          {cfg.enableCostCenter && <F label="Cost Center"><input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} className={inputCls} /></F>}
          {cfg.enableDepartment && <F label="Department"><input value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls} /></F>}
          {cfg.enableProject && <F label="Project"><input value={project} onChange={(e) => setProject(e.target.value)} className={inputCls} /></F>}
          <F label="Remarks" className="lg:col-span-3"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={cn(inputCls, "h-auto py-2")} /></F>
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm"><thead className="bg-surface-2/60 text-2xs uppercase text-subtle"><tr><th className="px-3 py-1.5 text-left">Account Posting Preview</th><th className="px-3 py-1.5 text-right">Debit</th><th className="px-3 py-1.5 text-right">Credit</th></tr></thead>
            <tbody className="divide-y divide-border">
              <tr><td className="px-3 py-1.5">{acc(effDebit)?.name || effDebit} <span className="text-2xs text-subtle">(Dr)</span></td><td className="px-3 py-1.5 text-right tabular-nums">{fmt.money(calc.total)}</td><td></td></tr>
              {calc.tds > 0 && <tr><td className="px-3 py-1.5">TDS Receivable <span className="text-2xs text-subtle">(Dr)</span></td><td className="px-3 py-1.5 text-right tabular-nums">{fmt.money(calc.tds)}</td><td></td></tr>}
              {creditPreview(lines, cat, calc).map((c, i) => <tr key={i}><td className="px-3 py-1.5">{c.name} <span className="text-2xs text-subtle">(Cr)</span></td><td></td><td className="px-3 py-1.5 text-right tabular-nums">{fmt.money(c.amt)}</td></tr>)}
              {calc.gst > 0 && <tr><td className="px-3 py-1.5">Output GST Payable <span className="text-2xs text-subtle">(Cr · CGST {fmt.money(calc.cgst)} + SGST {fmt.money(calc.sgst)})</span></td><td></td><td className="px-3 py-1.5 text-right tabular-nums">{fmt.money(calc.gst)}</td></tr>}
              {calc.tcs > 0 && <tr><td className="px-3 py-1.5">TCS Payable <span className="text-2xs text-subtle">(Cr)</span></td><td></td><td className="px-3 py-1.5 text-right tabular-nums">{fmt.money(calc.tcs)}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 6. Submit */}
      <div className="flex items-center justify-end gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">{ActionButtons}</div>

      {addPartyOpen && <AddPartyModal type={partyType || "Other"} onClose={() => setAddPartyOpen(false)} onAdded={(p) => { setAddPartyOpen(false); setParties((ls) => [p, ...ls.filter((x) => x.name !== p.name)]); setPartyName(p.name); if (p.gstin) setPartyGstin(p.gstin); }} />}
    </div>
  );
}

function AddPartyModal({ type, onClose, onAdded }: { type: string; onClose: () => void; onAdded: (p: ReceiptPartyRow) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [ptype, setPtype] = useState(QUICK_ADD_PARTY_TYPES.includes(type as never) ? type : "Other");
  const [f, setF] = useState({ name: "", gstin: "", phone: "", email: "", address: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    if (!f.name.trim()) { toast.error("Party name is required."); return; }
    setBusy(true);
    const j = await fetch("/api/finance/receipt-parties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: ptype, ...f }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (toast.result(j, "Party added.") && j.party) onAdded(j.party);
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Users className="h-4 w-4 text-primary" /> Add New Party</h2><button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="space-y-3 px-5 py-4">
          <F label="Party Type" req><select value={ptype} onChange={(e) => setPtype(e.target.value)} className={inputCls}>{QUICK_ADD_PARTY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}</select></F>
          <F label="Party Name" req><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Name" className={inputCls} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="GSTIN"><input value={f.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} className={inputCls} /></F>
            <F label="Phone"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></F>
          </div>
          <F label="Email"><input value={f.email} onChange={(e) => set("email", e.target.value)} className={inputCls} /></F>
          <F label="Address"><textarea value={f.address} onChange={(e) => set("address", e.target.value)} rows={2} className={cn(inputCls, "h-auto py-2")} /></F>
          <p className="text-2xs text-subtle">{ptype === "Supplier" ? "Saved to the Supplier master." : "Saved to the receipt party master."}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Add Party"}</Button></div>
      </div>
    </div>
  );
}

function creditPreview(lines: Line[], cat: ReceiptCategoryRow | undefined, calc: { rows: { t: number }[] }): { name: string; amt: number }[] {
  const map = new Map<string, number>();
  lines.forEach((l, i) => { const sh = cat?.subHeads.find((s) => s.id === l.subHeadId); const name = sh?.creditName || cat?.creditName || "Income"; map.set(name, +( (map.get(name) || 0) + (calc.rows[i]?.t || 0) ).toFixed(2)); });
  return [...map.entries()].filter(([, amt]) => amt > 0).map(([name, amt]) => ({ name, amt }));
}

function F({ label, children, req, hint, className }: { label: string; children: React.ReactNode; req?: boolean; hint?: string; className?: string }) {
  return <div className={className}><label className="mb-1 block text-2xs font-semibold text-muted">{label}{req && <span className="text-danger"> *</span>}{hint && <span className="ml-1 font-normal text-subtle">· {hint}</span>}</label>{children}</div>;
}
function Card({ icon: Icon, title, action, children }: { icon: typeof Users; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</p>{action}</div>{children}</div>;
}
