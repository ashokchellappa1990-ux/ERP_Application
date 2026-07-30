"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface VariantAttr {
  id: string;
  name: string;
  type: string;
  values: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  dims: { name: string; value: string }[];
  sku: string;
  barcode: string;
  mrp: string;
  openingStock: string;
  status: string;
}

export interface ProductFormData {
  /** All scalar fields keyed by field name (unique across tabs). */
  fields: Record<string, string>;
  /** Toggle groups: group -> id -> boolean. */
  toggles: Record<string, Record<string, boolean>>;
  /** Single boolean flags (auto-barcode, qr-required, expiry-applicable…). */
  flags: Record<string, boolean>;
  /** Dynamic variant attributes (Size, Colour, …). */
  attributes: VariantAttr[];
  /** Generated stock-keeping variants (one per attribute combination). */
  variants: ProductVariant[];
  /** User-added dropdown values (per field name) for master lookups. */
  customOptions: Record<string, string[]>;
  /** Approval workflow status. */
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
}

interface ProductFormValue {
  data: ProductFormData;
  setField: (name: string, value: string) => void;
  getField: (name: string) => string;
  isOn: (group: string, id: string) => boolean;
  toggle: (group: string, id: string) => void;
  flag: (id: string) => boolean;
  setFlag: (id: string, v: boolean) => void;
  addAttr: (init?: Partial<VariantAttr>) => void;
  updateAttr: (id: string, patch: Partial<VariantAttr>) => void;
  removeAttr: (id: string) => void;
  setVariants: (v: ProductVariant[]) => void;
  updateVariant: (id: string, patch: Partial<ProductVariant>) => void;
  removeVariant: (id: string) => void;
  customOptions: Record<string, string[]>;
  addOption: (name: string, value: string) => void;
  setApproval: (s: ProductFormData["approvalStatus"]) => void;
  errors: Record<string, string>;
  validate: () => boolean;
}

function initialData(): ProductFormData {
  return {
    fields: {
      status: "Active",
      productType: "Inventory Item",
      baseUom: "Piece",
      purchaseUom: "Piece",
      salesUom: "Piece",
      taxPref: "Taxable",
      gstRate: "18%",
      barcodeType: "EAN13",
      shelfLifeType: "Months",
      alertUnit: "Days",
      // Default accounting heads so the ledgers are pre-mapped (editable).
      salesRevenueAcct: "Sales Revenue",
      salesInventoryAcct: "Inventory Asset",
      purchaseExpenseAcct: "Purchase Expense",
      purchaseInventoryAcct: "Inventory Asset",
    },
    toggles: {
      inventoryTracking: { stockMaintenance: true },
      inventoryControls: { reservation: true },
      sales: { salesAllowed: true, salesReturn: true, discountAllowed: true },
      salesControls: {},
      pharmacy: {},
    },
    flags: { autoBarcode: true, qrRequired: false, expiryApplicable: false, purchaseAllowed: true, maxDiscountEnabled: false, autoUniqueCode: false },
    attributes: [],
    variants: [],
    customOptions: {},
    approvalStatus: "draft",
  };
}

const EMAIL_OK = true; // placeholder for future cross-field checks

const ProductFormContext = createContext<ProductFormValue | null>(null);

export function ProductFormProvider({ children, initial }: { children: ReactNode; initial?: Partial<ProductFormData> }) {
  const [data, setData] = useState<ProductFormData>(() => {
    const base = initialData();
    if (!initial) return base;
    return {
      ...base,
      fields: { ...base.fields, ...(initial.fields ?? {}) },
      toggles: { ...base.toggles, ...(initial.toggles ?? {}) },
      flags: { ...base.flags, ...(initial.flags ?? {}) },
      attributes: initial.attributes ?? base.attributes,
      variants: initial.variants ?? base.variants,
      customOptions: initial.customOptions ?? base.customOptions,
      approvalStatus: initial.approvalStatus ?? base.approvalStatus,
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const counter = useRef(1);

  const setField = useCallback((name: string, value: string) => {
    setData((d) => ({ ...d, fields: { ...d.fields, [name]: value } }));
  }, []);
  const getField = useCallback((name: string) => data.fields[name] ?? "", [data.fields]);

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
  const setFlag = useCallback((id: string, v: boolean) => {
    setData((d) => ({ ...d, flags: { ...d.flags, [id]: v } }));
  }, []);

  const addAttr = useCallback((init?: Partial<VariantAttr>) => {
    const id = `attr-${counter.current++}`;
    setData((d) => ({
      ...d,
      attributes: [...d.attributes, { id, name: "", type: "Dropdown", values: "", ...init }],
    }));
  }, []);
  const updateAttr = useCallback((id: string, patch: Partial<VariantAttr>) => {
    setData((d) => ({
      ...d,
      attributes: d.attributes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }, []);
  const removeAttr = useCallback((id: string) => {
    setData((d) => ({ ...d, attributes: d.attributes.filter((a) => a.id !== id) }));
  }, []);

  const setVariants = useCallback((v: ProductVariant[]) => {
    setData((d) => ({ ...d, variants: v }));
  }, []);
  const updateVariant = useCallback((id: string, patch: Partial<ProductVariant>) => {
    setData((d) => ({ ...d, variants: d.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
  }, []);
  const removeVariant = useCallback((id: string) => {
    setData((d) => ({ ...d, variants: d.variants.filter((v) => v.id !== id) }));
  }, []);

  const addOption = useCallback((name: string, value: string) => {
    setData((d) => {
      const list = d.customOptions[name] ?? [];
      const nextFields = { ...d.fields, [name]: value };
      if (list.includes(value)) return { ...d, fields: nextFields };
      return {
        ...d,
        fields: nextFields,
        customOptions: { ...d.customOptions, [name]: [...list, value] },
      };
    });
  }, []);

  const setApproval = useCallback((s: ProductFormData["approvalStatus"]) => {
    setData((d) => ({ ...d, approvalStatus: s }));
  }, []);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!data.fields.name?.trim()) e["name"] = "Product name is required.";
    if (data.fields.hsn && !/^\d{4,8}$/.test(data.fields.hsn))
      e["hsn"] = "HSN must be 4–8 digits.";
    if (!EMAIL_OK) e["_"] = "";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [data.fields]);

  const value: ProductFormValue = {
    data,
    setField,
    getField,
    isOn,
    toggle,
    flag,
    setFlag,
    addAttr,
    updateAttr,
    removeAttr,
    setVariants,
    updateVariant,
    removeVariant,
    customOptions: data.customOptions,
    addOption,
    setApproval,
    errors,
    validate,
  };
  return (
    <ProductFormContext.Provider value={value}>
      {children}
    </ProductFormContext.Provider>
  );
}

export function useProductForm() {
  const ctx = useContext(ProductFormContext);
  if (!ctx) throw new Error("useProductForm must be used within ProductFormProvider");
  return ctx;
}
