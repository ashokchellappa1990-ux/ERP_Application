"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SAMPLE_TEMPLATES } from "@/lib/settings/invoiceTemplateConfig";

export interface TemplateFormData {
  fields: Record<string, string>;
  toggles: Record<string, Record<string, boolean>>;
  flags: Record<string, boolean>;
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
}

interface TemplateFormValue {
  data: TemplateFormData;
  setField: (n: string, v: string) => void;
  getField: (n: string) => string;
  isOn: (g: string, id: string) => boolean;
  toggle: (g: string, id: string) => void;
  countOn: (g: string) => number;
  flag: (id: string) => boolean;
  setFlag: (id: string, v: boolean) => void;
  setApproval: (s: TemplateFormData["approvalStatus"]) => void;
  errors: Record<string, string>;
  validate: () => boolean;
}

function on(...ids: string[]) {
  return ids.reduce<Record<string, boolean>>((a, id) => ((a[id] = true), a), {});
}

function blank(): TemplateFormData {
  return {
    fields: {
      templateType: "b2b", status: "Draft",
      paperCategory: "standard", thermalSize: "80", standardSize: "A4",
      customWidth: "210", customHeight: "297", orientation: "portrait",
      marginTop: "5", marginBottom: "5", marginLeft: "5", marginRight: "5",
      barcodeType: "ean13", barcodePlacement: "header", qrPlacement: "footer",
      defaultPrinter: "", printCopies: "1", aiPrompt: "",
    },
    toggles: {
      headerComponents: on("logo", "companyName", "address", "gst"),
      customerComponents: on("custName", "custMobile", "custGst", "custAddress"),
      invoiceComponents: on("invNumber", "invDate"),
      productColumns: on("name", "hsn", "qty", "rate", "tax", "amount"),
      summaryRows: on("subtotal", "discount", "tax", "roundoff", "netAmount"),
      footerComponents: on("terms", "thankyou"),
      barcodeTypes: on("ean13", "code128"),
      qrContent: on("invNumber", "upi"),
      emailTemplates: on("invoice"),
      whatsappTemplates: on("invoiceShare", "paymentReminder"),
      printers: on("thermal", "laser"),
    },
    flags: {
      isDefault: false, autoFit: true, enableBarcode: true, enableQr: true,
      autoPrint: true, silentPrint: false, previewBeforePrint: true,
      useBranchDetails: false,
    },
    approvalStatus: "draft",
  };
}

const TemplateFormContext = createContext<TemplateFormValue | null>(null);

export function InvoiceTemplateProvider({ children, templateId }: { children: ReactNode; templateId?: string }) {
  const [data, setData] = useState<TemplateFormData>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!templateId) return;
    const t = SAMPLE_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    const typeVal = t.type.toLowerCase().includes("b2b") ? "b2b" : t.type.toLowerCase().includes("challan") ? "challan" : t.type.toLowerCase().includes("credit") ? "credit_note" : t.type.toLowerCase().includes("receipt") ? "receipt" : t.type.toLowerCase().includes("quotation") ? "quotation" : "b2c";
    const isThermal = t.paper.toLowerCase().includes("mm") && t.paper.toLowerCase().includes("thermal");
    setData((s) => ({
      ...s,
      fields: { ...s.fields, templateCode: t.code, templateName: t.name, templateType: typeVal, status: t.status, paperCategory: isThermal ? "thermal" : t.paper.includes("×") ? "custom" : "standard", standardSize: ["A5", "A4", "A3"].find((x) => t.paper.includes(x)) ?? "A4" },
      flags: { ...s.flags, isDefault: t.isDefault },
      approvalStatus: t.approval === "Approved" ? "approved" : t.approval === "Pending" ? "pending" : t.approval === "Rejected" ? "rejected" : "draft",
    }));
  }, [templateId]);

  const setField = useCallback((n: string, v: string) => setData((d) => ({ ...d, fields: { ...d.fields, [n]: v } })), []);
  const getField = useCallback((n: string) => data.fields[n] ?? "", [data.fields]);
  const isOn = useCallback((g: string, id: string) => !!data.toggles[g]?.[id], [data.toggles]);
  const toggle = useCallback((g: string, id: string) => setData((d) => { const grp = { ...(d.toggles[g] ?? {}) }; grp[id] = !grp[id]; return { ...d, toggles: { ...d.toggles, [g]: grp } }; }), []);
  const countOn = useCallback((g: string) => Object.values(data.toggles[g] ?? {}).filter(Boolean).length, [data.toggles]);
  const flag = useCallback((id: string) => !!data.flags[id], [data.flags]);
  const setFlag = useCallback((id: string, v: boolean) => setData((d) => ({ ...d, flags: { ...d.flags, [id]: v } })), []);
  const setApproval = useCallback((s: TemplateFormData["approvalStatus"]) => setData((d) => ({ ...d, approvalStatus: s })), []);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    const f = data.fields;
    const t = data.toggles;
    const anyOn = (g: string) => Object.values(t[g] ?? {}).some(Boolean);
    if (!f.templateName?.trim()) e["templateName"] = "Template name is required.";
    if (!f.templateCode?.trim()) e["templateCode"] = "Template code is required.";
    if (!f.templateType) e["templateType"] = "Select a template type.";
    if (!anyOn("productColumns")) e["productColumns"] = "Add at least one product column.";
    if (data.flags.enableBarcode && !anyOn("barcodeTypes")) e["barcodeTypes"] = "Select at least one barcode type.";
    if (data.flags.enableQr && !anyOn("qrContent")) e["qrContent"] = "Select what the QR encodes.";
    if (f.paperCategory === "custom" && (!f.customWidth || !f.customHeight)) e["customWidth"] = "Enter custom width & height.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [data]);

  const value: TemplateFormValue = { data, setField, getField, isOn, toggle, countOn, flag, setFlag, setApproval, errors, validate };
  return <TemplateFormContext.Provider value={value}>{children}</TemplateFormContext.Provider>;
}

export function useInvoiceTemplate() {
  const ctx = useContext(TemplateFormContext);
  if (!ctx) throw new Error("useInvoiceTemplate must be used within InvoiceTemplateProvider");
  return ctx;
}
