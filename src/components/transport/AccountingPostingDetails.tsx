"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { DEFAULT_ACCOUNTING_CONFIG, type AccountingConfigData } from "@/lib/settings/accountingConfigDefaults";
import { fieldOn } from "@/lib/settings/docFieldsConfig";

const SCREEN = "load_dispatch";

interface Props {
  taxableValue: number;
  taxTotal: number;
  vehicleRent: number;
  transitPassAmount: number;
  driverBattaAmount: number;
  driverBattaMode: "Adjustment" | "Payment" | null;
}

const TIMING_LABEL: Record<string, string> = { OnDispatch: "On Dispatch", OnInvoice: "On Sales Invoice" };

/** Plain-language read-out of exactly what the Dispatch & Sales Accounting
 * engine (postDispatchAccountingVoucher / buildPreparedSale in
 * src/lib/transport/loadDispatch.ts) will post and when, driven by live
 * Accounting Configuration — kept in this one shared component so the add
 * page and the view page can never drift out of sync with each other. */
export function AccountingPostingDetails({ taxableValue, taxTotal, vehicleRent, transitPassAmount, driverBattaAmount, driverBattaMode }: Props) {
  const fmt = useFmt();
  const [cfg, setCfg] = useState<AccountingConfigData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/accounting-config", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok && j.config) setCfg(j.config); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!fieldOn(SCREEN, "accountingPostingDetails")) return null;
  const c = cfg ?? DEFAULT_ACCOUNTING_CONFIG;
  const separateVoucher = c.flags.createSeparateDispatchVoucher ?? true;
  const receivableOnDispatch = separateVoucher && (c.fields.customerReceivableTiming || "OnDispatch") === "OnDispatch";
  const transitPassRecoverable = (c.fields.transitPassAccounting || "Recoverable") !== "CompanyExpense";
  const vehicleRentRecoverable = (c.fields.vehicleRentAccounting || "Recoverable") !== "CompanyExpense";
  const transitPassAtDispatch = receivableOnDispatch && transitPassRecoverable;
  const vehicleRentAtDispatch = receivableOnDispatch && vehicleRentRecoverable;

  const rows: { label: string; amount: string; when: string }[] = [];
  rows.push({ label: "Customer Receivable", amount: fmt.money(taxableValue + taxTotal + (transitPassAtDispatch ? transitPassAmount : 0) + (vehicleRentAtDispatch ? vehicleRent : 0)), when: separateVoucher ? TIMING_LABEL[c.fields.customerReceivableTiming || "OnDispatch"] : "On Sales Invoice" });
  rows.push({ label: "Sales Revenue", amount: fmt.money(taxableValue), when: separateVoucher ? TIMING_LABEL[c.fields.salesRevenueTiming || "OnInvoice"] : "On Sales Invoice" });
  rows.push({ label: "GST", amount: fmt.money(taxTotal), when: separateVoucher ? TIMING_LABEL[c.fields.gstRecognitionTiming || "OnInvoice"] : "On Sales Invoice" });
  rows.push({ label: "Inventory / Cost of Goods Sold", amount: "—", when: separateVoucher ? TIMING_LABEL[c.fields.inventoryCogsTiming || "OnDispatch"] : "On Dispatch" });
  if (transitPassAmount > 0) rows.push({ label: `Transit Pass (${transitPassRecoverable ? "Operating Income" : "Company Expense"})`, amount: fmt.money(transitPassAmount), when: transitPassRecoverable ? (transitPassAtDispatch ? "On Dispatch" : "On Sales Invoice") : "On Dispatch (company-paid)" });
  if (vehicleRent > 0) rows.push({ label: `Vehicle Rent (${vehicleRentRecoverable ? "Operating Income" : "Company Expense"})`, amount: fmt.money(vehicleRent), when: vehicleRentRecoverable ? (vehicleRentAtDispatch ? "On Dispatch" : "On Sales Invoice") : "On Dispatch (company-paid)" });
  if (driverBattaAmount > 0) rows.push({ label: `Driver Batta (${driverBattaMode === "Payment" ? "Payment" : "Adjustment"})`, amount: fmt.money(driverBattaAmount), when: driverBattaMode === "Payment" ? "On Dispatch — paid to driver" : "On Dispatch — nets off Receivable" });

  return (
    <SectionCard icon={Landmark} title="Accounting Posting Details" allowOverflow>
      {loading ? <AppLoader label="Loading…" size="sm" /> : (
        <div className="space-y-1.5">
          {separateVoucher ? (
            <p className="mb-2 text-2xs text-subtle">A Dispatch Accounting Voucher posts at Complete Load &amp; Dispatch; a Sales Invoice Voucher posts the rest at invoice time.</p>
          ) : (
            <p className="mb-2 text-2xs text-subtle">Everything posts in a single voucher when the Sales Invoice is generated.</p>
          )}
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">{r.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">{r.amount}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-semibold text-subtle">{r.when}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
