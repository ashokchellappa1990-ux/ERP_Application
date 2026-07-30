"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { cloneSalesConfig, type SalesConfigData } from "@/lib/settings/salesConfigDefaults";
import { useToast } from "@/components/ui/Toast";

export type SalesSettingsData = SalesConfigData;

interface SalesSettingsValue {
  data: SalesSettingsData;
  setField: (n: string, v: string) => void;
  getField: (n: string) => string;
  isOn: (g: string, id: string) => boolean;
  toggle: (g: string, id: string) => void;
  countOn: (g: string) => number;
  flag: (id: string) => boolean;
  setFlag: (id: string, v: boolean) => void;
  errors: Record<string, string>;
  validate: () => boolean;
  loading: boolean;
  save: () => Promise<boolean>;
}

/** Initial state is a clone of the shared DEFAULT_SALES_CONFIG that the Sales module also obeys. */
const blank = (): SalesSettingsData => cloneSalesConfig();

const SalesSettingsContext = createContext<SalesSettingsValue | null>(null);

function mergeConfig(stored: Partial<SalesConfigData> | null | undefined): SalesSettingsData {
  const base = blank();
  if (!stored) return base;
  base.fields = { ...base.fields, ...(stored.fields ?? {}) };
  base.flags = { ...base.flags, ...(stored.flags ?? {}) };
  const toggles = stored.toggles ?? {};
  for (const g of Object.keys(toggles)) base.toggles[g] = { ...(base.toggles[g] ?? {}), ...toggles[g] };
  return base;
}

export function SalesSettingsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [data, setData] = useState<SalesSettingsData>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Load this tenant's persisted sales config (falls back to defaults).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const j = await fetch("/api/settings/sales", { cache: "no-store" }).then((r) => r.json());
        if (active && j.ok && j.config) setData(mergeConfig(j.config));
      } catch { /* keep defaults */ } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const save = useCallback(async () => {
    try {
      const j = await fetch("/api/settings/sales", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      }).then((r) => r.json());
      toast.result(j, "Sales settings saved.", "Could not save sales settings.");
      return !!j.ok;
    } catch {
      toast.error("Could not reach the server. Please try again.");
      return false;
    }
  }, [data, toast]);

  const setField = useCallback((n: string, v: string) => setData((d) => ({ ...d, fields: { ...d.fields, [n]: v } })), []);
  const getField = useCallback((n: string) => data.fields[n] ?? "", [data.fields]);
  const isOn = useCallback((g: string, id: string) => !!data.toggles[g]?.[id], [data.toggles]);
  const toggle = useCallback((g: string, id: string) => setData((d) => { const grp = { ...(d.toggles[g] ?? {}) }; grp[id] = !grp[id]; return { ...d, toggles: { ...d.toggles, [g]: grp } }; }), []);
  const countOn = useCallback((g: string) => Object.values(data.toggles[g] ?? {}).filter(Boolean).length, [data.toggles]);
  const flag = useCallback((id: string) => !!data.flags[id], [data.flags]);
  const setFlag = useCallback((id: string, v: boolean) => setData((d) => ({ ...d, flags: { ...d.flags, [id]: v } })), []);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    const t = data.toggles;
    const anyOn = (g: string) => Object.values(t[g] ?? {}).some(Boolean);
    if (!anyOn("channels")) e["channels"] = "Enable at least one sales channel.";
    if (!anyOn("productMethods")) e["productMethods"] = "Enable at least one product selection method.";
    if (!data.fields.priceSource) e["priceSource"] = "Select a default price source.";
    if (data.flags.enableBarcode && !anyOn("barcodeTypes")) e["barcodeTypes"] = "Select at least one barcode type.";
    if (data.flags.enableQr && !anyOn("qrContains")) e["qrContains"] = "Select what the QR encodes.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [data]);

  const value: SalesSettingsValue = { data, setField, getField, isOn, toggle, countOn, flag, setFlag, errors, validate, loading, save };
  return <SalesSettingsContext.Provider value={value}>{children}</SalesSettingsContext.Provider>;
}

export function useSalesSettings() {
  const ctx = useContext(SalesSettingsContext);
  if (!ctx) throw new Error("useSalesSettings must be used within SalesSettingsProvider");
  return ctx;
}
