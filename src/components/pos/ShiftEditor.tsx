"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, ArrowLeft, Save, Loader2, Banknote, SlidersHorizontal, Zap, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ShiftDetail } from "@/lib/contracts/shift";

type Bag = Record<string, boolean | number | string>;
const OPERATIONAL = [
  ["allowSales", "Allow Sales"], ["allowReturn", "Allow Return"], ["allowHold", "Allow Hold"],
  ["allowResume", "Allow Resume"], ["allowB2b", "Allow B2B"], ["allowB2c", "Allow B2C"],
  ["allowPettyCash", "Allow Petty Cash"], ["allowDeposit", "Allow Deposit"], ["allowWithdrawal", "Allow Withdrawal"],
] as const;
const AUTO = [
  ["autoLogout", "Auto Logout"], ["autoClose", "Auto Close"], ["autoPrintSummary", "Auto Print Summary"],
] as const;

export function ShiftEditor({ id }: { id?: number }) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!id;
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("21:00");
  const [crossDay, setCrossDay] = useState(false);
  const [gracePeriodMins, setGracePeriodMins] = useState("");

  const [openingCashMandatory, setOpeningCashMandatory] = useState(true);
  const [closingCashMandatory, setClosingCashMandatory] = useState(true);
  const [physicalCountRequired, setPhysicalCountRequired] = useState(false);
  const [managerApprovalRequired, setManagerApprovalRequired] = useState(false);
  const [maxCashDifference, setMaxCashDifference] = useState("");

  const [operational, setOperational] = useState<Bag>({ allowSales: true, allowReturn: true });
  const [auto, setAuto] = useState<Bag>({});

  useEffect(() => {
    if (!id) return;
    fetch(`/api/pos/shifts/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok) {
        const d: ShiftDetail = j.data;
        setCode(d.code); setName(d.name); setDescription(d.description); setStatus(d.status);
        setStartTime(d.startTime); setEndTime(d.endTime); setCrossDay(d.crossDay);
        if (d.gracePeriodMins != null) setGracePeriodMins(String(d.gracePeriodMins));
        setOpeningCashMandatory(d.openingCashMandatory); setClosingCashMandatory(d.closingCashMandatory);
        setPhysicalCountRequired(d.physicalCountRequired); setManagerApprovalRequired(d.managerApprovalRequired);
        if (d.maxCashDifference != null) setMaxCashDifference(String(d.maxCashDifference));
        setOperational((d.config.operational ?? {}) as Bag); setAuto((d.config.auto ?? {}) as Bag);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!code.trim() || !name.trim()) { toast.error("Shift code and name are required."); return; }
    setSaving(true);
    const config = { operational, auto };
    const payload = {
      code: code.trim(), name: name.trim(), description: description.trim(), status,
      startTime: startTime.trim(), endTime: endTime.trim(), crossDay,
      gracePeriodMins: gracePeriodMins ? Number(gracePeriodMins) : undefined,
      openingCashMandatory, closingCashMandatory, physicalCountRequired, managerApprovalRequired,
      maxCashDifference: maxCashDifference ? Number(maxCashDifference) : undefined,
      config,
    };
    const res = await fetch(editing ? `/api/pos/shifts/${id}` : "/api/pos/shifts", {
      method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    const ok = toast.result(j, editing ? "Shift updated." : "Shift created.", "Could not save the shift.");
    setSaving(false);
    if (ok) router.push("/pos/shifts");
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading shift…" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/pos/shifts" className="hover:text-foreground">Shifts</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{editing ? code : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Clock className="h-5 w-5 text-primary" /> {editing ? "Edit Shift" : "Create Shift"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pos/shifts"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <SectionCard title="General" icon={Clock}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Shift Code *"><input value={code} onChange={(e) => setCode(e.target.value)} className={inp} placeholder="MORNING" /></Field>
          <Field label="Shift Name *"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="Morning Shift" /></Field>
          <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")} className={inp}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
          <div className="sm:col-span-2 lg:col-span-3"><Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inp} /></Field></div>
        </div>
      </SectionCard>

      <SectionCard title="Timing" icon={Timer}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Start Time"><input value={startTime} onChange={(e) => setStartTime(e.target.value)} type="time" className={inp} /></Field>
          <Field label="End Time"><input value={endTime} onChange={(e) => setEndTime(e.target.value)} type="time" className={inp} /></Field>
          <Field label="Grace Period (mins)"><input value={gracePeriodMins} onChange={(e) => setGracePeriodMins(e.target.value)} type="number" className={inp} placeholder="0" /></Field>
          <Toggle label="Crosses Midnight" on={crossDay} set={setCrossDay} />
        </div>
      </SectionCard>

      <SectionCard title="Cash Rules" icon={Banknote}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle label="Opening Cash Mandatory" on={openingCashMandatory} set={setOpeningCashMandatory} />
          <Toggle label="Closing Cash Mandatory" on={closingCashMandatory} set={setClosingCashMandatory} />
          <Toggle label="Physical Count Required" on={physicalCountRequired} set={setPhysicalCountRequired} />
          <Toggle label="Manager Approval Required" on={managerApprovalRequired} set={setManagerApprovalRequired} />
        </div>
        <div className="mt-3 max-w-xs"><Field label="Max Cash Difference"><input value={maxCashDifference} onChange={(e) => setMaxCashDifference(e.target.value)} type="number" className={inp} placeholder="0.00" /></Field></div>
      </SectionCard>

      <SectionCard title="Operational Rules" icon={SlidersHorizontal}><ToggleGrid items={OPERATIONAL} bag={operational} set={setOperational} /></SectionCard>
      <SectionCard title="Auto Actions" icon={Zap}><ToggleGrid items={AUTO} bag={auto} set={setAuto} /></SectionCard>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>{children}</label>;
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => set(!on)} className={cn("flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition", on ? "border-primary/40 bg-primary-subtle/30 text-foreground" : "border-border bg-surface text-muted")}>
      <span>{label}</span>
      <span className={cn("h-4 w-7 rounded-full p-0.5 transition", on ? "bg-primary" : "bg-border-strong")}><span className={cn("block h-3 w-3 rounded-full bg-white transition", on && "translate-x-3")} /></span>
    </button>
  );
}
function ToggleGrid({ items, bag, set }: { items: readonly (readonly [string, string])[]; bag: Bag; set: (b: Bag) => void }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([key, label]) => <Toggle key={key} label={label} on={!!bag[key]} set={(v) => set({ ...bag, [key]: v })} />)}
    </div>
  );
}
