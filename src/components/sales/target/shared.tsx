"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { targetTypeDef, type TrafficBand } from "@/lib/contracts/salesTarget";

export const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => fetch(url, { cache: "no-store", ...init }).then((r) => r.json());

export function useOptions() {
  const [data, setData] = useState<OptionsT | null>(null);
  useEffect(() => { fetchJson<OptionsT & { ok: boolean }>("/api/sales/target/options").then((j) => { if (j.ok) setData(j); }); }, []);
  return data;
}
export interface OptionsT {
  dimensions: { key: string; label: string; picker?: string; computable: boolean }[];
  targetTypes: { key: string; label: string; unit: string }[];
  periods: { key: string; label: string }[];
  distributions: { key: string; label: string }[];
  fyList: string[];
  options: {
    branches: { id: number; name: string; code: string; level: number }[];
    executives: { id: number; name: string }[];
    customers: { id: number; name: string }[];
    productCategories: string[]; brands: string[]; customerCategories: string[]; channels: string[]; states: string[]; cities: string[];
    costCentres: { id: number; name: string }[]; profitCentres: { id: number; name: string }[];
  };
}

/** Which picker list + whether the value is an id-ref or a string-value, for a dimension. */
export function pickerFor(dimKey: string, opt: OptionsT["options"]): { mode: "ref" | "value"; items: { id?: number; name: string; value?: string }[] } {
  switch (dimKey) {
    case "branch": case "salesoffice": case "store": return { mode: "ref", items: opt.branches.map((b) => ({ id: b.id, name: `${b.code} · ${b.name}` })) };
    case "executive": return { mode: "ref", items: opt.executives.map((e) => ({ id: e.id, name: e.name })) };
    case "customer": return { mode: "ref", items: opt.customers.map((c) => ({ id: c.id, name: c.name })) };
    case "customerCategory": return { mode: "value", items: opt.customerCategories.map((v) => ({ value: v, name: v })) };
    case "productCategory": return { mode: "value", items: opt.productCategories.map((v) => ({ value: v, name: v })) };
    case "brand": return { mode: "value", items: opt.brands.map((v) => ({ value: v, name: v })) };
    case "channel": return { mode: "value", items: opt.channels.map((v) => ({ value: v, name: v })) };
    case "region": case "state": return { mode: "value", items: opt.states.map((v) => ({ value: v, name: v })) };
    case "city": return { mode: "value", items: opt.cities.map((v) => ({ value: v, name: v })) };
    case "costcentre": return { mode: "ref", items: opt.costCentres.map((c) => ({ id: c.id, name: c.name })) };
    case "profitcentre": return { mode: "ref", items: opt.profitCentres.map((c) => ({ id: c.id, name: c.name })) };
    default: return { mode: "value", items: [] }; // business → single line, no picker
  }
}

export const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "info"> = {
  Draft: "neutral", Submitted: "info", Approved: "success", Rejected: "danger", Returned: "warning", Locked: "primary", Completed: "success", Cancelled: "neutral",
  Pending: "warning", NotRequired: "neutral", Active: "success",
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;

export const BAND_COLOR: Record<TrafficBand, string> = { green: "bg-success", blue: "bg-info", yellow: "bg-warning", orange: "bg-accent", red: "bg-danger" };
export const BAND_TEXT: Record<TrafficBand, string> = { green: "text-success", blue: "text-info", yellow: "text-warning", orange: "text-accent", red: "text-danger" };
export function TrafficBadge({ band, pct }: { band: TrafficBand; pct: number }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${BAND_COLOR[band]}`} /><span className={`font-semibold tabular-nums ${BAND_TEXT[band]}`}>{pct}%</span></span>;
}

/** Format a target/achievement number by its target-type unit. */
export function useValueFmt() {
  const fmt = useFmt();
  return useCallback((n: number, targetType: string) => {
    const u = targetTypeDef(targetType)?.unit ?? "money";
    if (u === "money") return fmt.money(n || 0);
    if (u === "percent") return `${(n || 0).toFixed(2)}%`;
    if (u === "qty") return (n || 0).toLocaleString("en-IN");
    return String(Math.round(n || 0));
  }, [fmt]);
}
