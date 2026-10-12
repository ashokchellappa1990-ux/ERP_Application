"use client";

import Link from "next/link";
import { ArrowLeft, Hammer, Sparkles, CircleDot } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useBrand } from "@/components/theme/ThemeProvider";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";

/** Short marketing line + planned capabilities per module route. */
const MODULE_INFO: Record<string, { desc: string; points: string[] }> = {
  "/pos": {
    desc: "Fast, touch-friendly billing for your counters — barcode scan, hold/recall, split payments and instant receipts.",
    points: ["Barcode & quick billing", "Hold / recall bills", "Multi-mode payments", "Thermal + e-receipts"],
  },
  "/sales": {
    desc: "Manage quotations, sales orders, invoices, returns and credit notes across all channels.",
    points: ["Sales orders & invoices", "Returns & credit notes", "Channel-wise sales", "Outstanding tracking"],
  },
  "/purchase": {
    desc: "Raise purchase orders, receive goods (GRN), record purchase bills and manage suppliers.",
    points: ["Purchase orders & GRN", "Supplier management", "Bill matching", "Reorder suggestions"],
  },
  "/inventory": {
    desc: "Real-time stock across branches and warehouses — batches, expiry, serials and stock transfers.",
    points: ["Multi-location stock", "Batch / expiry / serial", "Stock transfers", "Reorder monitoring"],
  },
  "/masters": {
    desc: "Central catalog of products, categories, units, taxes, customers and suppliers.",
    points: ["Products & variants", "Categories & units", "Tax & price lists", "Customer / supplier master"],
  },
  "/crm": {
    desc: "Build customer relationships — profiles, segments, follow-ups and campaigns.",
    points: ["Customer 360 profiles", "Segments & tags", "Follow-up reminders", "Campaigns"],
  },
  "/loyalty": {
    desc: "Reward repeat customers with points, tiers, coupons and gift cards.",
    points: ["Points & tiers", "Coupons", "Gift cards", "Redemption at POS"],
  },
  "/chit": {
    desc: "Run chit / savings schemes with installment tracking and ledgers.",
    points: ["Scheme setup", "Installment tracking", "Member ledgers", "Maturity & payouts"],
  },
  "/accounting": {
    desc: "Complete books — ledgers, vouchers, banking, receivables, payables and reports.",
    points: ["Ledgers & vouchers", "Bank reconciliation", "Receivables / payables", "P&L & balance sheet"],
  },
  "/gst": {
    desc: "GST returns, e-invoicing and e-way bills — accurate and ready to file.",
    points: ["GSTR-1 / 3B", "E-Invoice (IRN)", "E-Way Bill", "Reconciliation"],
  },
  "/stores": {
    desc: "Manage multiple stores, branches and franchises from one console.",
    points: ["Branch directory", "Centralized pricing", "Inter-branch transfers", "Consolidated reports"],
  },
  "/hrms": {
    desc: "Staff, attendance, shifts, payroll and leave — built for retail teams.",
    points: ["Employee directory", "Attendance & shifts", "Payroll", "Leave management"],
  },
  "/reports": {
    desc: "Operational and executive reports across sales, stock, purchase and finance.",
    points: ["Sales & profit reports", "Stock & ageing", "GST reports", "Custom dashboards"],
  },
  "/ai": {
    desc: "AI assistant for demand forecasting, reorder suggestions and anomaly detection.",
    points: ["Demand forecasting", "Smart reorder", "Anomaly alerts", "Natural-language queries"],
  },
  "/pharmacy": {
    desc: "Pharmacy add-on — prescriptions, schedule drugs, expiry control and compliance.",
    points: ["Prescription billing", "Schedule-drug control", "Batch & expiry (FEFO)", "Drug licence compliance"],
  },
  "/settings": {
    desc: "Configure your company, branches, taxes, users, roles and preferences.",
    points: ["Company & branches", "Users & roles", "Taxes & pricing", "Theme & preferences"],
  },
};

export function ModulePlaceholder({ path }: { path: string }) {
  const brand = useBrand();
  const brandName = brand.productName || DEFAULT_PRODUCT_NAME;
  const item = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === path);
  const Icon = item?.icon ?? CircleDot;
  const label = item?.label ?? "Module";
  const info = MODULE_INFO[path];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-xs text-muted">
        <Link href="/dashboard" className="hover:text-foreground">
          Dashboard
        </Link>
        <span className="text-subtle">/</span>
        <span className="font-medium text-foreground">{label}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Header band */}
        <div
          className="relative px-7 py-8 text-white"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Icon className="h-7 w-7" />
            </span>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
                <Badge tone="warning" className="bg-white/20 text-white">
                  <Hammer className="h-3 w-3" />
                  Coming soon
                </Badge>
              </div>
              <p className="max-w-xl text-sm text-white/85">
                {info?.desc ??
                  `This module is part of your ${brandName} plan and is being set up.`}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            What you&apos;ll be able to do here
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(info?.points ?? [
              "Configured during onboarding",
              "Available on your plan",
              "Role-based access",
              "Multi-store ready",
            ]).map((p) => (
              <div
                key={p}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-surface p-3 text-sm text-foreground"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary">
                  <CircleDot className="h-3.5 w-3.5" />
                </span>
                {p}
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/dashboard">
              <Button variant="outline" size="md">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <Link href="/setup">
              <Button size="md">Configure in Setup</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
