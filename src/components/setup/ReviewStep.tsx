"use client";

import Link from "next/link";
import {
  Building2,
  GitBranch,
  Warehouse,
  ReceiptText,
  Landmark,
  Users,
  Blocks,
  Printer,
  DatabaseZap,
  CheckCircle2,
  PartyPopper,
  LayoutDashboard,
  Package,
  UserPlus,
  Truck,
  ShoppingCart,
  FilePlus2,
  type LucideIcon,
} from "lucide-react";
import { useSetup } from "./SetupContext";
import { MODULE_TOGGLES, HARDWARE_TOGGLES, MIGRATION_IMPORTS } from "@/lib/setup/config";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

function labelsOn(toggles: Record<string, boolean> | undefined, defs: { id: string; label: string }[]) {
  if (!toggles) return [];
  return defs.filter((d) => toggles[d.id]).map((d) => d.label);
}

/* ------------------------------------------------------------- review --- */

export function ReviewStep() {
  const { data } = useSetup();
  const modules = labelsOn(data.toggles.modules, MODULE_TOGGLES);
  const hardware = labelsOn(data.toggles.hardware, HARDWARE_TOGGLES);
  const imports = labelsOn(data.toggles.migrationImports, MIGRATION_IMPORTS);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SummaryCard icon={Building2} title="Company Information">
        <Line k="Company" v={data.company.name || "—"} />
        <Line k="Industry" v={data.company.industry || "—"} />
        <Line k="GST Number" v={data.company.gst || "—"} />
        <Line k="Phone" v={data.company.phone || "—"} />
      </SummaryCard>

      <SummaryCard icon={GitBranch} title="Locations">
        <Line k="Branches" v={String(data.branches.length)} />
        <Line k="Warehouses" v={String(data.warehouses.length)} />
        <Line k="Organization" v={data.org.type} />
      </SummaryCard>

      <SummaryCard icon={ReceiptText} title="GST Configuration">
        <Line k="Registration" v={data.gst.regType} />
        <Line k="GSTIN" v={data.gst.gstin || "—"} />
        <Line k="Filing" v={data.gst.frequency} />
        <Line
          k="E-Invoice / E-Way"
          v={`${data.flags.gstEinvoice ? "On" : "Off"} / ${data.flags.gstEway ? "On" : "Off"}`}
        />
      </SummaryCard>

      <SummaryCard icon={Landmark} title="Financial Configuration">
        <Line k="Currency" v={data.finance.currency || "INR"} />
        <Line k="Method" v={data.finance.method || "accrual"} />
        <Line k="Bank Accounts" v={String(data.banks.length)} />
        <Line k="Valuation" v={data.inventoryValuation.toUpperCase()} />
      </SummaryCard>

      <SummaryCard icon={Users} title="Users">
        <Line k="Administrator" v={data.admin.name || "—"} />
        <Line k="Additional Users" v={String(data.users.length)} />
      </SummaryCard>

      <SummaryCard icon={Printer} title="Hardware">
        <ChipList items={hardware} empty="No hardware selected" />
      </SummaryCard>

      <SummaryCard icon={Blocks} title="Enabled Modules" full>
        <ChipList items={modules} empty="No modules enabled" />
      </SummaryCard>

      <SummaryCard icon={DatabaseZap} title="Data Migration" full>
        <Line k="Source" v={data.migrationSource || "None"} />
        <div className="mt-2">
          <ChipList items={imports} empty="No data import selected" />
        </div>
      </SummaryCard>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  children,
  full,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="h-full rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-subtle text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <div className="space-y-1.5">{children}</div>
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{k}</span>
      <span className="truncate font-medium capitalize text-foreground">{v}</span>
    </div>
  );
}

function ChipList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-subtle">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Badge key={i} tone="neutral">
          {i}
        </Badge>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ success --- */

export function SuccessScreen() {
  const { data } = useSetup();
  const actions: { icon: LucideIcon; label: string; href: string; primary?: boolean }[] = [
    { icon: LayoutDashboard, label: "Go To Dashboard", href: "/dashboard", primary: true },
    { icon: Package, label: "Add Products", href: "/masters" },
    { icon: UserPlus, label: "Add Customers", href: "/crm" },
    { icon: Truck, label: "Add Suppliers", href: "/purchase" },
    { icon: FilePlus2, label: "Create Purchase", href: "/purchase" },
    { icon: ShoppingCart, label: "Start Billing", href: "/pos" },
  ];

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--app-bg, var(--color-background))" }}
    >
      <div className="w-full max-w-2xl">
        <div className="success-pop overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div
            className="relative px-8 py-10 text-center text-white"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <div className="relative mx-auto grid h-20 w-20 place-items-center">
              <span className="success-ring absolute inset-0 rounded-full bg-white/30" />
              <span className="relative grid h-20 w-20 place-items-center rounded-full bg-white">
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none">
                  <path
                    className="check-path"
                    d="M5 13l4 4L19 7"
                    stroke="var(--color-success)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <h1 className="mt-5 flex items-center justify-center gap-2 text-2xl font-bold">
              <PartyPopper className="h-6 w-6" />
              Congratulations!
            </h1>
            <p className="mt-1.5 text-white/85">
              Your business setup has been completed successfully.
            </p>
          </div>

          {/* Stats */}
          <div className="px-8 py-6">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
              <span>Setup Completion</span>
              <span className="font-bold text-success">100%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full w-full rounded-full bg-success" />
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label="Company" value={data.company.name || "Oasys ERP"} />
              <Stat label="Branches" value={String(Math.max(data.branches.length, 1))} />
              <Stat label="Users" value={String(data.users.length + 1)} />
            </div>

            <p className="mt-7 text-center text-sm font-semibold text-foreground">
              What would you like to do next?
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {actions.map((a) => (
                <Link key={a.label} href={a.href}>
                  <button
                    className={
                      a.primary
                        ? "flex w-full flex-col items-center gap-2 rounded-xl bg-brand-gradient p-4 text-white shadow-sm transition hover:brightness-105"
                        : "flex w-full flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 text-foreground transition hover:border-primary hover:bg-primary-subtle"
                    }
                  >
                    <a.icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{a.label}</span>
                  </button>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-subtle">
          <Logo showText={false} />
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Workspace provisioned · Oasys ERP
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <div className="truncate text-base font-bold text-foreground">{value}</div>
      <div className="text-2xs text-muted">{label}</div>
    </div>
  );
}
