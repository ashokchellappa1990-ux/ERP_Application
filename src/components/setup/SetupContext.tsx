"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MODE_STEPS,
  STEPS,
  type SetupMode,
  type StepId,
} from "@/lib/setup/config";

/* --------------------------------------------------------------- types -- */

type Dict = Record<string, string>;
type ToggleMap = Record<string, boolean>;

export interface BranchBank {
  id: string;
  bankName: string;
  branch: string;
  account: string;
  ifsc: string;
  type: string;
  upi: string;
}
export interface Branch {
  id: string;
  name: string;
  code: string;
  type: string;        // entity type NAME (Head Office, Warehouse, Retail Store…)
  parentCode: string;  // code of the parent branch ("" = top-level / root)
  gstin: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  openTime: string;
  closeTime: string;
  manager: string;
  contactPerson: string;
  phone: string;
  email: string;
  /** Multiple bank accounts for this branch (stored in setup_banks with branchId). */
  banks: BranchBank[];
}
export interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  address: string;
  contact: string;
  mobile: string;
  capacity: string;
  branch: string;
}
export interface BankRow {
  id: string;
  bankName: string;
  branch: string;
  account: string;
  ifsc: string;
  type: string;
  upi: string;
}
export interface UserRow {
  id: string;
  name: string;
  mobile: string;
  email: string;
  username: string;
  role: string;
}

export interface SetupData {
  company: Dict;
  profile: Dict;
  workingDays: string[];
  contacts: { primary: Dict; secondary: Dict };
  branches: Branch[];
  warehouses: WarehouseRow[];
  org: Dict;
  finance: Dict;
  banks: BankRow[];
  gst: Dict;
  admin: Dict;
  users: UserRow[];
  inventoryValuation: string;
  paymentDefault: string;
  migrationSource: string;
  industrySelected: string;
  toggles: Record<string, ToggleMap>;
  flags: ToggleMap;
}

type ArrayKey = "branches" | "warehouses" | "banks" | "users";
type RowOf = {
  branches: Branch;
  warehouses: WarehouseRow;
  banks: BankRow;
  users: UserRow;
};

export type Errors = Record<string, string>;

interface SetupContextValue {
  mode: SetupMode | null;
  setMode: (m: SetupMode) => void;
  steps: StepId[];
  stepIndex: number;
  current: StepId | null;
  progress: number;
  isFirst: boolean;
  isLast: boolean;
  goNext: () => boolean;
  goBack: () => void;
  goTo: (i: number) => void;
  completed: Set<number>;

  data: SetupData;
  patch: (section: keyof SetupData, partial: Record<string, unknown>) => void;
  patchContact: (which: "primary" | "secondary", partial: Dict) => void;
  setValue: (key: keyof SetupData, value: unknown) => void;

  isOn: (group: string, id: string) => boolean;
  toggle: (group: string, id: string) => void;
  flag: (id: string) => boolean;
  setFlag: (id: string, value: boolean) => void;

  addRow: <K extends ArrayKey>(key: K) => void;
  updateRow: <K extends ArrayKey>(
    key: K,
    id: string,
    partial: Partial<RowOf[K]>
  ) => void;
  removeRow: (key: ArrayKey, id: string) => void;

  errors: Errors;
  validate: (stepId: StepId) => boolean;
  applyErrors: (e: Errors) => void;

  loading: boolean;
  loadedStatus: "draft" | "completed" | null;
}

/* ------------------------------------------------------------- defaults - */

const seedToggles: Record<string, ToggleMap> = {
  inventory: { expiry: false, serial: false },
  inventoryRules: { reorder: true },
  pos: { barcode: true, quick: true, touch: true, hold: true, recall: true },
  receipt: { print: true },
  payment: { cash: true, upi: true, credit: true, debit: true },
  notifyChannels: { email: true, sms: true },
  notifyEvents: { sales: true, payment: true, lowstock: true },
  hardware: { thermal: true, barcode: true, drawer: true },
  modules: {
    masters: true,
    purchase: true,
    inventory: true,
    sales: true,
    accounting: true,
    gst: true,
    reports: true,
  },
  security: { otp: true, audit: true, session: true },
  orgCentralized: { inventory: true, pricing: true },
  gstTaxes: { cgst: true, sgst: true, igst: true },
  industryPharmacy: {},
  industryElectronics: {},
  industryTextile: {},
  migrationImports: {},
};

function blankData(): SetupData {
  return {
    company: { country: "India" },
    profile: {},
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    contacts: { primary: {}, secondary: {} },
    branches: [],
    warehouses: [],
    org: { type: "single" },
    finance: { currency: "INR", method: "accrual" },
    banks: [],
    gst: { regType: "regular", frequency: "monthly" },
    admin: {},
    users: [],
    inventoryValuation: "fifo",
    paymentDefault: "cash",
    migrationSource: "",
    industrySelected: "",
    toggles: JSON.parse(JSON.stringify(seedToggles)),
    flags: { gstEinvoice: true, gstEway: true },
  };
}

function newRow<K extends ArrayKey>(key: K, id: string): RowOf[K] {
  const base = { id };
  const map = {
    branches: { ...base, name: "", code: "", type: "Retail Store", parentCode: "", gstin: "", address: "", state: "", city: "", pincode: "", openTime: "", closeTime: "", manager: "", contactPerson: "", phone: "", email: "", banks: [] },
    warehouses: { ...base, name: "", code: "", type: "Main", address: "", contact: "", mobile: "", capacity: "", branch: "" },
    banks: { ...base, bankName: "", branch: "", account: "", ifsc: "", type: "Current", upi: "" },
    users: { ...base, name: "", mobile: "", email: "", username: "", role: "Store Manager" },
  };
  return map[key] as RowOf[K];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SetupContext = createContext<SetupContextValue | null>(null);

/* ------------------------------------------------------------- provider - */

export function SetupProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SetupMode | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [data, setData] = useState<SetupData>(blankData);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(true);
  const [loadedStatus, setLoadedStatus] = useState<"draft" | "completed" | null>(null);
  const idCounter = useRef(1);

  const steps = useMemo<StepId[]>(
    () => (mode ? MODE_STEPS[mode] : []),
    [mode]
  );

  const setMode = useCallback((m: SetupMode) => {
    setModeState(m);
    setStepIndex(0);
    setCompleted(new Set());
  }, []);

  // On mount: a fresh launch from Business Setup (sessionStorage handoff) takes
  // priority; otherwise resume a previously saved draft from the database.
  useEffect(() => {
    const raw = sessionStorage.getItem("oneerp.setup.start");
    if (raw) {
      sessionStorage.removeItem("oneerp.setup.start");
      try {
        const { mode: m, prefill } = JSON.parse(raw) as {
          mode?: SetupMode;
          prefill?: { company?: Dict; gst?: Dict };
        };
        if (m === "quick" || m === "standard" || m === "advanced") setMode(m);
        if (prefill?.company || prefill?.gst) {
          setData((d) => ({
            ...d,
            company: { ...d.company, ...(prefill.company ?? {}) },
            gst: { ...d.gst, ...(prefill.gst ?? {}) },
          }));
        }
      } catch {
        /* ignore malformed handoff */
      }
      setLoading(false);
      return; // fresh start — don't overwrite with a saved setup
    }

    // No handoff → load any saved setup (draft to resume, completed to view/edit).
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/company-setup", { cache: "no-store" });
        if (!res.ok) {
          if (active) setLoading(false);
          return;
        }
        const j = await res.json();
        if (active && j.exists && j.data) {
          if (j.mode === "quick" || j.mode === "standard" || j.mode === "advanced") setMode(j.mode);
          setData(j.data as SetupData);
          setStepIndex(typeof j.currentStep === "number" ? Math.max(0, j.currentStep) : 0);
          setLoadedStatus(j.status === "completed" ? "completed" : "draft");
        }
      } catch {
        /* start fresh on any error */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [setMode]);

  const patch = useCallback(
    (section: keyof SetupData, partial: Record<string, unknown>) => {
      setData((d) => ({
        ...d,
        [section]: { ...(d[section] as object), ...partial },
      }));
    },
    []
  );

  const patchContact = useCallback(
    (which: "primary" | "secondary", partial: Dict) => {
      setData((d) => ({
        ...d,
        contacts: { ...d.contacts, [which]: { ...d.contacts[which], ...partial } },
      }));
    },
    []
  );

  const setValue = useCallback((key: keyof SetupData, value: unknown) => {
    setData((d) => ({ ...d, [key]: value }));
  }, []);

  // Apply server-side validation errors (e.g. on Complete).
  const applyErrors = useCallback((e: Errors) => setErrors(e), []);

  const isOn = useCallback(
    (group: string, id: string) => !!data.toggles[group]?.[id],
    [data.toggles]
  );
  const toggle = useCallback((group: string, id: string) => {
    setData((d) => {
      const g = { ...(d.toggles[group] ?? {}) };
      g[id] = !g[id];
      return { ...d, toggles: { ...d.toggles, [group]: g } };
    });
  }, []);

  const flag = useCallback((id: string) => !!data.flags[id], [data.flags]);
  const setFlag = useCallback((id: string, value: boolean) => {
    setData((d) => ({ ...d, flags: { ...d.flags, [id]: value } }));
  }, []);

  const addRow = useCallback(<K extends ArrayKey>(key: K) => {
    const id = `row-${idCounter.current++}`;
    setData((d) => ({ ...d, [key]: [...d[key], newRow(key, id)] }));
  }, []);
  const updateRow = useCallback(
    <K extends ArrayKey>(key: K, id: string, partial: Partial<RowOf[K]>) => {
      setData((d) => ({
        ...d,
        [key]: (d[key] as RowOf[K][]).map((r) =>
          r.id === id ? { ...r, ...partial } : r
        ),
      }));
    },
    []
  );
  const removeRow = useCallback((key: ArrayKey, id: string) => {
    setData((d) => ({
      ...d,
      [key]: (d[key] as { id: string }[]).filter((r) => r.id !== id),
    }));
  }, []);

  /* --------------------------------------------------- validation ----- */
  const validate = useCallback(
    (stepId: StepId): boolean => {
      const e: Errors = {};
      const d = data;
      if (stepId === "company") {
        if (!d.company.name?.trim()) e["company.name"] = "Company name is required.";
        if (!d.company.industry) e["company.industry"] = "Select an industry category.";
        if (d.company.email && !EMAIL_RE.test(d.company.email))
          e["company.email"] = "Enter a valid email.";
        if (!d.company.phone?.trim()) e["company.phone"] = "Company phone is required.";
      }
      if (stepId === "contact") {
        if (!d.contacts.primary.name?.trim())
          e["primary.name"] = "Contact name is required.";
        if (!d.contacts.primary.mobile?.trim())
          e["primary.mobile"] = "Mobile number is required.";
        if (d.contacts.primary.email && !EMAIL_RE.test(d.contacts.primary.email))
          e["primary.email"] = "Enter a valid email.";
      }
      if (stepId === "gst") {
        const gstin = d.gst.gstin?.trim();
        if (gstin && gstin.length !== 15)
          e["gst.gstin"] = "GSTIN must be 15 characters.";
      }
      if (stepId === "users") {
        if (!d.admin.name?.trim()) e["admin.name"] = "Administrator name is required.";
        if (!d.admin.mobile?.trim()) e["admin.mobile"] = "Mobile number is required.";
        if (!d.admin.email?.trim()) e["admin.email"] = "Email is required.";
        else if (!EMAIL_RE.test(d.admin.email))
          e["admin.email"] = "Enter a valid email.";
        if (!d.admin.username?.trim()) e["admin.username"] = "Username is required.";
        if (!d.admin.password || d.admin.password.length < 8)
          e["admin.password"] = "Password must be at least 8 characters.";
      }
      setErrors(e);
      return Object.keys(e).length === 0;
    },
    [data]
  );

  const current = steps[stepIndex] ?? null;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progress = steps.length
    ? Math.round(((stepIndex + (isLast ? 1 : 0)) / steps.length) * 100)
    : 0;

  const goNext = useCallback(() => {
    if (!current) return false;
    if (!validate(current)) return false;
    setCompleted((c) => new Set(c).add(stepIndex));
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    setErrors({});
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }, [current, validate, stepIndex, steps.length]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
    setErrors({});
  }, []);

  const goTo = useCallback(
    (i: number) => {
      // allow navigating to visited/adjacent steps
      if (i <= Math.max(...Array.from(completed), stepIndex) + 1) {
        setStepIndex(i);
        setErrors({});
      }
    },
    [completed, stepIndex]
  );

  const value: SetupContextValue = {
    mode,
    setMode,
    steps,
    stepIndex,
    current,
    progress,
    isFirst,
    isLast,
    goNext,
    goBack,
    goTo,
    completed,
    data,
    patch,
    patchContact,
    setValue,
    isOn,
    toggle,
    flag,
    setFlag,
    addRow,
    updateRow,
    removeRow,
    errors,
    validate,
    applyErrors,
    loading,
    loadedStatus,
  };

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup() {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error("useSetup must be used within <SetupProvider>");
  return ctx;
}

export function stepTitle(id: StepId) {
  return STEPS.find((s) => s.id === id)?.title ?? id;
}
