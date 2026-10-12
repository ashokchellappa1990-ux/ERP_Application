"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Truck, Clock, CheckCircle2, Warehouse, Hourglass, PackagePlus,
  DoorOpen, Scale, FileText, ReceiptText, Wallet, type LucideIcon,
} from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { formatMoneyWith, formatQtyWith } from "@/lib/settings/generalConfig";

interface Kpis {
  todaysDispatch: number; pendingDispatch: number; completedDispatchToday: number;
  vehicleInsideFactory: number; waitingVehicles: number; loadingVehicles: number; pendingGateExit: number;
  todaysWeight: number; todaysDc: number; todaysInvoice: number; transportCost: number;
}

export function TransportDashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const gcfg = useGeneralConfig();
  const inr = (x: number) => formatMoneyWith(gcfg, x);
  const fq = (x: number) => formatQtyWith(gcfg, x);

  useEffect(() => {
    (async () => {
      try { const j = await fetch("/api/transport/dashboard/kpis", { cache: "no-store" }).then((r) => r.json()); if (j.ok) setKpis(j.kpis); }
      catch { /* */ } finally { setLoading(false); }
    })();
  }, []);

  const tiles: { key: keyof Kpis; label: string; icon: LucideIcon; tone: string; format?: (n: number) => string }[] = [
    { key: "todaysDispatch", label: "Today's Dispatch", icon: Truck, tone: "text-primary" },
    { key: "pendingDispatch", label: "Pending Dispatch", icon: Clock, tone: "text-warning" },
    { key: "completedDispatchToday", label: "Completed Dispatch (Today)", icon: CheckCircle2, tone: "text-success" },
    { key: "vehicleInsideFactory", label: "Vehicle Inside Factory", icon: Warehouse, tone: "text-info" },
    { key: "waitingVehicles", label: "Waiting Vehicles", icon: Hourglass, tone: "text-warning" },
    { key: "loadingVehicles", label: "Loading Vehicles", icon: PackagePlus, tone: "text-primary" },
    { key: "pendingGateExit", label: "Pending Gate Exit", icon: DoorOpen, tone: "text-danger" },
    { key: "todaysWeight", label: "Today's Weight (net)", icon: Scale, tone: "text-foreground", format: (n) => `${fq(n)} kg` },
    { key: "todaysDc", label: "Today's DC", icon: FileText, tone: "text-foreground" },
    { key: "todaysInvoice", label: "Today's Invoice (B2B)", icon: ReceiptText, tone: "text-foreground" },
    { key: "transportCost", label: "Transport Cost (today's dispatches)", icon: Wallet, tone: "text-foreground", format: (n) => inr(n) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><Truck className="h-6 w-6" /></span>
        <div>
          <h1 className="text-lg font-bold text-foreground">Transport &amp; Vehicle Operations</h1>
          <p className="mt-0.5 text-xs text-muted">Live dispatch, gate &amp; weighment status at a glance.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 text-xs shadow-sm">
        <Link href="/transport/movement-history" className="rounded-lg border border-border px-3 py-1.5 font-semibold text-primary hover:bg-primary-subtle/30">Movement History</Link>
        <Link href="/transport/delivery-challan" className="rounded-lg border border-border px-3 py-1.5 font-semibold text-primary hover:bg-primary-subtle/30">Delivery Challans</Link>
      </div>

      {loading && <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading transport dashboard…" size="sm" /></div>}

      {!loading && kpis && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            const raw = kpis[t.key];
            const value = t.format ? t.format(raw) : raw.toLocaleString("en-IN");
            return (
              <div key={t.key} className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase tracking-wide text-muted">{t.label}</span>
                  <Icon className={`h-4 w-4 ${t.tone}`} />
                </div>
                <div className={`mt-1 text-xl font-bold tabular-nums ${t.tone}`}>{value}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
