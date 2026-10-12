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
import { SAMPLE_OPENING_STOCK } from "@/lib/masters/openingStockConfig";

export type Row = Record<string, string> & { id: string };
export type RowKey = "batches" | "serials" | "lots" | "uoms";

export interface OpeningStockFormData {
  fields: Record<string, string>;
  toggles: Record<string, Record<string, boolean>>;
  flags: Record<string, boolean>;
  rows: Record<RowKey, Row[]>;
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
}

interface OpeningStockFormValue {
  data: OpeningStockFormData;
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
  setApproval: (s: OpeningStockFormData["approvalStatus"]) => void;
  errors: Record<string, string>;
  validate: () => boolean;
}

function blank(): OpeningStockFormData {
  return {
    fields: { status: "Draft", uom: "PCS", method: "WAVG", inventoryAccount: "INV-1200", openingAccount: "OB-3100" },
    toggles: { dimensions: { branch: true, warehouse: true }, importSources: { excel: true }, aiChecks: {} },
    flags: { approvalRequired: true, autoAccounting: true },
    rows: { batches: [], serials: [], lots: [], uoms: [] },
    approvalStatus: "draft",
  };
}

const OpeningStockFormContext = createContext<OpeningStockFormValue | null>(null);

export function OpeningStockFormProvider({ children, stockId }: { children: ReactNode; stockId?: string }) {
  const [data, setData] = useState<OpeningStockFormData>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const counter = useRef(1);

  useEffect(() => {
    if (!stockId) return;
    const d = SAMPLE_OPENING_STOCK.find((x) => x.id === stockId);
    if (!d) return;
    setData((s) => ({
      ...s,
      fields: { ...s.fields, productCode: d.code, productName: d.name, branch: d.branch, warehouse: d.warehouse, quantity: String(d.qty), uom: d.uom, method: d.method === "FIFO" ? "FIFO" : d.method === "Standard Cost" ? "STD" : "WAVG", status: d.status },
      approvalStatus: d.status === "Approved" ? "approved" : d.status === "Rejected" ? "rejected" : d.status === "Draft" ? "draft" : "pending",
    }));
  }, [stockId]);

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
  const setApproval = useCallback((s: OpeningStockFormData["approvalStatus"]) => setData((d) => ({ ...d, approvalStatus: s })), []);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    const f = data.fields;
    if (!f.productName?.trim()) e["productName"] = "Product name is required.";
    if (!f.productCode?.trim()) e["productCode"] = "Product code is required.";
    if (!f.warehouse?.trim()) e["warehouse"] = "Warehouse is required.";
    if (!f.quantity || Number(f.quantity) <= 0) e["quantity"] = "Quantity must be greater than zero.";
    if (!f.costPrice || Number(f.costPrice) <= 0) e["costPrice"] = "Cost must be greater than zero.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [data.fields]);

  const value: OpeningStockFormValue = { data, setField, getField, isOn, toggle, flag, setFlag, rowsOf, addRow, updateRow, removeRow, setApproval, errors, validate };
  return <OpeningStockFormContext.Provider value={value}>{children}</OpeningStockFormContext.Provider>;
}

export function useOpeningStockForm() {
  const ctx = useContext(OpeningStockFormContext);
  if (!ctx) throw new Error("useOpeningStockForm must be used within OpeningStockFormProvider");
  return ctx;
}
