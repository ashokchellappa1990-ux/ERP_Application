"use client";

import { useEffect, useState } from "react";
import { X, Landmark, Calculator, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import type { StatutoryLiability } from "@/lib/finance/statutory/engine";

const inr = (x: number) => formatMoney(x || 0);
const n = (v: unknown) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const MODES = ["Bank", "NEFT", "RTGS", "UPI", "Cheque", "Cash"];

interface TypeOpt { code: string; label: string }

/** Create-a-government-payment modal: pick head + period → auto-load liability →
 *  enter payment + interest/penalty + challan → post Draft. */
export function StatutoryPaymentModal({ types, initialType, initialPeriod, onClose, onSaved }: { types: TypeOpt[]; initialType?: string; initialPeriod?: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [type, setType] = useState(initialType || types[0]?.code || "GST");
  const [period, setPeriod] = useState(initialPeriod || thisMonth());
  const [paymentDate, setPaymentDate] = useState(today);
  const [lia, setLia] = useState<StatutoryLiability | null>(null);
  const [loadingLia, setLoadingLia] = useState(false);

  const [paidAmount, setPaidAmount] = useState("");
  const [interest, setInterest] = useState("");
  const [penalty, setPenalty] = useState("");
  const [pay, setPay] = useState({ paymentMode: "Bank", bankAccount: "", referenceNo: "", transactionNo: "", remarks: "" });
  const [challan, setChallan] = useState({ challanNo: "", cpin: "", cin: "", bsrCode: "", challanBank: "", govRef: "", ackNo: "" });
  const [attachments, setAttachments] = useState<{ fileName: string; fileUrl: string; fileType?: string | null; size?: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const setP = (k: keyof typeof pay, v: string) => setPay((s) => ({ ...s, [k]: v }));
  const setC = (k: keyof typeof challan, v: string) => setChallan((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    let active = true;
    setLoadingLia(true);
    fetch(`/api/finance/statutory/liability?type=${type}&period=${period}`, { cache: "no-store" })
      .then((r) => r.json()).then((j) => { if (!active) return; if (j.ok) { setLia(j.data); setPaidAmount(j.data.balance > 0 ? String(j.data.balance) : ""); } setLoadingLia(false); })
      .catch(() => active && setLoadingLia(false));
    return () => { active = false; };
  }, [type, period]);

  const totalPayable = +(n(paidAmount) + n(interest) + n(penalty)).toFixed(2);

  async function upload(files: FileList | null) {
    if (!files?.length) return; setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f);
      const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
      if (j?.ok) setAttachments((a) => [...a, j.file]);
    }
    setUploading(false);
  }

  async function save() {
    if (totalPayable <= 0) { toast.show("Enter an amount to pay.", { type: "error" }); return; }
    setBusy(true);
    const body = {
      action: "create", statutoryType: type, taxPeriod: period, paymentDate,
      liabilityAmount: lia?.liability ?? 0, alreadyPaid: lia?.alreadyPaid ?? 0,
      paidAmount: n(paidAmount), interest: n(interest), penalty: n(penalty),
      breakupJson: lia?.breakup ? JSON.stringify(lia.breakup) : null,
      ...pay, ...challan, attachments,
    };
    const j = await fetch("/api/finance/statutory/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.show(j.message || "Created.", { type: "success" }); onSaved(); } else toast.show(j.message || "Could not create.", { type: "error" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground"><Landmark className="h-4 w-4 text-primary" /> New Government Payment</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[74vh] space-y-4 overflow-y-auto px-5 py-4">
          {/* Head + period */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className={lbl}>Statutory Type</label><select value={type} onChange={(e) => setType(e.target.value)} className={inp}>{types.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}</select></div>
            <div><label className={lbl}>Tax Period</label><input type="month" value={period} onChange={(e) => setPeriod(e.target.value || thisMonth())} className={inp} /></div>
            <div><label className={lbl}>Payment Date</label><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inp} /></div>
          </div>

          {/* Liability auto-load */}
          <div className="rounded-xl border border-primary/25 bg-primary-subtle/20 p-3">
            {loadingLia ? <AppLoader label="Loading liability…" size="sm" /> : lia ? (
              <div className="grid gap-2 sm:grid-cols-4 text-center">
                <Stat k="Tax Liability" v={inr(lia.liability)} />
                <Stat k="Already Paid" v={inr(lia.alreadyPaid)} />
                <Stat k="Balance" v={inr(lia.balance)} accent />
                {lia.receivable > 0 ? <Stat k="Credit / ITC" v={inr(lia.receivable)} /> : <Stat k="Total Payable" v={inr(totalPayable)} accent />}
              </div>
            ) : <p className="text-2xs text-muted">No liability data.</p>}
            {lia && lia.breakup.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-primary/15 pt-2 text-2xs text-muted">
                {lia.breakup.slice(0, 6).map((b) => <span key={b.key}>{b.label}: <b className="text-foreground">{inr(b.amount)}</b></span>)}
              </div>
            )}
          </div>

          {/* Amounts */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className={lbl}>Amount Paying (tax)</label><input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className={inp} placeholder="0.00" /></div>
            <div><label className={lbl}>Interest</label><input type="number" value={interest} onChange={(e) => setInterest(e.target.value)} className={inp} placeholder="0.00" /></div>
            <div><label className={lbl}>Penalty</label><input type="number" value={penalty} onChange={(e) => setPenalty(e.target.value)} className={inp} placeholder="0.00" /></div>
          </div>

          {/* Payment info */}
          <div>
            <div className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">Payment Information</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={lbl}>Payment Mode</label><select value={pay.paymentMode} onChange={(e) => setP("paymentMode", e.target.value)} className={inp}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
              <div><label className={lbl}>Bank Account</label><input value={pay.bankAccount} onChange={(e) => setP("bankAccount", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Reference No.</label><input value={pay.referenceNo} onChange={(e) => setP("referenceNo", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Transaction No.</label><input value={pay.transactionNo} onChange={(e) => setP("transactionNo", e.target.value)} className={inp} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Remarks</label><input value={pay.remarks} onChange={(e) => setP("remarks", e.target.value)} className={inp} /></div>
            </div>
          </div>

          {/* Challan info */}
          <div>
            <div className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">Challan Information (optional — can add later)</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={lbl}>Challan No.</label><input value={challan.challanNo} onChange={(e) => setC("challanNo", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>CPIN</label><input value={challan.cpin} onChange={(e) => setC("cpin", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>CIN</label><input value={challan.cin} onChange={(e) => setC("cin", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>BSR Code</label><input value={challan.bsrCode} onChange={(e) => setC("bsrCode", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Bank</label><input value={challan.challanBank} onChange={(e) => setC("challanBank", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Govt Reference</label><input value={challan.govRef} onChange={(e) => setC("govRef", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Acknowledgement No.</label><input value={challan.ackNo} onChange={(e) => setC("ackNo", e.target.value)} className={inp} /></div>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="text-2xs font-bold uppercase tracking-wide text-subtle">Attachments</span>
              <label className="cursor-pointer text-2xs font-semibold text-primary hover:underline"><Paperclip className="mr-0.5 inline h-3 w-3" />{uploading ? "Uploading…" : "Add"}<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label>
            </div>
            {attachments.length > 0 && <div className="space-y-1">{attachments.map((a, i) => <div key={i} className="flex items-center justify-between rounded-md border border-border bg-surface-2/40 px-2.5 py-1 text-2xs"><a href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-foreground hover:text-primary"><FileText className="h-3.5 w-3.5" />{a.fileName}</a><button onClick={() => setAttachments((c) => c.filter((_, j) => j !== i))} className="text-muted hover:text-danger"><X className="h-3.5 w-3.5" /></button></div>)}</div>}
          </div>

          {/* Accounting preview */}
          <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-2xs font-bold text-foreground"><Calculator className="h-3.5 w-3.5 text-primary" /> Accounting Preview (on Mark Paid)</div>
            <div className="space-y-0.5 text-2xs">
              <Ln a={`${type} Payable`} v={`Dr ${inr(n(paidAmount))}`} />
              {n(interest) + n(penalty) > 0 && <Ln a="Statutory Interest & Penalty" v={`Dr ${inr(n(interest) + n(penalty))}`} />}
              <Ln a={pay.paymentMode.toLowerCase() === "cash" ? "Cash" : "Bank"} v={`Cr ${inr(totalPayable)}`} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <span className="text-sm font-bold text-foreground">Total Payable: {inr(totalPayable)}</span>
          <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button><Button size="sm" onClick={save} disabled={busy || totalPayable <= 0}>{busy ? "Saving…" : "Create Payment"}</Button></div>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return <div><div className="text-2xs text-muted">{k}</div><div className={cn("text-sm font-bold tabular-nums", accent ? "text-primary" : "text-foreground")}>{v}</div></div>;
}
function Ln({ a, v }: { a: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted">{a}</span><span className="tabular-nums text-foreground">{v}</span></div>;
}
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
