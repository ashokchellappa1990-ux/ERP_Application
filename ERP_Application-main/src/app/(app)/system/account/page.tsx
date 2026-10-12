"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Network, Building2, GitBranch, Plus, X, CheckCircle2, Star, Info,
  AlertCircle, Landmark, Pencil, ArrowRight, CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";

interface Branch { id: number; name: string; code: string; type: string; city: string; state: string; gstin: string; isDefault: boolean; status: string; hierarchyLevel?: number; parentBranchId?: number | null }
interface Business { id: number; name: string; legalName: string; gstNumber: string; pan: string; isDefault: boolean; status: string; branches: Branch[] }
interface Tenant { id: number; name: string; slug: string; plan: string; status: string; trialEndsAt: string | null; maxBranches: number }
interface Scope { tenantId: number; businessId: number | null; branchId: number | null }

type Modal = { kind: "business" } | { kind: "branch"; businessId: number; businessName: string } | null;

export default function AccountTenantPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [scope, setScope] = useState<Scope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [editTenant, setEditTenant] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [savingTenant, setSavingTenant] = useState(false);

  async function saveTenant() {
    if (!tenantName.trim()) return;
    setSavingTenant(true); setError("");
    try {
      const j = await fetch("/api/system/tenant", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: tenantName }) }).then((r) => r.json());
      if (!j.ok) { setError(j.message || "Could not update the account."); return; }
      setEditTenant(false);
      await load();
    } catch { setError("Network error."); } finally { setSavingTenant(false); }
  }

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/system/tenant", { cache: "no-store" }).then((r) => r.json());
      if (j.ok) { setTenant(j.tenant); setBusinesses(j.businesses); setScope(j.scope); }
      else setError(j.message || "Could not load account.");
    } catch { setError("Network error."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setDefaultBusiness(id: number) {
    setError("");
    const j = await fetch(`/api/system/businesses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ makeDefault: true }) }).then((r) => r.json());
    if (!j.ok) { setError(j.message); return; }
    await load();
  }
  async function setDefaultBranch(id: number) {
    setError("");
    const j = await fetch(`/api/system/branches/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ makeDefault: true }) }).then((r) => r.json());
    if (!j.ok) { setError(j.message); return; }
    await load();
  }

  if (loading) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading account…" size="sm" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Account &amp; Tenant</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Network className="h-5 w-5 text-primary" /> Account &amp; Tenant</h1>
        <p className="mt-0.5 text-sm text-muted">Your subscriber account, the businesses under it, and each business&apos;s branches.</p>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-2.5 text-sm font-medium text-danger"><AlertCircle className="h-4 w-4 shrink-0" /> {error}</div>}

      {/* Educational: what is a tenant vs business */}
      <SectionCard icon={Info} title="Understanding your account structure">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-3 text-sm leading-relaxed text-foreground">
            <p><strong>Tenant</strong> is your <strong>subscriber account</strong> — the top-level entity created when you sign up. It owns your subscription, plan, users and all data. Every record in the system carries a <code className="rounded bg-surface-2 px-1 text-xs">tenantId</code> so one account&apos;s data is fully isolated from every other.</p>
            <p>A <strong>Business</strong> (the <em>Business Setup</em>) is a <strong>legal company / GST entity</strong> that operates under your tenant. Most accounts have <strong>one</strong> business — but a tenant can hold <strong>several</strong> (e.g. a group running multiple firms).</p>
            <p>A <strong>Branch</strong> is a <strong>physical location</strong> (store, warehouse, head office) of a business. Operational data — sales, stock, GRN, petty cash — belongs to a branch.</p>
            <div className="flex items-start gap-2 rounded-lg bg-info-subtle/60 p-3 text-2xs text-info">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span><strong>Tenant vs Business Setup:</strong> the tenant is the <em>account</em>; the Business Setup configures a <em>business</em> within it. If you have a single business, completing Business Setup creates that business automatically — no separate step.</span>
            </div>
          </div>
          {/* Hierarchy diagram */}
          <div className="rounded-xl border border-border bg-surface-2/40 p-4">
            <p className="mb-3 text-2xs font-semibold uppercase tracking-wider text-subtle">Hierarchy &amp; data segregation</p>
            <Tier icon={Landmark} color="text-primary" label="Tenant" sub="Account · subscription · users" tag="tenantId" />
            <Connector />
            <Tier icon={Building2} color="text-secondary" label="Business" sub="GST / PAN entity (1 or many)" tag="businessId" indent={1} />
            <Connector indent={1} />
            <Tier icon={GitBranch} color="text-accent" label="Branch" sub="Location · sales · stock" tag="branchId" indent={2} />
            <p className="mt-3 text-2xs text-muted">Queries filter by <code className="rounded bg-surface-2 px-1">tenantId → businessId → branchId</code>, so multi-business and multi-branch data never mix.</p>
          </div>
        </div>
      </SectionCard>

      {/* Tenant card */}
      {tenant && (
        <SectionCard icon={Landmark} title="Tenant (Account)"
          action={<button onClick={() => { setTenantName(tenant.name); setEditTenant(true); }} className="inline-flex items-center gap-1 text-2xs font-semibold text-muted hover:text-primary"><Pencil className="h-3.5 w-3.5" /> Edit details</button>}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Account name" value={tenant.name} />
            <Field label="Account ID / slug" value={tenant.slug} mono />
            <div><p className="text-2xs font-semibold text-muted">Plan</p><div className="mt-1"><Badge tone="primary">{tenant.plan}</Badge> <Badge tone={tenant.status === "active" ? "success" : "warning"}>{tenant.status}</Badge></div></div>
            <Field label="Branch limit (plan)" value={String(tenant.maxBranches)} />
          </div>
        </SectionCard>
      )}

      {/* Businesses + branches */}
      <SectionCard icon={Building2} title={`Businesses (${businesses.length})`} allowOverflow
        action={<Button size="sm" onClick={() => router.push("/setup")}><Plus className="h-3.5 w-3.5" /> Add Business</Button>}>
        <div className="space-y-4">
          {businesses.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/50 px-4 py-3">
                <Building2 className="h-4 w-4 text-secondary" />
                <span className="font-semibold text-foreground">{b.name}</span>
                {b.isDefault && <Badge tone="primary"><Star className="mr-0.5 h-3 w-3" /> Default</Badge>}
                <Badge tone={b.status === "active" ? "success" : "neutral"}>{b.status}</Badge>
                {scope?.businessId === b.id && <Badge tone="info">Active</Badge>}
                {b.gstNumber && <span className="text-2xs text-muted">GST {b.gstNumber}</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  {!b.isDefault && <button onClick={() => setDefaultBusiness(b.id)} className="rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary">Make default</button>}
                  <button onClick={() => setModal({ kind: "branch", businessId: b.id, businessName: b.name })} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary"><Plus className="h-3 w-3" /> Branch</button>
                </div>
              </div>
              {/* Branches */}
              <div className="divide-y divide-border">
                {b.branches.map((br) => (
                  <div key={br.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm" style={{ paddingLeft: 16 + Math.max(0, (br.hierarchyLevel ?? 1) - 1) * 22 }}>
                    {(br.hierarchyLevel ?? 1) > 1 && <CornerDownRight className="h-3.5 w-3.5 text-subtle" />}
                    <GitBranch className="h-3.5 w-3.5 text-accent" />
                    <span className="font-medium text-foreground">{br.name}</span>
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-muted">{br.code}</span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs text-muted">{br.type}</span>
                    {br.isDefault && <Badge tone="primary">Default</Badge>}
                    {scope?.branchId === br.id && <Badge tone="info">Active</Badge>}
                    {(br.city || br.state) && <span className="text-2xs text-muted">{[br.city, br.state].filter(Boolean).join(", ")}</span>}
                    {!br.isDefault && <button onClick={() => setDefaultBranch(br.id)} className="ml-auto rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary">Make default</button>}
                  </div>
                ))}
                {b.branches.length === 0 && <div className="px-4 py-3 text-2xs text-muted">No branches yet.</div>}
              </div>
            </div>
          ))}
          {businesses.length === 0 && <div className="py-8 text-center text-sm text-muted">No businesses yet. Click <strong>Add Business</strong> or complete Business Setup.</div>}
        </div>
      </SectionCard>

      {editTenant && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setEditTenant(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><Landmark className="h-4 w-4" /></span>
              <h3 className="flex-1 text-sm font-bold text-foreground">Edit Account (Tenant)</h3>
              <button onClick={() => setEditTenant(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Account Name <span className="text-danger">*</span></label><input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none" /></div>
              <p className="rounded-lg bg-info-subtle/60 p-2.5 text-2xs text-info">This is your subscriber account name. Plan &amp; status are managed by your subscription. To edit a <strong>business&apos;s</strong> legal details, use Business Setup.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="ghost" size="md" onClick={() => setEditTenant(false)}>Cancel</Button>
              <Button size="md" onClick={saveTenant} disabled={!tenantName.trim() || savingTenant}><CheckCircle2 className="h-4 w-4" /> {savingTenant ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </div>
      )}

      {modal && <EntityModal modal={modal} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await load(); }} onError={setError} />}
    </div>
  );
}

/* ---------- Add Business / Add Branch modal ---------- */
function EntityModal({ modal, onClose, onSaved, onError }: { modal: NonNullable<Modal>; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const isBiz = modal.kind === "business";
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", legalName: "", gstNumber: "", pan: "", code: "", type: "Retail Outlet", city: "", state: "", gstin: "" });
  const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";

  const valid = isBiz ? f.name.trim() : f.name.trim() && f.code.trim();
  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      const url = isBiz ? "/api/system/businesses" : "/api/system/branches";
      const body = isBiz
        ? { name: f.name, legalName: f.legalName, gstNumber: f.gstNumber, pan: f.pan }
        : { businessId: (modal as { businessId: number }).businessId, name: f.name, code: f.code, type: f.type, city: f.city, state: f.state, gstin: f.gstin };
      const j = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (!j.ok) { onError(j.message || "Could not save."); return; }
      onSaved();
    } catch { onError("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white">{isBiz ? <Building2 className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}</span>
          <h3 className="flex-1 text-sm font-bold text-foreground">{isBiz ? "Add Business" : `Add Branch — ${(modal as { businessName: string }).businessName}`}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div><label className="mb-1 block text-2xs font-semibold text-muted">{isBiz ? "Business Name" : "Branch Name"} <span className="text-danger">*</span></label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={isBiz ? "e.g. Acme Retail Pvt Ltd" : "e.g. Anna Nagar Store"} className={inp} /></div>
          {isBiz ? (
            <>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Legal Name</label><input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-2xs font-semibold text-muted">GST Number</label><input value={f.gstNumber} onChange={(e) => setF({ ...f, gstNumber: e.target.value })} className={cn(inp, "uppercase")} /></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">PAN</label><input value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value })} className={cn(inp, "uppercase")} /></div>
              </div>
              <p className="rounded-lg bg-info-subtle/60 p-2.5 text-2xs text-info">A default <strong>Main Branch</strong> is created automatically for this business.</p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Code <span className="text-danger">*</span></label><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="e.g. CHN-02" className={cn(inp, "uppercase")} /></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Type</label><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inp}><option>Retail Outlet</option><option>Warehouse Outlet</option><option>Head Office</option><option>Franchise</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-2xs font-semibold text-muted">City</label><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={inp} /></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">State</label><input value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} className={inp} /></div>
              </div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">GSTIN</label><input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} className={cn(inp, "uppercase")} /></div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={save} disabled={!valid || busy}><CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : isBiz ? "Add Business" : "Add Branch"}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- small presentational helpers ---------- */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-2xs font-semibold text-muted">{label}</p><p className={cn("mt-1 text-sm text-foreground", mono && "font-mono text-xs")}>{value}</p></div>;
}
function Tier({ icon: Icon, color, label, sub, tag, indent = 0 }: { icon: typeof Landmark; color: string; label: string; sub: string; tag: string; indent?: number }) {
  return (
    <div className="flex items-center gap-2.5" style={{ marginLeft: indent * 20 }}>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface", color)}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-muted">{tag}</span>
        <p className="text-2xs text-muted">{sub}</p>
      </div>
    </div>
  );
}
function Connector({ indent = 0 }: { indent?: number }) {
  return <div className="my-1 h-3 w-px bg-border-strong" style={{ marginLeft: indent * 20 + 15 }} />;
}
