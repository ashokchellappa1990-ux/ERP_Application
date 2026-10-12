"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Monitor, ArrowLeft, Save, Loader2, Cpu, ReceiptText, Banknote, WifiOff, ShieldCheck, Radar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { TERMINAL_TYPES, type TerminalDetail } from "@/lib/contracts/posTerminal";

type Bag = Record<string, boolean | number | string>;
const HARDWARE = [
  ["receiptPrinter", "Receipt Printer"], ["labelPrinter", "Label Printer"], ["barcodeScanner", "Barcode Scanner"],
  ["qrScanner", "QR Scanner"], ["cashDrawer", "Cash Drawer"], ["customerDisplay", "Customer Display"],
  ["cardMachine", "Card Machine"], ["weighingScale", "Weighing Scale"], ["camera", "Camera"],
] as const;
const BILLING = [
  ["allowB2c", "Allow B2C Sales"], ["allowB2b", "Allow B2B Sales"], ["allowReturn", "Allow Sales Return"],
  ["allowHold", "Allow Hold Bill"], ["allowResume", "Allow Resume Bill"], ["allowExchange", "Allow Exchange"],
  ["allowCredit", "Allow Credit Sales"], ["allowManualDiscount", "Allow Manual Discount"],
  ["allowPriceOverride", "Allow Price Override"], ["allowSplitPayment", "Allow Split Payment"],
] as const;
const CASH = [
  ["openingCashMandatory", "Opening Cash Mandatory"], ["closingCashMandatory", "Closing Cash Mandatory"],
  ["cashDepositAllowed", "Cash Deposit Allowed"], ["cashWithdrawalAllowed", "Cash Withdrawal Allowed"], ["pettyCashAllowed", "Petty Cash Allowed"],
] as const;

export function TerminalEditor({ id }: { id?: number }) {
  const router = useRouter();
  const toast = useToast();
  const editing = !!id;
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("Desktop POS");
  const [description, setDescription] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [deviceAuthRequired, setDeviceAuthRequired] = useState(false);
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [hardware, setHardware] = useState<Bag>({});
  const [billing, setBilling] = useState<Bag>({ allowB2c: true, allowReturn: true });
  const [cash, setCash] = useState<Bag>({ openingCashMandatory: true, closingCashMandatory: true });
  const [cashDifferenceLimit, setCashDifferenceLimit] = useState("");
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [offlineLimit, setOfflineLimit] = useState("");
  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/pos/terminals/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok) {
        const d: TerminalDetail = j.data;
        setCode(d.code); setName(d.name); setType(d.type); setDescription(d.description);
        setIpAddress(d.ipAddress); setDeviceId(d.deviceId); setMacAddress(d.macAddress);
        setDeviceAuthRequired(d.deviceAuthRequired); setStatus(d.status);
        setHardware((d.config.hardware ?? {}) as Bag); setBilling((d.config.billing ?? {}) as Bag);
        const c = (d.config.cash ?? {}) as Bag; setCash(c);
        if (c.cashDifferenceLimit != null) setCashDifferenceLimit(String(c.cashDifferenceLimit));
        const o = d.config.offline ?? {}; setOfflineEnabled(!!o.offlineEnabled); setAutoSync(o.autoSync !== false);
        if (o.offlineTransactionLimit != null) setOfflineLimit(String(o.offlineTransactionLimit));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function detectIp() {
    const j = await fetch("/api/pos/client-ip", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok && j.ip) { setIpAddress(j.ip); toast.success(`Detected IP ${j.ip}`); } else toast.error("Could not detect the IP address.");
  }

  async function save() {
    if (!code.trim() || !name.trim()) { toast.error("Terminal code and name are required."); return; }
    setSaving(true);
    const config = {
      hardware, billing,
      cash: { ...cash, cashDifferenceLimit: cashDifferenceLimit ? Number(cashDifferenceLimit) : undefined },
      offline: { offlineEnabled, autoSync, offlineTransactionLimit: offlineLimit ? Number(offlineLimit) : undefined },
    };
    const payload = {
      code: code.trim(), name: name.trim(), type, description: description.trim(),
      ipAddress: ipAddress.trim(), deviceId: deviceId.trim(), macAddress: macAddress.trim(),
      deviceAuthRequired, status, config,
    };
    const res = await fetch(editing ? `/api/pos/terminals/${id}` : "/api/pos/terminals", {
      method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    const ok = toast.result(j, editing ? "Terminal updated." : "Terminal registered.", "Could not save the terminal.");
    setSaving(false);
    if (ok) router.push("/pos/terminals");
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading terminal…" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/pos/terminals" className="hover:text-foreground">POS Terminals</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{editing ? code : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Monitor className="h-5 w-5 text-primary" /> {editing ? "Edit Terminal" : "Register Terminal"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pos/terminals"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <SectionCard title="General" icon={Monitor}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Terminal Code *"><input value={code} onChange={(e) => setCode(e.target.value)} className={inp} placeholder="COUNTER-01" /></Field>
          <Field label="Terminal Name *"><input value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="Front Counter 1" /></Field>
          <Field label="Terminal Type"><select value={type} onChange={(e) => setType(e.target.value)} className={inp}>{TERMINAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")} className={inp}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
          <div className="sm:col-span-2 lg:col-span-3"><Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inp} /></Field></div>
        </div>
      </SectionCard>

      <SectionCard title="Hardware Configuration" icon={Cpu}><ToggleGrid items={HARDWARE} bag={hardware} set={setHardware} /></SectionCard>
      <SectionCard title="Billing Configuration" icon={ReceiptText}><ToggleGrid items={BILLING} bag={billing} set={setBilling} /></SectionCard>

      <SectionCard title="Cash Configuration" icon={Banknote}>
        <ToggleGrid items={CASH} bag={cash} set={setCash} />
        <div className="mt-3 max-w-xs"><Field label="Cash Difference Limit"><input value={cashDifferenceLimit} onChange={(e) => setCashDifferenceLimit(e.target.value)} type="number" className={inp} placeholder="0.00" /></Field></div>
      </SectionCard>

      <SectionCard title="Offline Configuration" icon={WifiOff}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Toggle label="Offline Billing Enabled" on={offlineEnabled} set={setOfflineEnabled} />
          <Toggle label="Auto Synchronization" on={autoSync} set={setAutoSync} />
          <Field label="Offline Transaction Limit"><input value={offlineLimit} onChange={(e) => setOfflineLimit(e.target.value)} type="number" className={inp} placeholder="0" /></Field>
        </div>
      </SectionCard>

      <SectionCard title="Security" icon={ShieldCheck}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Toggle label="Device Authentication Required" on={deviceAuthRequired} set={setDeviceAuthRequired} />
          <Field label="IP Address">
            <div className="flex gap-1.5">
              <input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className={inp} placeholder="192.168.1.20" />
              <button type="button" onClick={detectIp} title="Detect from this device" className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Radar className="h-4 w-4" /></button>
            </div>
          </Field>
          <Field label="Device ID"><input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={inp} /></Field>
          <Field label="MAC Address"><input value={macAddress} onChange={(e) => setMacAddress(e.target.value)} className={inp} placeholder="Enter manually" /></Field>
        </div>
        <p className="mt-2 text-2xs text-subtle">IP can be auto-detected from this device&apos;s connection. A MAC address can&apos;t be read by a web browser — enter it manually or capture it via a native device agent.</p>
      </SectionCard>
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
