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
export type RowKey = "addresses";

export interface CustomerFormData {
  fields: Record<string, string>;
  toggles: Record<string, Record<string, boolean>>;
  flags: Record<string, boolean>;
  rows: Record<RowKey, Row[]>;
  customOptions: Record<string, string[]>;
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
}

interface CustomerFormValue {
  data: CustomerFormData;
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
  setApproval: (s: CustomerFormData["approvalStatus"]) => void;
  prefill: (patch: Record<string, string>) => void;
  errors: Record<string, string>;
  validate: () => Record<string, string>;
}

function blank(): CustomerFormData {
  return {
    fields: { status: "Active", type: "Retail Customer", category: "Regular", billCountry: "India", loyaltyTier: "Silver", preferredPayment: "Cash", ledger: "Sundry Debtors", advanceAccount: "Advance from Customers", openingReceivable: "0", openingAdvance: "0" },
    toggles: { commPrefs: { sms: true, whatsapp: true }, documents: {}, categoryPrefs: {} },
    flags: { sameAsBilling: true, creditAllowed: false, blockOnExceed: true, warnOnExceed: true, loyaltyMember: true },
    rows: { addresses: [] },
    customOptions: {},
    approvalStatus: "draft",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CustomerFormContext = createContext<CustomerFormValue | null>(null);

export function CustomerFormProvider({
  children,
  customerId,
}: {
  children: ReactNode;
  customerId?: string;
}) {
  const [data, setData] = useState<CustomerFormData>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const counter = useRef(1);

  useEffect(() => {
    if (!customerId) return;
    let abort = false;
    (async () => {
      const j = await fetch(`/api/masters/customers/${customerId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (abort || !j.ok || !j.customer) return;
      const c = j.customer as Record<string, unknown>;
      const str = (v: unknown) => (v == null ? "" : String(v));
      const f: Record<string, string> = {
        code: str(c.code), name: str(c.name), legalName: str(c.legalName), type: str(c.type), category: str(c.category), status: str(c.status) || "Active", regDate: str(c.regDate), since: str(c.since),
        c1Name: str(c.contactPerson), c1Mobile: str(c.phone), c1Email: str(c.email), c1AltMobile: str(c.altMobile), c1Whatsapp: str(c.whatsapp),
        c2Name: str(c.contact2Name), c2Mobile: str(c.contact2Mobile), c2Email: str(c.contact2Email), dob: str(c.dob), anniversary: str(c.anniversary), gender: str(c.gender),
        gstin: str(c.gstin), pan: str(c.pan), tan: str(c.tan), businessName: str(c.businessName), stateCode: str(c.stateCode),
        creditLimit: str(c.creditLimit), creditPeriod: str(c.creditPeriod),
        ledger: str(c.ledgerAccount) || "Sundry Debtors", advanceAccount: str(c.advanceAccount) || "Advance from Customers",
        openingReceivable: str(c.openingReceivable), openingAdvance: str(c.openingAdvance), notes: str(c.notes),
      };
      const addrRows: Row[] = [];
      let sameAsBilling = true;
      for (const a of (Array.isArray(c.addresses) ? (c.addresses as Record<string, unknown>[]) : [])) {
        if (a.label === "Billing") { f.billLine1 = str(a.line1); f.billLine2 = str(a.line2); f.billCity = str(a.city); f.billDistrict = str(a.district); f.billState = str(a.state); f.billCountry = str(a.country) || "India"; f.billPincode = str(a.pincode); }
        else if (a.label === "Shipping") { sameAsBilling = false; f.shipLine1 = str(a.line1); f.shipCity = str(a.city); f.shipState = str(a.state); f.shipPincode = str(a.pincode); }
        else addrRows.push({ id: `addresses-${counter.current++}`, type: str(a.label), line1: str(a.line1), city: str(a.city), pincode: str(a.pincode) });
      }
      const ap = str(c.approvalStatus) as CustomerFormData["approvalStatus"];
      setData((d) => ({
        ...d,
        fields: { ...d.fields, ...f },
        flags: { ...d.flags, creditAllowed: c.creditAllowed === true, sameAsBilling },
        rows: { ...d.rows, addresses: addrRows },
        approvalStatus: ["draft", "pending", "approved", "rejected"].includes(ap) ? ap : "draft",
      }));
    })();
    return () => { abort = true; };
  }, [customerId]);

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
    setData((d) => ({ ...d, rows: { ...d.rows, [k]: d.rows[k].map((r) => (r.id === id ? { ...r, ...patch } : r)) } }));
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

  const setApproval = useCallback((s: CustomerFormData["approvalStatus"]) => {
    setData((d) => ({ ...d, approvalStatus: s }));
  }, []);

  const prefill = useCallback((patch: Record<string, string>) => {
    setData((d) => ({ ...d, fields: { ...d.fields, ...patch } }));
  }, []);

  const validate = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    const f = data.fields;
    if (!f.name?.trim()) e["name"] = "Customer name is required.";
    if (!f.c1Mobile?.trim()) e["c1Mobile"] = "Mobile number is required.";
    else if (!/^[+\d][\d\s-]{7,14}$/.test(f.c1Mobile)) e["c1Mobile"] = "Enter a valid mobile number.";
    if (f.c1Email && !EMAIL_RE.test(f.c1Email)) e["c1Email"] = "Enter a valid email.";
    const gst = (f.gstin ?? "").trim();
    if (gst && gst.length !== 15) e["gstin"] = "GSTIN must be exactly 15 characters.";
    setErrors(e);
    return e;
  }, [data.fields]);

  const value: CustomerFormValue = {
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
  return <CustomerFormContext.Provider value={value}>{children}</CustomerFormContext.Provider>;
}

export function useCustomerForm() {
  const ctx = useContext(CustomerFormContext);
  if (!ctx) throw new Error("useCustomerForm must be used within CustomerFormProvider");
  return ctx;
}
