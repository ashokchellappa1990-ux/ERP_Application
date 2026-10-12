"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserPlus, ListChecks, LayoutDashboard, FileText, Users, Search, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Printer, RefreshCw, Download, ShieldCheck, Play, Ban, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel, printTable } from "@/lib/export/download";
import { FEE_PAYMENT_MODES, REG_REPORT_TYPES, REG_REPORT_LABELS, type PlanRow, type QualificationResult, type RegistrationRow, type RegistrationDetail, type RegDashboard, type ReportResult, type RegReportType } from "@/lib/contracts/membershipRegistration";

const API = "/api/crm/membership";
const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const fm = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const TABS = [
  { id: "register", label: "New Registration", icon: UserPlus },
  { id: "list", label: "Registrations", icon: ListChecks },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "reports", label: "Reports", icon: FileText },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function MembershipRegistrationConsole() {
  const [tab, setTab] = useState<TabId>("register");
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 3000); };
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>CRM</span><span className="text-subtle">/</span><span>Membership Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Registration</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Users className="h-5 w-5 text-primary" /> Membership Registration</h1>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}><Icon className="h-4 w-4" /> {t.label}</button>; })}
      </div>
      {tab === "register" && <Wizard flash={flash} onDone={() => setTab("list")} />}
      {tab === "list" && <ListTab flash={flash} />}
      {tab === "dashboard" && <DashboardTab />}
      {tab === "reports" && <ReportsTab />}
      {msg && <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg}</div>}
    </div>
  );
}

/* ============================ WIZARD ============================ */
const STEPS = ["Customer", "Membership", "Qualification", "Fee", "Card Preview", "Confirm"];
const EMPTY_NEW = { name: "", phone: "", email: "", dob: "", anniversary: "", gender: "", address: "", city: "", state: "", pincode: "", gstin: "", pan: "" };
type Cust = { id: number; name: string; phone?: string; email?: string };
function Wizard({ flash, onDone }: { flash: (m: string) => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [cust, setCust] = useState<Cust | null>(null);
  const [custQ, setCustQ] = useState("");
  const [hits, setHits] = useState<Cust[]>([]);
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ ...EMPTY_NEW });
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [qual, setQual] = useState<QualificationResult | null>(null);
  const [payMode, setPayMode] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [discount, setDiscount] = useState("0");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ registrationNo: string; status: string; membershipNumber: string | null; id: number } | null>(null);

  useEffect(() => { (async () => { const j = await fetch(`${API}/plans`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setPlans(j.rows); })(); }, []);
  useEffect(() => { if (!custQ.trim()) { setHits([]); return; } const tmo = setTimeout(async () => { const j = await fetch(`/api/masters/customers?q=${encodeURIComponent(custQ)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setHits(j.customers); }, 220); return () => clearTimeout(tmo); }, [custQ]);
  useEffect(() => { if (step === 2 && cust && plan) { (async () => { const j = await fetch(`${API}/qualify?customerId=${cust.id}&levelId=${plan.levelId}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setQual(j.data); })(); } }, [step, cust, plan]);

  const feeBase = plan ? Math.max(0, plan.registrationFee - (Number(discount) || 0)) : 0;
  const gst = plan?.gstApplicable ? +(feeBase * plan.gstPercentage / 100).toFixed(2) : 0;
  const net = +(feeBase + gst).toFixed(2);
  const feeBased = net > 0;

  async function createCustomer() {
    if (!nc.name.trim()) { flash("Customer name is required."); return; }
    const j = await fetch("/api/masters/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nc) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setCust(j.customer); setAdding(false); setNc({ ...EMPTY_NEW }); flash("Customer created."); } else flash(j.message || "Could not create customer.");
  }
  function next() { if (step === 0 && !cust) { flash("Select or create a customer."); return; } if (step === 1 && !plan) { flash("Select a membership plan."); return; } let n = step + 1; if (n === 3 && !feeBased) n = 4; setStep(Math.min(n, 5)); }
  function back() { let p = step - 1; if (p === 3 && !feeBased) p = 2; setStep(Math.max(p, 0)); }
  async function submit() {
    if (!cust || !plan) return;
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", customerId: cust.id, levelId: plan.levelId, collectFee: feeBased, paymentMode: payMode, paymentRef: payRef || undefined, discountAmount: Number(discount) || 0 }) }).then((r) => r.json()).catch(() => ({}));
    if (!j.ok) { flash(j.message || "Registration failed."); setBusy(false); return; }
    let res = { registrationNo: j.registrationNo, status: j.status, membershipNumber: j.membershipNumber, id: j.id };
    // If approved (not auto-active and no approval needed), activate to finish.
    if (j.status === "Approved") { const a = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "activate", registrationId: j.id }) }).then((r) => r.json()).catch(() => ({})); if (a.ok) res = { ...res, status: "Active", membershipNumber: a.membershipNumber }; }
    setResult(res); setBusy(false); flash(j.message);
  }
  function reset() { setStep(0); setCust(null); setCustQ(""); setPlan(null); setQual(null); setResult(null); setDiscount("0"); setPayRef(""); }

  return (
    <div className="space-y-4">
      {/* stepper */}
      <div className="flex flex-wrap items-center gap-1.5 text-2xs">
        {STEPS.map((s, i) => <span key={s} className="flex items-center gap-1.5"><span className={cn("flex h-6 items-center gap-1.5 rounded-full px-2.5 font-semibold", i === step ? "bg-primary text-white" : i < step ? "bg-success-subtle text-success" : "bg-surface-2 text-muted")}>{i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{i + 1}</span>} {s}</span>{i < STEPS.length - 1 && <span className="text-subtle">→</span>}</span>)}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {/* STEP 1 customer */}
        {step === 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Step 1 · Customer Information</h3>
            {cust ? (
              <div className="flex items-center justify-between rounded-lg bg-primary-subtle/40 px-4 py-3"><div><div className="font-semibold text-foreground">{cust.name}</div><div className="text-2xs text-muted">{cust.phone || "—"}{cust.email ? ` · ${cust.email}` : ""}</div></div><button onClick={() => setCust(null)} className="text-2xs font-semibold text-danger hover:underline">Change</button></div>
            ) : adding ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <div><label className={lbl}>Name *</label><input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Mobile</label><input value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Email</label><input value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Date of Birth</label><input type="date" value={nc.dob} onChange={(e) => setNc({ ...nc, dob: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Anniversary</label><input type="date" value={nc.anniversary} onChange={(e) => setNc({ ...nc, anniversary: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Gender</label><select value={nc.gender} onChange={(e) => setNc({ ...nc, gender: e.target.value })} className={inp}><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></div>
                  <div className="col-span-2 lg:col-span-3"><label className={lbl}>Address</label><input value={nc.address} onChange={(e) => setNc({ ...nc, address: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>City</label><input value={nc.city} onChange={(e) => setNc({ ...nc, city: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>State</label><input value={nc.state} onChange={(e) => setNc({ ...nc, state: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>Pincode</label><input value={nc.pincode} onChange={(e) => setNc({ ...nc, pincode: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>GSTIN</label><input value={nc.gstin} onChange={(e) => setNc({ ...nc, gstin: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>PAN</label><input value={nc.pan} onChange={(e) => setNc({ ...nc, pan: e.target.value })} className={inp} /></div>
                </div>
                <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button onClick={createCustomer}><CheckCircle2 className="h-4 w-4" /> Create Customer</Button></div>
              </div>
            ) : (
              <div className="relative">
                <label className={lbl}>Search existing customer</label>
                <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-subtle" /><input value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder="Name / phone…" className={cn(inp, "pl-8")} /></div><Button variant="outline" onClick={() => { setNc({ ...EMPTY_NEW, phone: custQ }); setAdding(true); }}><UserPlus className="h-4 w-4" /> New Customer</Button></div>
                {hits.length > 0 && custQ && <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">{hits.map((c) => <button key={c.id} onClick={() => { setCust(c); setCustQ(""); setHits([]); }} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-primary-subtle/40"><span className="font-medium">{c.name}</span><span className="text-2xs text-subtle">{c.phone}</span></button>)}</div>}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 membership selection */}
        {step === 1 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Step 2 · Membership Selection</h3>
            {!plans.length ? <div className="py-8 text-center text-sm text-muted">No active membership levels configured. Set them up in Membership Configuration.</div> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((p) => (
                  <button key={p.levelId} onClick={() => setPlan(p)} className={cn("rounded-xl border-2 p-4 text-left transition", plan?.levelId === p.levelId ? "border-primary bg-primary-subtle/30" : "border-border bg-surface-2/40 hover:border-primary/50")}>
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full" style={{ background: p.themeColor || "#6366f1" }} /><span className="font-bold text-foreground">{p.name}</span></div>
                    <div className="mt-1 text-2xs text-muted">{p.description || "—"}</div>
                    <div className="mt-2 text-lg font-bold text-foreground">{p.registrationFee > 0 ? fm(p.registrationFee) : "Free"}{p.gstApplicable && p.registrationFee > 0 ? <span className="text-2xs font-normal text-muted"> + {p.gstPercentage}% GST</span> : ""}</div>
                    <div className="mt-1 text-2xs text-muted">Validity: {p.validityType}{p.validityType !== "Lifetime" ? ` (${p.validityDays}d)` : ""}</div>
                    <div className="mt-2 flex flex-wrap gap-1">{p.billDiscountPct > 0 && <Chip>{p.billDiscountPct}% bill disc</Chip>}{p.pointMultiplier > 1 && <Chip>{p.pointMultiplier}× points</Chip>}{p.welcomePoints > 0 && <Chip>{p.welcomePoints} welcome pts</Chip>}{p.serviceBenefits.slice(0, 2).map((sv) => <Chip key={sv}>{sv}</Chip>)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3 qualification */}
        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Step 3 · Qualification Verification</h3>
            {!qual ? <div className="py-8 text-center text-sm text-muted">Checking…</div> : (
              <>
                <div className={cn("flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold", qual.status === "Qualified" ? "border-success/40 bg-success-subtle/40 text-success" : qual.status === "ApprovalRequired" ? "border-warning/40 bg-warning-subtle/40 text-warning" : "border-danger/40 bg-danger-subtle/40 text-danger")}>
                  {qual.status === "Qualified" ? <CheckCircle2 className="h-4 w-4" /> : qual.status === "ApprovalRequired" ? <ShieldCheck className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {qual.status === "Qualified" ? "Customer qualifies for this membership" : qual.status === "ApprovalRequired" ? "Approval required — will be sent for approval" : "Customer does not meet the qualification rules"}
                </div>
                {qual.checks.length > 0 ? (
                  <table className="w-full text-sm"><thead><tr className="text-left text-2xs uppercase text-subtle"><th className="pb-1.5">Rule</th><th className="pb-1.5">Required</th><th className="pb-1.5">Actual</th><th className="pb-1.5 text-center">Result</th></tr></thead>
                    <tbody>{qual.checks.map((c, i) => <tr key={i} className="border-t border-border"><td className="py-1.5 font-medium text-foreground">{c.method}</td><td className="py-1.5 text-muted">{c.required}</td><td className="py-1.5 text-muted">{c.actual}</td><td className="py-1.5 text-center">{c.passed ? <CheckCircle2 className="mx-auto h-4 w-4 text-success" /> : <XCircle className="mx-auto h-4 w-4 text-danger" />}</td></tr>)}</tbody>
                  </table>
                ) : <p className="text-2xs text-subtle">No qualification rules configured for this level — open to all customers.</p>}
                <p className="text-2xs text-subtle">Combine logic: {qual.combineLogic}</p>
              </>
            )}
          </div>
        )}

        {/* STEP 4 fee */}
        {step === 3 && plan && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Step 4 · Membership Fee Collection</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-border bg-surface-2/40 p-4 text-sm">
                <Row k="Registration Fee" v={fm(plan.registrationFee)} />
                <div className="flex items-center justify-between"><span className="text-muted">Discount</span><input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-7 w-24 rounded border border-border-strong bg-surface px-2 text-right text-xs" /></div>
                {plan.gstApplicable && <Row k={`GST @${plan.gstPercentage}%`} v={fm(gst)} />}
                <div className="my-1 h-px bg-border" />
                <div className="flex items-center justify-between text-base font-bold text-foreground"><span>Net Amount</span><span>{fm(net)}</span></div>
              </div>
              <div className="space-y-3">
                <div><label className={lbl}>Payment Mode</label><select value={payMode} onChange={(e) => setPayMode(e.target.value)} className={inp}>{FEE_PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
                <div><label className={lbl}>Payment Reference</label><input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UPI ref / cheque no…" className={inp} /></div>
                <p className="text-2xs text-subtle">On confirmation a receipt + finance posting (Dr {payMode} / Cr Membership Income / Cr Output GST) is generated automatically.</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 card preview */}
        {step === 4 && plan && cust && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Step 5 · Membership Card Preview</h3>
            <MemberCard levelName={plan.name} themeColor={plan.themeColor} customerName={cust.name} number={result?.membershipNumber || "Will be generated on activation"} expiry={plan.validityType === "Lifetime" ? "Lifetime" : `${plan.validityDays} days from activation`} />
            <p className="text-2xs text-subtle">The membership number, QR code and card number are generated automatically when the membership is activated (final step).</p>
          </div>
        )}

        {/* STEP 6 confirm */}
        {step === 5 && plan && cust && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Step 6 · Confirmation &amp; Activation</h3>
            {!result ? (
              <>
                <div className="grid gap-2 rounded-xl border border-border bg-surface-2/40 p-4 text-sm sm:grid-cols-2">
                  <Row k="Customer" v={cust.name} /><Row k="Membership" v={plan.name} />
                  <Row k="Type" v={plan.registrationFee > 0 ? "Paid" : "Free"} /><Row k="Fee (net)" v={feeBased ? fm(net) : "—"} />
                  <Row k="Qualification" v={qual?.status || "—"} /><Row k="Validity" v={plan.validityType} />
                </div>
                <div className="flex justify-end"><Button onClick={submit} disabled={busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Processing…" : "Confirm & Activate"}</Button></div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-subtle/40 px-4 py-3 text-sm font-bold text-success"><CheckCircle2 className="h-5 w-5" /> {result.status === "Active" ? `Membership Active — ${result.membershipNumber}` : `Registration ${result.registrationNo} — ${result.status}`}</div>
                {result.status === "Active" && <MemberCard levelName={plan.name} themeColor={plan.themeColor} customerName={cust.name} number={result.membershipNumber || ""} expiry={plan.validityType === "Lifetime" ? "Lifetime" : "1 term"} />}
                <div className="flex flex-wrap gap-2">
                  {result.status === "Active" && <Button variant="outline" onClick={() => printCard(cust.name, plan, result.membershipNumber || "", result.id)}><Printer className="h-4 w-4" /> Print Card</Button>}
                  <Button variant="outline" onClick={() => { reset(); }}><UserPlus className="h-4 w-4" /> New Registration</Button>
                  <Button onClick={onDone}><ListChecks className="h-4 w-4" /> View Registrations</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!result && (
        <div className="flex justify-between">
          <Button variant="ghost" onClick={back} disabled={step === 0}><ArrowLeft className="h-4 w-4" /> Back</Button>
          {step < 5 && <Button onClick={next}>Next <ArrowRight className="h-4 w-4" /></Button>}
        </div>
      )}
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{children}</span>; }
function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>; }

function MemberCard({ levelName, themeColor, customerName, number, expiry }: { levelName: string; themeColor: string; customerName: string; number: string; expiry: string }) {
  return (
    <div className="max-w-sm overflow-hidden rounded-2xl border border-border shadow-md" style={{ background: `linear-gradient(135deg, ${themeColor || "#6366f1"}, #1e1b4b)` }}>
      <div className="p-5 text-white">
        <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-widest opacity-80">Membership</span><span className="rounded bg-white/20 px-2 py-0.5 text-2xs font-bold">{levelName}</span></div>
        <div className="mt-6 font-mono text-lg font-bold tracking-wider">{number}</div>
        <div className="mt-4 flex items-end justify-between">
          <div><div className="text-2xs opacity-70">Member</div><div className="font-semibold">{customerName}</div><div className="mt-1 text-2xs opacity-70">Valid: {expiry}</div></div>
          <div className="grid h-12 w-12 grid-cols-4 grid-rows-4 gap-px rounded bg-white p-1">{Array.from({ length: 16 }).map((_, i) => <span key={i} className={cn("rounded-[1px]", (i * 7 + number.length) % 3 === 0 ? "bg-black" : "bg-white")} />)}</div>
        </div>
      </div>
    </div>
  );
}
function printCard(name: string, plan: PlanRow, number: string, regId: number) {
  fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recordDocument", registrationId: regId, docType: "Card" }) }).catch(() => {});
  const w = window.open("", "_blank", "width=420,height=560"); if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${number}</title><style>body{font-family:system-ui;padding:20px}.card{max-width:340px;border-radius:16px;padding:22px;color:#fff;background:linear-gradient(135deg,${plan.themeColor || "#6366f1"},#1e1b4b)}.n{font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:2px;margin-top:24px}.r{display:flex;justify-content:space-between;margin-top:16px}.dim{opacity:.75;font-size:11px}</style></head><body><div class="card"><div class="r"><span class="dim">MEMBERSHIP</span><b>${plan.name}</b></div><div class="n">${number}</div><div style="margin-top:16px"><div class="dim">Member</div><b>${name}</b><div class="dim" style="margin-top:6px">Validity: ${plan.validityType}</div></div></div><script>window.onload=function(){setTimeout(function(){window.print()},150)}</script></body></html>`); w.document.close();
}

/* ============================ LIST ============================ */
function ListTab({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const [view, setView] = useState<RegistrationDetail | null>(null);
  const load = useCallback(async () => { const p = new URLSearchParams(); if (status) p.set("status", status); if (q) p.set("q", q); const j = await fetch(`${API}/list?${p}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setRows(j.rows); }, [status, q]);
  useEffect(() => { load(); }, [load]);
  async function act(action: string, registrationId: number, extra?: Record<string, unknown>) { const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, registrationId, ...extra }) }).then((r) => r.json()).catch(() => ({})); if (j.ok) { flash(j.message); load(); if (view) openDetail(view.id); } else flash(j.message || "Action failed."); }
  async function openDetail(id: number) { const j = await fetch(`${API}/detail?id=${id}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setView(j.data); }
  const badge = (st: string) => cn("rounded-full px-2 py-0.5 text-2xs font-semibold", st === "Active" ? "bg-success-subtle text-success" : st === "PendingApproval" || st === "Submitted" ? "bg-warning-subtle text-warning" : st === "Cancelled" || st === "Expired" ? "bg-danger-subtle text-danger" : "bg-surface-2 text-muted");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inp, "w-44")}>{["All", "Draft", "Submitted", "PendingApproval", "Approved", "Active", "Suspended", "Expired", "Cancelled"].map((x) => <option key={x}>{x}</option>)}</select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reg no / member / customer…" className={cn(inp, "w-64")} />
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <span className="ml-auto text-2xs text-muted">{rows.length} registration(s)</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Reg No</th><th className="px-3 py-2.5">Membership No</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Level</th><th className="px-3 py-2.5">Reg Date</th><th className="px-3 py-2.5 text-right">Net</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                <td className="px-3 py-2 font-mono text-2xs text-foreground">{r.registrationNo}</td>
                <td className="px-3 py-2 font-mono text-2xs">{r.membershipNumber || "—"}</td>
                <td className="px-3 py-2 font-medium text-foreground">{r.customerName}<span className="block text-2xs text-subtle">{r.customerPhone}</span></td>
                <td className="px-3 py-2 text-muted">{r.levelName}</td>
                <td className="px-3 py-2 text-2xs text-muted">{r.registrationDate}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.netAmount ? fm(r.netAmount) : "—"}</td>
                <td className="px-3 py-2"><span className={badge(r.status)}>{r.status}</span></td>
                <td className="px-3 py-2 text-right"><div className="flex justify-end gap-1">
                  <button onClick={() => openDetail(r.id)} className="rounded-md border border-border px-2 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary"><Eye className="mr-1 inline h-3 w-3" />View</button>
                  {(r.status === "PendingApproval" || r.status === "Submitted") && <button onClick={() => act("approve", r.id, { approve: true })} className="rounded-md border border-success/40 px-2 py-1 text-2xs font-semibold text-success hover:bg-success-subtle"><ShieldCheck className="mr-1 inline h-3 w-3" />Approve</button>}
                  {r.status === "Approved" && <button onClick={() => act("activate", r.id)} className="rounded-md border border-primary/40 px-2 py-1 text-2xs font-semibold text-primary hover:bg-primary-subtle"><Play className="mr-1 inline h-3 w-3" />Activate</button>}
                  {r.status !== "Cancelled" && r.status !== "Active" && <button onClick={() => act("cancel", r.id, { reason: "Cancelled from list" })} className="text-danger hover:opacity-70" title="Cancel"><Ban className="h-3.5 w-3.5" /></button>}
                </div></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">No registrations yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {view && (
        <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" onClick={() => setView(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><div><h2 className="text-sm font-bold text-foreground">{view.registrationNo}</h2><p className="text-2xs text-muted">{view.customerName} · {view.levelName}</p></div><button onClick={() => setView(null)} className="text-muted hover:text-foreground"><XCircle className="h-5 w-5" /></button></div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2 text-sm"><Row k="Status" v={view.status} /><Row k="Type" v={view.membershipType} /><Row k="Membership No" v={view.membershipNumber || "—"} /><Row k="Reg Date" v={view.registrationDate} /><Row k="Activation" v={view.activationDate || "—"} /><Row k="Expiry" v={view.expiryDate || "—"} /><Row k="Fee" v={fm(view.feeAmount)} /><Row k="GST" v={fm(view.gstAmount)} /><Row k="Net" v={fm(view.netAmount)} /><Row k="Qualified" v={view.qualified ? "Yes" : "No"} /></div>
              {view.card && <div><h4 className="mb-1.5 text-2xs font-bold uppercase text-subtle">Card</h4><MemberCard levelName={view.levelName} themeColor="#6366f1" customerName={view.customerName} number={view.card.membershipNumber} expiry={view.card.expiryDate || "Lifetime"} /><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => act("reprintCard", view.id)}><Printer className="h-3.5 w-3.5" /> Reprint</Button></div></div>}
              {view.receipt && <div className="rounded-lg border border-border bg-surface-2/40 p-3 text-sm"><h4 className="mb-1.5 text-2xs font-bold uppercase text-subtle">Fee Receipt</h4><Row k={view.receipt.receiptNo} v={fm(view.receipt.netAmount)} /><div className="text-2xs text-muted">{view.receipt.receiptDate} · {view.receipt.paymentMode} · Journal {view.receipt.journalRef || "—"}</div></div>}
              <div><h4 className="mb-1.5 text-2xs font-bold uppercase text-subtle">History</h4><div className="space-y-1">{view.history.map((h, i) => <div key={i} className="flex items-center justify-between border-b border-border py-1 text-2xs last:border-0"><span className="font-medium text-foreground">{h.action}</span><span className="text-subtle">{h.toStatus} · {new Date(h.at).toLocaleString()}</span></div>)}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ DASHBOARD ============================ */
function DashboardTab() {
  const [d, setD] = useState<RegDashboard | null>(null);
  useEffect(() => { (async () => { const j = await fetch(`${API}/dashboard`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setD(j.data); })(); }, []);
  if (!d) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  const maxL = Math.max(1, ...d.byLevel.map((x) => x.value));
  const Stat = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><div className={cn("text-lg font-bold tabular-nums", tone || "text-foreground")}>{value}</div><div className="text-2xs font-medium text-muted">{label}</div></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total Members" value={d.totalMembers} /><Stat label="New Today" value={d.newToday} tone="text-primary" /><Stat label="Active" value={d.activeMembers} tone="text-success" /><Stat label="Expired" value={d.expiredMembers} tone="text-warning" /><Stat label="Pending Approval" value={d.pendingApproval} /><Stat label="Revenue" value={fm(d.revenue)} tone="text-primary" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-2 text-sm font-bold text-foreground">Membership by Level</h3><div className="space-y-1.5">{d.byLevel.map((b) => <div key={b.name} className="flex items-center gap-2 text-2xs"><span className="w-24 truncate text-muted">{b.name}</span><div className="h-3 flex-1 rounded bg-surface-2"><div className="h-3 rounded bg-primary" style={{ width: `${(b.value / maxL) * 100}%` }} /></div><span className="w-8 text-right tabular-nums font-semibold">{b.value}</span></div>)}{!d.byLevel.length && <div className="py-4 text-center text-muted">No active members.</div>}</div></div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-2 text-sm font-bold text-foreground">Membership by Branch</h3><div className="space-y-1">{d.byBranch.map((b) => <div key={b.name} className="flex justify-between border-b border-border py-1 text-sm last:border-0"><span className="text-foreground">{b.name}</span><span className="font-semibold text-muted">{b.value}</span></div>)}{!d.byBranch.length && <div className="py-4 text-center text-sm text-muted">No branch data.</div>}</div></div>
      </div>
    </div>
  );
}

/* ============================ REPORTS ============================ */
function ReportsTab() {
  const [type, setType] = useState<RegReportType>("register");
  const [data, setData] = useState<ReportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => { setBusy(true); const j = await fetch(`${API}/report?report=${type}`, { cache: "no-store" }).then((r) => r.json()); setBusy(false); if (j.ok) setData(j.data); }, [type]);
  useEffect(() => { run(); }, [run]);
  const cols = useMemo(() => (data ? data.columns.map((c, i) => ({ key: String(i), label: c })) : []), [data]);
  const objRows = useMemo(() => (data ? data.rows.map((r) => Object.fromEntries(r.map((v, i) => [String(i), v]))) : []), [data]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as RegReportType)} className={cn(inp, "w-60")}>{REG_REPORT_TYPES.map((r) => <option key={r} value={r}>{REG_REPORT_LABELS[r]}</option>)}</select>
        <Button size="sm" variant="outline" onClick={run}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => data && downloadCsv(cols, objRows, `${type}.csv`)} disabled={!data}><Download className="h-3.5 w-3.5" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => data && downloadExcel(cols, objRows, `${type}.xls`, { title: data.title })} disabled={!data}><Download className="h-3.5 w-3.5" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={() => data && printTable({ title: data.title, columns: cols, rows: objRows })} disabled={!data}><Printer className="h-3.5 w-3.5" /> PDF</Button>
        </div>
      </div>
      <div className="overflow-auto rounded-2xl border border-border bg-card shadow-sm">
        {busy ? <div className="py-16 text-center text-sm text-muted">Loading…</div> : data && (
          <table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">{data.columns.map((c, i) => <th key={i} className="px-3 py-2.5">{c}</th>)}</tr></thead>
            <tbody>{data.rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0">{r.map((v, j) => <td key={j} className="px-3 py-2 text-foreground">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</td>)}</tr>)}{!data.rows.length && <tr><td colSpan={data.columns.length || 1} className="px-4 py-12 text-center text-sm text-muted">No data.</td></tr>}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
