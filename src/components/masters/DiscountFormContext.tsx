"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SAMPLE_DISCOUNTS } from "@/lib/masters/discountConfig";

export type Row = Record<string, string> & { id: string };
export type RowKey = "qtyTiers" | "slabs" | "combos" | "expiryRules" | "branchPolicy";

export interface DiscountFormData {
  fields: Record<string, string>;
  toggles: Record<string, Record<string, boolean>>;
  flags: Record<string, boolean>;
  rows: Record<RowKey, Row[]>;
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
}

interface DiscountFormValue {
  data: DiscountFormData;
  setField: (n: string, v: string) => void;
  getField: (n: string) => string;
  isOn: (g: string, id: string) => boolean;
  toggle: (g: string, id: string) => void;
  flag: (id: string) => boolean;
  setFlag: (id: string, v: boolean) => void;
  rowsOf: (k: RowKey) => Row[];
  addRow: (k: RowKey) => void;
  updateRow: (k: RowKey, id: string, patch: Record<string, string>) => void;
  removeRow: (k: RowKey, id: string) => void;
  setApproval: (s: DiscountFormData["approvalStatus"]) => void;
  errors: Record<string, string>;
  validate: () => boolean;
}

function blank(): DiscountFormData {
  return {
    fields: { status: "Draft", type: "Percentage", priority: "Medium", method: "Percentage", couponType: "Percentage", couponUsage: "Single Use", behavior: "Highest Discount Wins" },
    toggles: { applyOn: { product: true }, channels: { pos: true }, aiTargets: {} },
    flags: { approvalRequired: true },
    rows: { qtyTiers: [], slabs: [], combos: [], expiryRules: [], branchPolicy: [] },
    approvalStatus: "draft",
  };
}

const DiscountFormContext = createContext<DiscountFormValue | null>(null);

export function DiscountFormProvider({ children, discountId }: { children: ReactNode; discountId?: string }) {
  const [data, setData] = useState<DiscountFormData>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const counter = useRef(1);

  useEffect(() => {
    if (!discountId) return;
    const d = SAMPLE_DISCOUNTS.find((x) => x.id === discountId);
    if (!d) return;
    setData((s) => ({
      ...s,
      fields: { ...s.fields, code: d.code, name: d.name, type: d.type, status: d.status, priority: d.priority, start: d.start, end: d.end, value: d.value.replace(/[^0-9.]/g, "") },
      approvalStatus: d.approval === "Approved" ? "approved" : d.approval === "Pending" ? "pending" : d.approval === "Rejected" ? "rejected" : "draft",
    }));
  }, [discountId]);

  const setField = useCallback((n: string, v: string) => setData((d) => ({ ...d, fields: { ...d.fields, [n]: v } })), []);
  const getField = useCallback((n: string) => data.fields[n] ?? "", [data.fields]);
  const isOn = useCallback((g: string, id: string) => !!data.toggles[g]?.[id], [data.toggles]);
  const toggle = useCallback((g: string, id: string) => setData((d) => { const grp = { ...(d.toggles[g] ?? {}) }; grp[id] = !grp[id]; return { ...d, toggles: { ...d.toggles, [g]: grp } }; }), []);
  const flag = useCallback((id: string) => !!data.flags[id], [data.flags]);
  const setFlag = useCallback((id: string, v: boolean) => setData((d) => ({ ...d, flags: { ...d.flags, [id]: v } })), []);
  const rowsOf = useCallback((k: RowKey) => data.rows[k], [data.rows]);
  const addRow = useCallback((k: RowKey) => { const id = `${k}-${counter.current++}`; setData((d) => ({ ...d, rows: { ...d.rows, [k]: [...d.rows[k], { id }] } })); }, []);
  const updateRow = useCallback((k: RowKey, id: string, patch: Record<string, string>) => setData((d) => ({ ...d, rows: { ...d.rows, [k]: d.rows[k].map((r) => (r.id === id ? { ...r, ...patch } : r)) } })), []);
  const removeRow = useCallback((k: RowKey, id: string) => setData((d) => ({ ...d, rows: { ...d.rows, [k]: d.rows[k].filter((r) => r.id !== id) } })), []);
  const setApproval = useCallback((s: DiscountFormData["approvalStatus"]) => setData((d) => ({ ...d, approvalStatus: s })), []);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    const f = data.fields;
    if (!f.name?.trim()) e["name"] = "Discount name is required.";
    if (f.value && Number(f.value) < 0) e["value"] = "Value cannot be negative.";
    if (f.method === "Percentage" && f.value && Number(f.value) > 100) e["value"] = "Percentage cannot exceed 100.";
    if (f.start && f.end && f.start > f.end) e["end"] = "End date must be after start date.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [data.fields]);

  const value: DiscountFormValue = { data, setField, getField, isOn, toggle, flag, setFlag, rowsOf, addRow, updateRow, removeRow, setApproval, errors, validate };
  return <DiscountFormContext.Provider value={value}>{children}</DiscountFormContext.Provider>;
}

export function useDiscountForm() {
  const ctx = useContext(DiscountFormContext);
  if (!ctx) throw new Error("useDiscountForm must be used within DiscountFormProvider");
  return ctx;
}
