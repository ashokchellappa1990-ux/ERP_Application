"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HandCoins, ArrowLeft, User, Landmark, Paperclip, IndianRupee, Loader2, CheckCircle2, Save, X, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { PARTY_TYPES, REF_DOC_TYPES, PAYMENT_MODES, type AdvanceDetail, type AdvanceTypeRow } from "@/lib/contracts/advance";
import { BankPicker, emptyBank } from "@/components/finance/BankPicker";

const n = (v: unknown) => Number(v) || 0;
interface Centre { id: number; code: string; name: string }
interface PartyHit { id: number; name: string; gstin?: string; phone?: string }

export function AdvanceEditor({ advanceId }: { advanceId?: number }) {
  const router = useRouter();
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();

  const [loadingDoc, setLoadingDoc] = useState(!!advanceId);
  const [types, setTypes] = useState<AdvanceTypeRow[]>([]);
  const [costCentres, setCostCentres] = useState<Centre[]>([]); const [profitCentres, setProfitCentres] = useState<Centre[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [advanceTypeId, setAdvanceTypeId] = useState(0);
  const [partyType, setPartyType] = useState("Customer");
  const [partyId, setPartyId] = useState<number | null>(null); const [partyName, setPartyName] = useState("");
  const [partyQuery, setPartyQuery] = useState(""); const [partyHits, setPartyHits] = useState<PartyHit[] | null>(null);
  const [refDocType, setRefDocType] = useState(""); const [refNo, setRefNo] = useState("");
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [department, setDepartment] = useState(""); const [costCenterId, setCostCenterId] = useState(0); const [profitCenterId, setProfitCenterId] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(""); const [taxAmount, setTaxAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Bank"); const [paymentRef, setPaymentRef] = useState(""); const [narration, setNarration] = useState(""); const [bank, setBank] = useState(emptyBank);
  const [attachments, setAttachments] = useState<{ fileName: string; fileUrl: string; fileType?: string | null; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/finance/advance/types", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { const active = j.rows.filter((t: AdvanceTypeRow) => t.status === "active"); setTypes(active); if (!advanceId && active[0]) { setAdvanceTypeId(active[0].id); setPartyType(active[0].partyType); } } }).catch(() => {});
    fetch("/api/finance/dimensions", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { setCostCentres(j.costCentres ?? []); setProfitCentres(j.profitCentres ?? []); } }).catch(() => {});
  }, [advanceId]);

  useEffect(() => {
    if (!advanceId) return;
    fetch(`/api/finance/advance/${advanceId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.ok) { toast.error(j.message || "Could not load."); return; }
      const d: AdvanceDetail = j.data;
      setAdvanceTypeId(d.advanceTypeId ?? 0); setPartyType(d.partyType); setPartyId(d.partyId); setPartyName(d.partyName); setPartyQuery(d.partyName);
      setRefDocType(d.refDocType); setRefNo(d.refNo); setAdvanceDate(d.advanceDate); setDepartment(d.department); setCostCenterId(d.costCenterId ?? 0); setProfitCenterId(d.profitCenterId ?? 0);
      setAdvanceAmount(String(d.advanceAmount)); setTaxAmount(d.taxAmount ? String(d.taxAmount) : ""); setPaymentMode(d.paymentMode || "Bank"); setPaymentRef(d.paymentRef); setNarration(d.narration);
      setAttachments(d.attachments); setLoadingDoc(false);
    });
  }, [advanceId, toast]);

  const type = types.find((t) => t.id === advanceTypeId);
  const net = useMemo(() => Math.round((n(advanceAmount) + n(taxAmount)) * 100) / 100, [advanceAmount, taxAmount]);

  // party search (Customer / Supplier masters)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParty = async (q: string) => {
    const ep = partyType === "Supplier" ? "/api/masters/suppliers" : partyType === "Customer" ? "/api/masters/customers" : null;
    if (!ep) return;
    try { const j = await fetch(`${ep}?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setPartyHits(j.suppliers ?? j.customers ?? []); } catch { /* */ }
  };
  const onPartyQuery = (v: string) => { setPartyQuery(v); setPartyName(v); setPartyId(null); if (timer.current) clearTimeout(timer.current); if (!v.trim() || (partyType !== "Customer" && partyType !== "Supplier")) { setPartyHits(null); return; } timer.current = setTimeout(() => searchParty(v), 250); };

  const upload = async (files: FileList | null) => { if (!files?.length) return; setUploading(true); for (const f of Array.from(files)) { const fd = new FormData(); fd.append("file", f); const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null); if (j?.ok) setAttachments((a) => [...a, j.file]); else toast.error(j?.message || "Upload failed."); } setUploading(false); };

  async function save(saveMode: "Draft" | "Submit") {
    if (!advanceTypeId) return toast.error("Select an advance type.");
    if (!(n(advanceAmount) > 0)) return toast.error("Enter the advance amount.");
    setSubmitting(true);
    const payload = { advanceDate, department: department || undefined, costCenterId: costCenterId || undefined, profitCenterId: profitCenterId || undefined, advanceTypeId, partyType, partyId: partyId || undefined, partyName: partyName || undefined, refDocType: refDocType || undefined, refNo: refNo || undefined, advanceAmount: n(advanceAmount), taxAmount: n(taxAmount), paymentMode, paymentRef: paymentRef || undefined, bankId: bank.bankId, bankName: bank.bankName, bankAccount: bank.bankAccount, narration: narration || undefined, attachments, saveMode };
    try {
      const res = await fetch(advanceId ? `/api/finance/advance/${advanceId}` : "/api/finance/advance", { method: advanceId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Saved."); router.push(`/finance/advance/${advanceId ?? j.id}`); }
      else { toast.error(j.message || "Could not save."); setSubmitting(false); }
    } catch { toast.error("Network error."); setSubmitting(false); }
  }

  if (loadingDoc) return <div className="py-16"><AppLoader label="Loading advance…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance/advance" className="hover:text-foreground">Advance Transactions</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{advanceId ? "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><HandCoins className="h-5 w-5 text-primary" /> {advanceId ? "Edit Advance" : "New Advance"}</h1>
          {type && <p className="mt-0.5 text-sm text-muted">{type.name} — <strong>{type.direction === "received" ? "money received (liability)" : "money paid out (asset)"}</strong>. Posts to the GL on approval.</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={advanceId ? `/finance/advance/${advanceId}` : "/finance/advance"}><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={() => save("Submit")} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {advanceId ? "Save & Submit" : "Create & Submit"}</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <SectionCard icon={User} title="Advance Details" allowOverflow>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Fld label="Advance Type *"><select value={advanceTypeId} onChange={(e) => { const id = Number(e.target.value); setAdvanceTypeId(id); const t = types.find((x) => x.id === id); if (t) setPartyType(t.partyType); }} className={inp}>{types.length === 0 && <option value={0}>No types</option>}{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Fld>
              <Fld label="Advance Date"><input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} className={inp} /></Fld>
              <Fld label="Party Type"><select value={partyType} onChange={(e) => { setPartyType(e.target.value); setPartyHits(null); }} className={inp}>{PARTY_TYPES.map((p) => <option key={p}>{p}</option>)}</select></Fld>
              <div className="relative sm:col-span-2 lg:col-span-1">
                <label className="mb-1 block text-2xs font-semibold text-muted">Party {partyType === "Customer" || partyType === "Supplier" ? "(search or type)" : "(name)"}</label>
                <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" /><input value={partyQuery} onChange={(e) => onPartyQuery(e.target.value)} placeholder={`${partyType} name…`} className={cn(inp, "pl-8")} /></div>
                {partyHits && partyHits.length > 0 && <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">{partyHits.map((h) => <button key={h.id} onClick={() => { setPartyId(h.id); setPartyName(h.name); setPartyQuery(h.name); setPartyHits(null); }} className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{h.name}</span><span className="text-2xs text-subtle">{h.gstin || h.phone || ""}</span></button>)}</div>}
              </div>
              <Fld label="Department"><input value={department} onChange={(e) => setDepartment(e.target.value)} className={inp} /></Fld>
              <Fld label="Reference Document"><select value={refDocType} onChange={(e) => setRefDocType(e.target.value)} className={inp}>{REF_DOC_TYPES.map((r) => <option key={r} value={r}>{r || "—"}</option>)}</select></Fld>
              <Fld label="Reference Number"><input value={refNo} onChange={(e) => setRefNo(e.target.value)} className={inp} /></Fld>
              <Fld label="Cost Centre"><select value={costCenterId} onChange={(e) => setCostCenterId(Number(e.target.value))} className={inp}><option value={0}>— None —</option>{costCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></Fld>
              <Fld label="Profit Centre"><select value={profitCenterId} onChange={(e) => setProfitCenterId(Number(e.target.value))} className={inp}><option value={0}>— None —</option>{profitCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></Fld>
            </div>
          </SectionCard>

          <SectionCard icon={Landmark} title="Amount & Payment">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Fld label="Advance Amount *"><input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} className={inp} placeholder="0.00" /></Fld>
              <Fld label="Tax Amount"><input type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} className={inp} placeholder="0.00" /></Fld>
              <Fld label="Payment Mode"><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={inp}>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select></Fld>
              <Fld label="Payment Reference"><input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} className={inp} placeholder="UTR / cheque no" /></Fld>
              <BankPicker mode={paymentMode} value={bank} onChange={setBank} required />

              <div className="sm:col-span-2 lg:col-span-4"><Fld label="Narration"><textarea value={narration} onChange={(e) => setNarration(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></Fld></div>
            </div>
          </SectionCard>

          <SectionCard icon={Paperclip} title="Attachments">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted hover:border-primary/40 hover:text-primary">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} Attach documents<input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} /></label>
            {attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-medium text-primary"><a href={a.fileUrl} target="_blank" rel="noreferrer" className="hover:underline">{a.fileName}</a><button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="hover:text-danger"><X className="h-3 w-3" /></button></span>)}</div>}
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <SectionCard icon={IndianRupee} title="Summary">
            <div className="space-y-1.5 text-sm">
              <Row k="Advance Amount" v={money(n(advanceAmount))} />
              <Row k="Tax Amount" v={money(n(taxAmount))} />
              <div className="my-1.5 h-px bg-border" />
              <div className="flex items-center justify-between text-lg font-bold text-primary"><span>Net Amount</span><span>{money(net)}</span></div>
            </div>
            <div className="mt-3 space-y-2">
              <Button size="lg" className="w-full" onClick={() => save("Submit")} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {advanceId ? "Save & Submit" : "Create & Submit"}</Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => save("Draft")} disabled={submitting}><Save className="h-4 w-4" /> Save as Draft</Button>
            </div>
            <p className="mt-2 text-center text-2xs text-subtle">Submitting posts to the GL (or routes for approval if a threshold is set).</p>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }
function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="text-foreground">{v}</span></div>; }
