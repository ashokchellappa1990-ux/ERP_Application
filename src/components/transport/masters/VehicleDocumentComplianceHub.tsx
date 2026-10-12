"use client";

import { useCallback, useEffect, useState } from "react";
import { FileCheck2, Plus, Eye, Search, X, RefreshCw, Ban, FileText, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  RENEWAL_STATUS_OPTS, ENFORCEMENT_MODE_OPTS, vehicleDocumentInput, documentTypeInput, renewalCompleteInput, complianceConfigInput,
  type VehicleDocumentRow, type VehicleDocumentDetail, type DocumentTypeRow, type RenewalRow, type ComplianceConfigRow,
  type DashboardStats, type VehicleComplianceRow, type VehicleDocumentInput, type DocumentTypeInput, type RenewalCompleteInput, type ComplianceConfigInput, type AttachmentInput,
} from "@/lib/contracts/vehicleDocument";

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  Valid: "success", "Expiring Soon": "warning", "Due Today": "warning", Expired: "danger", Missing: "neutral", "Renewal Pending": "warning",
  Compliant: "success", "Non-Compliant": "danger",
};
interface VehicleOption { id: number; vehicleNo: string; vehicleType: string | null; ownerType: string; status: string; transportCompanyName: string | null }

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "documents", label: "Vehicle Documents" },
  { key: "types", label: "Document Types" },
  { key: "compliance", label: "Expiry & Compliance" },
  { key: "renewals", label: "Renewals" },
  { key: "history", label: "History" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function VehicleDocumentComplianceHub() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [types, setTypes] = useState<DocumentTypeRow[]>([]);
  const toast = useToast();

  const loadMasters = useCallback(async () => {
    const [v, t] = await Promise.all([
      fetch("/api/transport/masters/vehicle?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/transport/vehicle-document/document-type", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    if (v?.ok) setVehicles(v.rows);
    if (t?.ok) setTypes(t.rows);
  }, []);
  useEffect(() => { loadMasters(); }, [loadMasters]);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Vehicle Document &amp; Compliance</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileCheck2 className="h-5 w-5 text-primary" /> Vehicle Document &amp; Compliance</h1>
        <p className="mt-0.5 text-sm text-muted">Manage vehicle documents, renewals, expiry and regulatory compliance.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("shrink-0 border-b-2 px-3.5 py-2 text-sm font-semibold transition", tab === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>{t.label}</button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "documents" && <DocumentsTab vehicles={vehicles} types={types} toast={toast} />}
      {tab === "types" && <TypesTab types={types} vehicles={vehicles} reload={loadMasters} toast={toast} />}
      {tab === "compliance" && <ComplianceTab vehicles={vehicles} toast={toast} />}
      {tab === "renewals" && <RenewalsTab toast={toast} />}
      {tab === "history" && <HistoryTab vehicles={vehicles} />}
    </div>
  );
}

/* ==================================================================== Dashboard */
function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warning" | "success" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <p className={cn("text-2xl font-bold tabular-nums", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground")}>{value}</p>
      <p className="mt-1 text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
    </div>
  );
}

function DashboardTab() {
  const [d, setD] = useState<DashboardStats | null>(null);
  useEffect(() => { fetch("/api/transport/vehicle-document/compliance", { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setD(j)).catch(() => {}); }, []);
  if (!d) return <div className="py-16"><AppLoader label="Loading dashboard…" /></div>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Vehicles" value={d.totalVehicles} />
        <StatCard label="Compliant" value={d.compliantVehicles} tone="success" />
        <StatCard label="Expiring Soon" value={d.expiringSoon} tone="warning" />
        <StatCard label="Expired" value={d.expired} tone="danger" />
        <StatCard label="Renewals Pending" value={d.renewalsPending} tone="warning" />
        <StatCard label="Documents Missing" value={d.documentsMissing} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-foreground">Compliance Status</h3>
          <div className="space-y-2.5 text-sm">
            {([["Compliant", d.statusBreakdown.compliant, "success"], ["Expiring Soon", d.statusBreakdown.expiringSoon, "warning"], ["Expired / Non-Compliant", d.statusBreakdown.expired, "danger"], ["Missing", d.statusBreakdown.missing, "neutral"], ["Under Renewal", d.statusBreakdown.underRenewal, "warning"]] as const).map(([label, val, tone]) => (
              <div key={label} className="flex items-center justify-between"><span className="text-muted">{label}</span><Badge tone={tone}>{val}</Badge></div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-foreground">Expiry Summary</h3>
          <div className="space-y-2.5 text-sm">
            {([["Today", d.expirySummary.today], ["Next 7 Days", d.expirySummary.next7], ["Next 30 Days", d.expirySummary.next30], ["Next 60 Days", d.expirySummary.next60], ["Next 90 Days", d.expirySummary.next90]] as const).map(([label, val]) => (
              <div key={label} className="flex items-center justify-between"><span className="text-muted">{label}</span><span className="font-bold text-foreground">{val}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <h3 className="border-b border-border px-5 py-3 text-sm font-bold text-foreground">Vehicles Requiring Attention</h3>
        {d.ranking.length === 0 ? <p className="p-8 text-center text-sm text-muted">All vehicles compliant — nothing needs attention.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-4 py-2.5 text-left">Vehicle</th><th className="px-4 py-2.5 text-left">Status</th><th className="px-4 py-2.5 text-left">Issue(s)</th></tr></thead>
            <tbody>{d.ranking.map((r: VehicleComplianceRow) => (
              <tr key={r.vehicleId} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{r.vehicleNo}</td>
                <td className="px-4 py-2.5"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></td>
                <td className="px-4 py-2.5 text-2xs text-muted">{r.issues.join("; ")}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

/* ============================================================== Documents */
function DocumentsTab({ vehicles, types, toast }: { vehicles: VehicleOption[]; types: DocumentTypeRow[]; toast: ReturnType<typeof useToast> }) {
  const [rows, setRows] = useState<VehicleDocumentRow[] | null>(null);
  const [q, setQ] = useState(""); const [vehicleId, setVehicleId] = useState(""); const [typeId, setTypeId] = useState(""); const [status, setStatus] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams(); if (q) p.set("q", q); if (vehicleId) p.set("vehicleId", vehicleId); if (typeId) p.set("documentTypeId", typeId); if (status !== "All") p.set("status", status);
    setRows(null);
    fetch(`/api/transport/vehicle-document?${p}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])).catch(() => setRows([]));
  }, [q, vehicleId, typeId, status]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function renew(id: number) {
    const j = await fetch("/api/transport/vehicle-document/renewal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleDocumentId: id }) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { toast.success("Renewal initiated — continue it from the Renewals tab."); load(); } else toast.error(j.message || "Could not initiate renewal.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vehicle, doc no…" className={cn(inp, "pl-9")} /></div>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={cn(inp, "w-auto")}><option value="">All Vehicles</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={cn(inp, "w-auto")}><option value="">All Document Types</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inp, "w-auto")}>{["All", "Valid", "Expiring Soon", "Due Today", "Expired", "Renewal Pending"].map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Vehicle Document</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b border-border bg-surface-2/40 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
            <th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Document Type</th><th className="px-4 py-3">Document No.</th><th className="px-4 py-3">Issue Date</th><th className="px-4 py-3">Expiry Date</th><th className="px-4 py-3 text-center">Days Remaining</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={8} className="px-4 py-10"><AppLoader label="Loading documents…" size="sm" /></td></tr>}
            {rows?.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                <td className="px-4 py-3 font-medium text-foreground">{r.vehicleNo}</td>
                <td className="px-4 py-3 text-muted">{r.documentTypeName}{r.mandatory && <span className="ml-1 text-2xs text-danger">*</span>}</td>
                <td className="px-4 py-3 text-2xs text-muted">{r.documentNo ?? "—"}</td>
                <td className="px-4 py-3 text-2xs text-muted">{r.issueDate ?? "—"}</td>
                <td className="px-4 py-3 text-2xs text-muted">{r.expiryDate ?? "—"}</td>
                <td className="px-4 py-3 text-center text-2xs text-muted">{r.daysRemaining ?? "—"}</td>
                <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.renewalStatus ? "Renewal Pending" : r.computedStatus] ?? "neutral"}>{r.renewalStatus ? "Renewal Pending" : r.computedStatus}</Badge></td>
                <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                  <button onClick={() => setViewId(r.id)} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary hover:bg-primary hover:text-white"><Eye className="h-4 w-4" /></button>
                  {!r.renewalStatus && r.dbStatus === "Active" && <button onClick={() => renew(r.id)} title="Renew" className="grid h-8 w-8 place-items-center rounded-md border border-warning/30 bg-warning/10 text-warning hover:bg-warning hover:text-white"><RefreshCw className="h-4 w-4" /></button>}
                </div></td>
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">No vehicle documents yet. Click <b>Add Vehicle Document</b> to add the first one.</td></tr>}
          </tbody>
        </table>
      </div></div>

      {addOpen && <AddDocumentModal vehicles={vehicles} types={types} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} toast={toast} />}
      {viewId != null && <ViewDocumentModal id={viewId} onClose={() => setViewId(null)} onChanged={load} toast={toast} />}
    </div>
  );
}

function AddDocumentModal({ vehicles, types, onClose, onSaved, toast }: { vehicles: VehicleOption[]; types: DocumentTypeRow[]; onClose: () => void; onSaved: () => void; toast: ReturnType<typeof useToast> }) {
  const [f, setF] = useState<VehicleDocumentInput>({ vehicleId: 0, documentTypeId: 0, documentNo: "", issueDate: "", expiryDate: "", issuingAuthority: "", placeOfIssue: "", renewalRequired: true, renewalFrequencyMonths: null, cost: 0, tax: 0, otherCharges: 0, paymentDate: "", paymentReference: "", remarks: "", attachments: [] });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof VehicleDocumentInput>(k: K, v: VehicleDocumentInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const selectedVehicle = vehicles.find((v) => v.id === f.vehicleId);
  const selectedType = types.find((t) => t.id === f.documentTypeId);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append("file", file);
      const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
      if (j?.ok) set("attachments", [...f.attachments, j.file as AttachmentInput]); else toast.error(j?.message || "Upload failed.");
    }
    setUploading(false);
  }

  async function save() {
    const parsed = vehicleDocumentInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/vehicle-document", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Add Vehicle Document</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
          <div>
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Vehicle Details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Vehicle *</label><select value={f.vehicleId || ""} onChange={(e) => set("vehicleId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select></div>
              <div><label className={lbl}>Vehicle Type</label><input readOnly value={selectedVehicle?.vehicleType ?? "—"} className={cn(inp, "text-subtle")} /></div>
              <div><label className={lbl}>Ownership</label><input readOnly value={selectedVehicle?.ownerType ?? "—"} className={cn(inp, "text-subtle")} /></div>
              <div><label className={lbl}>Transporter</label><input readOnly value={selectedVehicle?.transportCompanyName ?? "— Own —"} className={cn(inp, "text-subtle")} /></div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Document Details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Document Type *</label><select value={f.documentTypeId || ""} onChange={(e) => set("documentTypeId", Number(e.target.value) || 0)} className={inp}><option value="">— Select —</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.mandatory ? " *" : ""}</option>)}</select></div>
              <div><label className={lbl}>Document Number</label><input value={f.documentNo ?? ""} onChange={(e) => set("documentNo", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Issue Date</label><input type="date" value={f.issueDate ?? ""} onChange={(e) => set("issueDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Expiry Date{selectedType?.expiryRequired ? " *" : ""}</label><input type="date" value={f.expiryDate ?? ""} onChange={(e) => set("expiryDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Issuing Authority</label><input value={f.issuingAuthority ?? ""} onChange={(e) => set("issuingAuthority", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Place of Issue</label><input value={f.placeOfIssue ?? ""} onChange={(e) => set("placeOfIssue", e.target.value)} className={inp} /></div>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"><span className="text-foreground">Renewal Required</span><input type="checkbox" checked={f.renewalRequired} onChange={(e) => set("renewalRequired", e.target.checked)} className="h-4 w-4 accent-primary" /></label>
              <div><label className={lbl}>Renewal Frequency (months)</label><input type="number" min={0} value={f.renewalFrequencyMonths ?? ""} onChange={(e) => set("renewalFrequencyMonths", e.target.value ? Number(e.target.value) : null)} className={inp} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Financial Details</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className={lbl}>Document/Renewal Cost (₹)</label><input type="number" min={0} value={f.cost || ""} onChange={(e) => set("cost", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Tax (₹)</label><input type="number" min={0} value={f.tax || ""} onChange={(e) => set("tax", Number(e.target.value) || 0)} className={inp} /></div>
              <div><label className={lbl}>Payment Date</label><input type="date" value={f.paymentDate ?? ""} onChange={(e) => set("paymentDate", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>Payment Reference</label><input value={f.paymentReference ?? ""} onChange={(e) => set("paymentReference", e.target.value)} className={inp} /></div>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><p className="text-2xs font-bold uppercase tracking-wide text-subtle">Attachment</p><label className="cursor-pointer text-2xs font-semibold text-primary hover:underline"><Plus className="mr-0.5 inline h-3.5 w-3.5" />{uploading ? "Uploading…" : "Upload"}<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label></div>
            {f.attachments.length === 0 ? <p className="text-2xs text-muted">No file uploaded yet.</p> : (
              <div className="space-y-1.5">{f.attachments.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-1.5"><a href={a.fileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-foreground hover:text-primary"><FileText className="h-4 w-4 shrink-0 text-muted" /><span className="truncate">{a.fileName}</span></a><button type="button" onClick={() => set("attachments", f.attachments.filter((_, j) => j !== i))} className="shrink-0 text-muted hover:text-danger"><X className="h-4 w-4" /></button></div>
              ))}</div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Document"}</Button></div>
      </div>
    </div>
  );
}

function ViewDocumentModal({ id, onClose, onChanged, toast }: { id: number; onClose: () => void; onChanged: () => void; toast: ReturnType<typeof useToast> }) {
  const [detail, setDetail] = useState<VehicleDocumentDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [renewalId, setRenewalId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch(`/api/transport/vehicle-document/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setDetail(j.row); }).catch(() => {});
    fetch(`/api/transport/vehicle-document/renewal?status=All`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { const r = (j.rows as RenewalRow[]).find((x) => x.vehicleDocumentId === id && !["Completed", "Rejected", "Cancelled"].includes(x.status)); setRenewalId(r?.id ?? null); } }).catch(() => {});
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function cancelDoc() {
    if (!reason.trim()) { toast.error("A reason is required."); return; }
    const j = await fetch(`/api/transport/vehicle-document/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancellationReason: reason }) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { toast.success(j.message || "Cancelled."); setCancelling(false); load(); onChanged(); } else toast.error(j.message || "Could not cancel.");
  }

  if (!detail) return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}><div className="rounded-2xl border border-border bg-card p-10 shadow-2xl" onClick={(e) => e.stopPropagation()}><AppLoader label="Loading…" size="sm" /></div></div>
  );

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">{detail.documentTypeName} — {detail.vehicleNo}<Badge tone={STATUS_TONE[detail.computedStatus] ?? "neutral"}>{detail.computedStatus}</Badge></h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <RO k="Document No." v={detail.documentNo ?? "—"} /><RO k="Issue Date" v={detail.issueDate ?? "—"} /><RO k="Expiry Date" v={detail.expiryDate ?? "—"} />
            <RO k="Days Remaining" v={detail.daysRemaining != null ? String(detail.daysRemaining) : "—"} /><RO k="Issuing Authority" v={detail.issuingAuthority ?? "—"} /><RO k="Version" v={`v${detail.versionNo}`} />
            <RO k="Total Cost" v={`₹${detail.totalCost.toLocaleString()}`} /><RO k="Status" v={detail.dbStatus} /><RO k="Renewal Status" v={detail.renewalStatus ?? "—"} />
          </div>
          {detail.remarks && <RO k="Remarks" v={detail.remarks} />}

          {detail.attachments.length > 0 && (
            <div><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">Attachments</p>
              <div className="space-y-1.5">{detail.attachments.map((a) => (
                <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-1.5 text-sm text-foreground hover:text-primary"><FileText className="h-4 w-4 shrink-0 text-muted" /><span className="truncate">{a.fileName}</span></a>
              ))}</div>
            </div>
          )}

          {detail.versions.length > 1 && (
            <div><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">Version History</p>
              <div className="overflow-hidden rounded-lg border border-border"><table className="w-full text-2xs">
                <thead><tr className="border-b border-border bg-surface-2/40 text-left uppercase tracking-wide text-muted"><th className="px-3 py-2">Version</th><th className="px-3 py-2">Doc No.</th><th className="px-3 py-2">Expiry</th><th className="px-3 py-2">Status</th></tr></thead>
                <tbody>{detail.versions.map((v) => (
                  <tr key={v.id} className={cn("border-b border-border/60 last:border-0", v.id === detail.id && "bg-primary-subtle/20")}>
                    <td className="px-3 py-1.5">v{v.versionNo}</td><td className="px-3 py-1.5">{v.documentNo ?? "—"}</td><td className="px-3 py-1.5">{v.expiryDate ?? "—"}</td><td className="px-3 py-1.5"><Badge tone={STATUS_TONE[v.status === "Active" ? v.computedStatus : v.status] ?? "neutral"}>{v.status}</Badge></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          )}

          {renewalId != null && (
            <div className="rounded-lg border border-warning/30 bg-warning-subtle/40 p-3">
              <p className="mb-2 text-2xs font-semibold text-warning">A renewal is in progress for this document.</p>
              <Button size="sm" onClick={() => setCompleteOpen(true)}>Complete Renewal</Button>
            </div>
          )}

          {detail.dbStatus === "Active" && (
            <div className="border-t border-border pt-3">
              {!cancelling ? <Button size="sm" variant="danger" onClick={() => setCancelling(true)}><Ban className="h-4 w-4" /> Cancel Document</Button> : (
                <div className="space-y-2">
                  <div><label className={lbl}>Cancellation Reason *</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={cn(inp, "h-auto py-2")} /></div>
                  <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setCancelling(false)}>Close</Button><Button size="sm" variant="danger" onClick={cancelDoc}>Confirm Cancel</Button></div>
                </div>
              )}
            </div>
          )}
          {detail.cancelledAt && <RO k="Cancelled" v={`${detail.cancelledByName ?? "—"} · ${new Date(detail.cancelledAt).toLocaleString()}${detail.cancellationReason ? ` — ${detail.cancellationReason}` : ""}`} />}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="outline" size="md" onClick={onClose}>Close</Button></div>
      </div>
      {completeOpen && renewalId != null && <CompleteRenewalModal renewalId={renewalId} onClose={() => setCompleteOpen(false)} onCompleted={() => { setCompleteOpen(false); load(); onChanged(); }} toast={toast} />}
    </div>
  );
}
function RO({ k, v }: { k: string; v: string }) { return <div><p className="text-2xs font-semibold text-muted">{k}</p><p className="text-sm text-foreground">{v}</p></div>; }

/* =========================================================== Document Types */
function TypesTab({ types, vehicles, reload, toast }: { types: DocumentTypeRow[]; vehicles: VehicleOption[]; reload: () => void; toast: ReturnType<typeof useToast> }) {
  const [modal, setModal] = useState<{ id?: number } | null>(null);
  const vehicleTypeOptions = Array.from(new Set(vehicles.map((v) => v.vehicleType).filter((x): x is string => !!x))).sort();

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-foreground">Document Types</h3><Button size="sm" variant="outline" onClick={() => setModal({})}><Plus className="h-3.5 w-3.5" /> New Type</Button></div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-center">Mandatory</th><th className="px-3 py-2 text-center">Expiry Req.</th><th className="px-3 py-2 text-center">Renewal Req.</th><th className="px-3 py-2 text-center">Alert Days</th><th className="px-3 py-2 text-center">In Use</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
            <tbody>{types.map((t) => (
              <tr key={t.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-medium text-foreground">{t.code}</td>
                <td className="px-3 py-2 text-2xs text-muted">{t.name}{t.isSystem && <span className="ml-1 text-subtle">(system)</span>}</td>
                <td className="px-3 py-2 text-center">{t.mandatory ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-center">{t.expiryRequired ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-center">{t.renewalRequired ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-center text-2xs text-muted">{t.defaultAlertDays}</td>
                <td className="px-3 py-2 text-center text-2xs text-muted">{t.docCount}</td>
                <td className="px-3 py-2 text-center"><Badge tone={t.status === "Active" ? "success" : "neutral"}>{t.status}</Badge></td>
                <td className="px-3 py-2 text-right"><button onClick={() => setModal({ id: t.id })} className="text-2xs font-semibold text-primary hover:underline">Edit</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div></div>
      </div>

      <MandatoryConfigPanel types={types} vehicleTypeOptions={vehicleTypeOptions} toast={toast} />

      {modal && <DocumentTypeModal id={modal.id} types={types} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} toast={toast} />}
    </div>
  );
}

function DocumentTypeModal({ id, types, onClose, onSaved, toast }: { id?: number; types: DocumentTypeRow[]; onClose: () => void; onSaved: () => void; toast: ReturnType<typeof useToast> }) {
  const existing = types.find((t) => t.id === id);
  const [f, setF] = useState<DocumentTypeInput>(existing
    ? { code: existing.code, name: existing.name, description: existing.description ?? "", applicableVehicleTypes: existing.applicableVehicleTypes, mandatory: existing.mandatory, expiryRequired: existing.expiryRequired, renewalRequired: existing.renewalRequired, alertEnabled: existing.alertEnabled, defaultAlertDays: existing.defaultAlertDays, status: existing.status as "Active" | "Inactive" }
    : { code: "", name: "", description: "", applicableVehicleTypes: [], mandatory: false, expiryRequired: true, renewalRequired: true, alertEnabled: true, defaultAlertDays: 30, status: "Active" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof DocumentTypeInput>(k: K, v: DocumentTypeInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    const parsed = documentTypeInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch(id ? `/api/transport/vehicle-document/document-type/${id}` : "/api/transport/vehicle-document/document-type", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onSaved(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">{id ? "Edit" : "New"} Document Type</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <div><label className={lbl}>Code *</label><input value={f.code} onChange={(e) => set("code", e.target.value)} disabled={!!id} className={cn(inp, id && "disabled:bg-surface-2/40 disabled:text-muted")} /></div>
          <div><label className={lbl}>Document Type Name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Description</label><input value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Default Alert Before (Days)</label><input type="number" min={0} value={f.defaultAlertDays} onChange={(e) => set("defaultAlertDays", Number(e.target.value) || 0)} className={inp} /></div>
          <div><label className={lbl}>Status</label><select value={f.status} onChange={(e) => set("status", e.target.value as "Active" | "Inactive")} className={inp}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
          <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm sm:col-span-2"><span className="text-foreground">Mandatory by default</span><input type="checkbox" checked={f.mandatory} onChange={(e) => set("mandatory", e.target.checked)} className="h-4 w-4 accent-primary" /></label>
          <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"><span className="text-foreground">Expiry Required</span><input type="checkbox" checked={f.expiryRequired} onChange={(e) => set("expiryRequired", e.target.checked)} className="h-4 w-4 accent-primary" /></label>
          <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"><span className="text-foreground">Renewal Required</span><input type="checkbox" checked={f.renewalRequired} onChange={(e) => set("renewalRequired", e.target.checked)} className="h-4 w-4 accent-primary" /></label>
          <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm sm:col-span-2"><span className="text-foreground">Alert Enabled</span><input type="checkbox" checked={f.alertEnabled} onChange={(e) => set("alertEnabled", e.target.checked)} className="h-4 w-4 accent-primary" /></label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}

function MandatoryConfigPanel({ types, vehicleTypeOptions, toast }: { types: DocumentTypeRow[]; vehicleTypeOptions: string[]; toast: ReturnType<typeof useToast> }) {
  const [vehicleType, setVehicleType] = useState("");
  const [customType, setCustomType] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const effectiveType = vehicleType || customType.trim();

  useEffect(() => {
    if (!effectiveType) { setSelected(new Set()); return; }
    fetch(`/api/transport/vehicle-document/mandatory-config?vehicleType=${encodeURIComponent(effectiveType)}`, { cache: "no-store" })
      .then((r) => r.json()).then((j) => { if (j.ok) setSelected(new Set(j.rows.filter((r: { mandatory: boolean }) => r.mandatory).map((r: { documentTypeId: number }) => r.documentTypeId))); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveType]);

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function save() {
    if (!effectiveType) { toast.error("Select or type a vehicle type first."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/vehicle-document/mandatory-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleType: effectiveType, documentTypeIds: Array.from(selected) }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) toast.success(j.message || "Saved."); else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-bold text-foreground">Mandatory Document Configuration</h3>
      <p className="mb-3 text-2xs text-muted">Choose which documents are mandatory for a given vehicle type — different vehicle types can require different documents.</p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div><label className={lbl}>Vehicle Type</label><select value={vehicleType} onChange={(e) => { setVehicleType(e.target.value); setCustomType(""); }} className={cn(inp, "w-52")}><option value="">— Choose —</option>{vehicleTypeOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
        <span className="pb-2 text-2xs text-muted">or</span>
        <div><label className={lbl}>Type a Vehicle Type</label><input value={customType} onChange={(e) => { setCustomType(e.target.value); setVehicleType(""); }} placeholder="e.g. Tipper" className={cn(inp, "w-52")} /></div>
      </div>
      {effectiveType && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {types.filter((t) => t.status === "Active").map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 accent-primary" />{t.name}</label>
            ))}
          </div>
          <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : `Save for ${effectiveType}`}</Button>
        </>
      )}
    </div>
  );
}

/* ======================================================== Expiry & Compliance */
function ComplianceTab({ vehicles, toast }: { vehicles: VehicleOption[]; toast: ReturnType<typeof useToast> }) {
  const [d, setD] = useState<DashboardStats | null>(null);
  const [filter, setFilter] = useState("All");
  const [configOpen, setConfigOpen] = useState(false);
  const load = useCallback(() => { fetch("/api/transport/vehicle-document/compliance", { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setD(j)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="py-16"><AppLoader label="Loading…" /></div>;

  const compliantVehicles: VehicleComplianceRow[] = vehicles
    .filter((v) => !d.ranking.some((r) => r.vehicleId === v.id))
    .map((v) => ({ vehicleId: v.id, vehicleNo: v.vehicleNo, vehicleType: v.vehicleType, status: "Compliant" as const, issues: ["All mandatory documents are valid."] }));
  const all = [...d.ranking, ...compliantVehicles];
  const shown = filter === "All" ? all : all.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
          {["All", "Compliant", "Expiring Soon", "Non-Compliant", "Missing"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={cn("px-3 py-1.5 font-semibold transition", filter === s ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{s}</button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}><Settings2 className="h-3.5 w-3.5" /> Compliance Settings</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <div key={r.vehicleId} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between"><span className="font-bold text-foreground">{r.vehicleNo}</span><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status === "Non-Compliant" ? "🔴 " : r.status === "Expiring Soon" ? "🟠 " : r.status === "Missing" ? "⚪ " : "🟢 "}{r.status}</Badge></div>
            <p className="text-2xs text-muted">{r.issues.join("; ")}</p>
          </div>
        ))}
        {shown.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted">No vehicles in this category.</p>}
      </div>

      {configOpen && <ComplianceConfigModal onClose={() => setConfigOpen(false)} toast={toast} />}
    </div>
  );
}

function ComplianceConfigModal({ onClose, toast }: { onClose: () => void; toast: ReturnType<typeof useToast> }) {
  const [f, setF] = useState<ComplianceConfigInput | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/transport/vehicle-document/compliance/config", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setF(j.config as ComplianceConfigRow); }).catch(() => {}); }, []);

  async function save() {
    if (!f) return;
    const parsed = complianceConfigInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch("/api/transport/vehicle-document/compliance/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Saved."); onClose(); } else toast.error(j.message || "Could not save.");
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Compliance Configuration</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        {!f ? <div className="p-8"><AppLoader label="Loading…" size="sm" /></div> : (
          <div className="space-y-3 p-5">
            <p className="text-2xs text-muted">Off by default — enabling this does not change any existing Trip/Sales/Purchase behavior unless those screens explicitly check compliance via <code>checkVehicleCompliance()</code>.</p>
            <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"><span className="text-foreground">Vehicle Compliance Check</span><input type="checkbox" checked={f.checkEnabled} onChange={(e) => setF({ ...f, checkEnabled: e.target.checked })} className="h-4 w-4 accent-primary" /></label>
            {f.checkEnabled && (
              <div><label className={lbl}>Enforcement</label><select value={f.enforcementMode} onChange={(e) => setF({ ...f, enforcementMode: e.target.value as (typeof ENFORCEMENT_MODE_OPTS)[number] })} className={inp}><option value="warning">Warning Only</option><option value="block">Block Transaction</option></select></div>
            )}
            <div><label className={lbl}>"Expiring Soon" Threshold (days)</label><input type="number" min={1} value={f.expiringSoonDays} onChange={(e) => setF({ ...f, expiringSoonDays: Number(e.target.value) || 30 })} className={inp} /></div>
            <div><label className={lbl}>Alert Periods (days before expiry)</label><input value={f.alertDays.join(", ")} onChange={(e) => setF({ ...f, alertDays: e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n)) })} placeholder="90, 60, 30, 15, 7, 1, 0" className={inp} /></div>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button><Button size="sm" onClick={save} disabled={busy || !f}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}

/* ================================================================ Renewals */
function RenewalsTab({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [rows, setRows] = useState<RenewalRow[] | null>(null);
  const [status, setStatus] = useState("All");
  const [completeId, setCompleteId] = useState<number | null>(null);
  const load = useCallback(() => {
    const p = new URLSearchParams(); if (status !== "All") p.set("status", status);
    fetch(`/api/transport/vehicle-document/renewal?${p}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])).catch(() => setRows([]));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  async function advance(id: number, next: string) {
    const j = await fetch(`/api/transport/vehicle-document/renewal/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { toast.success(j.message || "Updated."); load(); } else toast.error(j.message || "Could not update.");
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex overflow-hidden rounded-md border border-border text-2xs">
        {["All", ...RENEWAL_STATUS_OPTS].map((s) => <button key={s} onClick={() => setStatus(s)} className={cn("px-3 py-1.5 font-semibold transition", status === s ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{s}</button>)}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-4 py-3 text-left">Vehicle</th><th className="px-4 py-3 text-left">Document</th><th className="px-4 py-3 text-left">Current Expiry</th><th className="px-4 py-3 text-center">Renewal Status</th><th className="px-4 py-3 text-left">Renewal Date</th><th className="px-4 py-3 text-left">New Expiry</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={7} className="px-4 py-10"><AppLoader label="Loading…" size="sm" /></td></tr>}
            {rows?.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{r.vehicleNo}</td>
                <td className="px-4 py-3 text-muted">{r.documentTypeName}</td>
                <td className="px-4 py-3 text-2xs text-muted">{r.currentExpiry ?? "—"}</td>
                <td className="px-4 py-3 text-center"><Badge tone={r.status === "Completed" ? "success" : r.status === "Rejected" || r.status === "Cancelled" ? "danger" : "warning"}>{r.status}</Badge></td>
                <td className="px-4 py-3 text-2xs text-muted">{r.renewalDate ?? "—"}</td>
                <td className="px-4 py-3 text-2xs text-muted">{r.newExpiryDate ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {!["Completed", "Rejected", "Cancelled"].includes(r.status) && (
                    <div className="flex items-center justify-end gap-1.5">
                      <select onChange={(e) => e.target.value && advance(r.id, e.target.value)} value="" className="h-8 rounded-md border border-border-strong bg-surface px-2 text-2xs"><option value="">Advance…</option>{RENEWAL_STATUS_OPTS.filter((s) => !["Completed", "Pending"].includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}</select>
                      <Button size="sm" onClick={() => setCompleteId(r.id)}>Complete</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No renewals yet — initiate one from the Vehicle Documents tab.</td></tr>}
          </tbody>
        </table>
      </div></div>
      {completeId != null && <CompleteRenewalModal renewalId={completeId} onClose={() => setCompleteId(null)} onCompleted={() => { setCompleteId(null); load(); }} toast={toast} />}
    </div>
  );
}

function CompleteRenewalModal({ renewalId, onClose, onCompleted, toast }: { renewalId: number; onClose: () => void; onCompleted: () => void; toast: ReturnType<typeof useToast> }) {
  const [f, setF] = useState<RenewalCompleteInput>({ newDocumentNo: "", newIssueDate: new Date().toISOString().slice(0, 10), newExpiryDate: "", renewalDate: new Date().toISOString().slice(0, 10), renewalCost: 0, tax: 0, otherCharges: 0, issuingAuthority: "", remarks: "", attachments: [] });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof RenewalCompleteInput>(k: K, v: RenewalCompleteInput[K]) => setF((s) => ({ ...s, [k]: v }));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append("file", file);
      const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
      if (j?.ok) set("attachments", [...f.attachments, j.file as AttachmentInput]); else toast.error(j?.message || "Upload failed.");
    }
    setUploading(false);
  }

  async function save() {
    const parsed = renewalCompleteInput.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setBusy(true);
    const j = await fetch(`/api/transport/vehicle-document/renewal/${renewalId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast.success(j.message || "Renewal completed."); onCompleted(); } else toast.error(j.message || "Could not complete renewal.");
  }

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><h2 className="text-sm font-bold text-foreground">Complete Renewal</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <p className="rounded-lg border border-info/30 bg-info-subtle/40 p-2.5 text-2xs text-info">This creates a new document version and marks the old one Replaced — the previous version stays available in History.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={lbl}>New Document Number</label><input value={f.newDocumentNo ?? ""} onChange={(e) => set("newDocumentNo", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Issuing Authority</label><input value={f.issuingAuthority ?? ""} onChange={(e) => set("issuingAuthority", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>New Issue Date *</label><input type="date" value={f.newIssueDate} onChange={(e) => set("newIssueDate", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>New Expiry Date *</label><input type="date" value={f.newExpiryDate} onChange={(e) => set("newExpiryDate", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Renewal Date</label><input type="date" value={f.renewalDate ?? ""} onChange={(e) => set("renewalDate", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Renewal Cost (₹)</label><input type="number" min={0} value={f.renewalCost || ""} onChange={(e) => set("renewalCost", Number(e.target.value) || 0)} className={inp} /></div>
            <div><label className={lbl}>Tax (₹)</label><input type="number" min={0} value={f.tax || ""} onChange={(e) => set("tax", Number(e.target.value) || 0)} className={inp} /></div>
            <div><label className={lbl}>Other Charges (₹)</label><input type="number" min={0} value={f.otherCharges || ""} onChange={(e) => set("otherCharges", Number(e.target.value) || 0)} className={inp} /></div>
            <div className="sm:col-span-2"><label className={lbl}>Remarks</label><input value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} className={inp} /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="text-muted">Total Cost</span><span className="font-bold text-foreground">₹{(f.renewalCost + f.tax + f.otherCharges).toFixed(2)}</span></div>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><label className={lbl}>New Document Attachment</label><label className="cursor-pointer text-2xs font-semibold text-primary hover:underline"><Plus className="mr-0.5 inline h-3.5 w-3.5" />{uploading ? "Uploading…" : "Upload"}<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label></div>
            {f.attachments.map((a, i) => (<div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-1.5"><span className="truncate text-sm text-foreground">{a.fileName}</span><button type="button" onClick={() => set("attachments", f.attachments.filter((_, j) => j !== i))} className="text-muted hover:text-danger"><X className="h-4 w-4" /></button></div>))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Complete Renewal"}</Button></div>
      </div>
    </div>
  );
}

/* ================================================================= History */
function HistoryTab({ vehicles }: { vehicles: VehicleOption[] }) {
  const [rows, setRows] = useState<{ id: number; action: string; entity: string; entityId: string | null; summary: string | null; userName: string | null; at: string }[] | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(); if (vehicleId) p.set("vehicleId", vehicleId);
    fetch(`/api/transport/vehicle-document/history?${p}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])).catch(() => setRows([]));
  }, [vehicleId]);

  return (
    <div className="space-y-3">
      <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={cn(inp, "w-56")}><option value="">All Vehicles</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}</select>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted"><th className="px-4 py-3 text-left">Date/Time</th><th className="px-4 py-3 text-left">Action</th><th className="px-4 py-3 text-left">Summary</th><th className="px-4 py-3 text-left">User</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={4} className="px-4 py-10"><AppLoader label="Loading…" size="sm" /></td></tr>}
            {rows?.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 text-2xs text-muted">{new Date(r.at).toLocaleString()}</td>
                <td className="px-4 py-3 text-2xs font-medium text-foreground">{r.action}</td>
                <td className="px-4 py-3 text-2xs text-muted">{r.summary ?? "—"}</td>
                <td className="px-4 py-3 text-2xs text-muted">{r.userName ?? "—"}</td>
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted">No history yet.</td></tr>}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}
