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
export type Row = Record<string, string> & { id: string };
export type RowKey = "banks" | "products" | "branches";

export interface SupplierFormData {
  fields: Record<string, string>;
  toggles: Record<string, Record<string, boolean>>;
  flags: Record<string, boolean>;
  rows: Record<RowKey, Row[]>;
  customOptions: Record<string, string[]>;
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
}

interface SupplierFormValue {
  data: SupplierFormData;
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
  customOptions: Record<string, string[]>;
  addOption: (n: string, v: string) => void;
  setApproval: (s: SupplierFormData["approvalStatus"]) => void;
  prefill: (patch: Record<string, string>) => void;
  errors: Record<string, string>;
  validate: () => boolean;
}

function blank(): SupplierFormData {
  return {
    fields: { status: "Active", type: "Distributor", category: "Finished Goods", regCountry: "India", regType: "regular", paymentTerms: "30 Days" },
    toggles: {
      commPrefs: { email: true, sms: true },
      paymentModes: { bank: true, upi: true },
      documents: {},
    },
    flags: { sameAsReg: true, tdsApplicable: false, preferredSupplier: false, purchaseApproval: true, creditAllowed: true, docExpiry: false, allBranches: true },
    rows: { banks: [], products: [], branches: [] },
    customOptions: {},
    approvalStatus: "draft",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SupplierFormContext = createContext<SupplierFormValue | null>(null);

export function SupplierFormProvider({
  children,
  supplierId,
}: {
  children: ReactNode;
  supplierId?: string;
}) {
  const [data, setData] = useState<SupplierFormData>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const counter = useRef(1);

  // Edit mode: hydrate from the API (supplier + addresses).
  useEffect(() => {
    if (!supplierId) return;
    let abort = false;
    (async () => {
      const j = await fetch(`/api/masters/suppliers/${supplierId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (abort || !j.ok || !j.supplier) return;
      const sp = j.supplier as Record<string, unknown>;
      const str = (v: unknown) => (v == null ? "" : String(v));
      const f: Record<string, string> = {
        code: str(sp.code), name: str(sp.name), legalName: str(sp.legalName), type: str(sp.type), category: str(sp.category), status: str(sp.status) || "Active", website: str(sp.website), description: str(sp.description),
        c1Name: str(sp.contactPerson), c1Designation: str(sp.contact1Designation), c1Mobile: str(sp.phone), c1AltMobile: str(sp.altMobile), c1Email: str(sp.email),
        c2Name: str(sp.contact2Name), c2Designation: str(sp.contact2Designation), c2Mobile: str(sp.contact2Mobile), c2Email: str(sp.contact2Email),
        gstin: str(sp.gstin), pan: str(sp.pan), tan: str(sp.tan), stateCode: str(sp.stateCode), placeOfSupply: str(sp.placeOfSupply), tdsPct: str(sp.tdsPct),
        bankName: str(sp.bankName), branch: str(sp.bankBranch), holder: str(sp.accountHolder), account: str(sp.accountNumber), ifsc: str(sp.ifsc), upi: str(sp.upi),
        creditLimit: str(sp.creditLimit), creditPeriod: str(sp.creditPeriod), paymentTerms: str(sp.paymentTerms) || "30 Days",
        ledger: str(sp.ledgerAccount), advanceAccount: str(sp.advanceAccount), purchaseAccount: str(sp.purchaseAccount), openingPayable: str(sp.openingPayable), openingAdvance: str(sp.openingAdvance), notes: str(sp.notes),
      };
      let sameAsReg = true;
      for (const a of (Array.isArray(sp.addresses) ? (sp.addresses as Record<string, unknown>[]) : [])) {
        if (a.label === "Registered") { f.regLine1 = str(a.line1); f.regLine2 = str(a.line2); f.regCity = str(a.city); f.regDistrict = str(a.district); f.regState = str(a.state); f.regCountry = str(a.country) || "India"; f.regPincode = str(a.pincode); }
        else if (a.label === "Communication") { sameAsReg = false; f.commLine1 = str(a.line1); f.commCity = str(a.city); f.commState = str(a.state); f.commPincode = str(a.pincode); }
      }
      const ap = str(sp.approvalStatus) as SupplierFormData["approvalStatus"];
      setData((d) => ({
        ...d,
        fields: { ...d.fields, ...f },
        flags: { ...d.flags, preferredSupplier: sp.preferred === true, creditAllowed: sp.creditAllowed === true, sameAsReg },
        approvalStatus: ["draft", "pending", "approved", "rejected"].includes(ap) ? ap : "draft",
      }));
    })();
    return () => { abort = true; };
  }, [supplierId]);

  const setField = useCallback((n: string, v: string) => {
    setData((d) => ({ ...d, fields: { ...d.fields, [n]: v } }));
  }, []);
  const getField = useCallback((n: string) => data.fields[n] ?? "", [data.fields]);

  const isOn = useCallback((g: string, id: string) => !!data.toggles[g]?.[id], [data.toggles]);
  const toggle = useCallback((g: string, id: string) => {
    setData((d) => {
      const grp = { ...(d.toggles[g] ?? {}) };
      grp[id] = !grp[id];
      return { ...d, toggles: { ...d.toggles, [g]: grp } };
    });
  }, []);

  const flag = useCallback((id: string) => !!data.flags[id], [data.flags]);
  const setFlag = useCallback((id: string, v: boolean) => {
    setData((d) => ({ ...d, flags: { ...d.flags, [id]: v } }));
  }, []);

  const rowsOf = useCallback((k: RowKey) => data.rows[k], [data.rows]);
  const addRow = useCallback((k: RowKey) => {
    const id = `${k}-${counter.current++}`;
    setData((d) => ({ ...d, rows: { ...d.rows, [k]: [...d.rows[k], { id }] } }));
  }, []);
  const updateRow = useCallback((k: RowKey, id: string, patch: Record<string, string>) => {
    setData((d) => ({
      ...d,
      rows: { ...d.rows, [k]: d.rows[k].map((r) => (r.id === id ? { ...r, ...patch } : r)) },
    }));
  }, []);
  const removeRow = useCallback((k: RowKey, id: string) => {
    setData((d) => ({ ...d, rows: { ...d.rows, [k]: d.rows[k].filter((r) => r.id !== id) } }));
  }, []);

  const addOption = useCallback((n: string, v: string) => {
    setData((d) => {
      const list = d.customOptions[n] ?? [];
      const fields = { ...d.fields, [n]: v };
      if (list.includes(v)) return { ...d, fields };
      return { ...d, fields, customOptions: { ...d.customOptions, [n]: [...list, v] } };
    });
  }, []);

  const setApproval = useCallback((s: SupplierFormData["approvalStatus"]) => {
    setData((d) => ({ ...d, approvalStatus: s }));
  }, []);

  const prefill = useCallback((patch: Record<string, string>) => {
    setData((d) => ({ ...d, fields: { ...d.fields, ...patch } }));
  }, []);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    const f = data.fields;
    if (!f.name?.trim()) e["name"] = "Supplier name is required.";
    if (!f.c1Name?.trim()) e["c1Name"] = "Primary contact name is required.";
    if (!f.c1Mobile?.trim()) e["c1Mobile"] = "Primary mobile is required.";
    else if (!/^[+\d][\d\s-]{7,14}$/.test(f.c1Mobile)) e["c1Mobile"] = "Enter a valid mobile number.";
    if (f.c1Email && !EMAIL_RE.test(f.c1Email)) e["c1Email"] = "Enter a valid email.";
    { const gst = (f.gstin ?? "").trim(); if (gst && gst.length !== 15) e["gstin"] = "GSTIN must be exactly 15 characters."; }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [data.fields]);

  const value: SupplierFormValue = {
    data,
    setField,
    getField,
    isOn,
    toggle,
    flag,
    setFlag,
    rowsOf,
    addRow,
    updateRow,
    removeRow,
    customOptions: data.customOptions,
    addOption,
    setApproval,
    prefill,
    errors,
    validate,
  };
  return <SupplierFormContext.Provider value={value}>{children}</SupplierFormContext.Provider>;
}

export function useSupplierForm() {
  const ctx = useContext(SupplierFormContext);
  if (!ctx) throw new Error("useSupplierForm must be used within SupplierFormProvider");
  return ctx;
}
