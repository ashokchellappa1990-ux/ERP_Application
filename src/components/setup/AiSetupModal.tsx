"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  UploadCloud,
  FileCheck2,
  ReceiptText,
  ScanLine,
  Contact,
  Globe,
  BadgeCheck,
  Pill,
  DatabaseZap,
  Building2,
  FileText,
  CreditCard,
  MapPin,
  Store,
  Mail,
  Phone,
  Check,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

/* ============================================================ methods === */

export type MethodInput = "upload" | "gstin" | "url" | "software";

export interface SmartMethod {
  id: string;
  priority: number;
  title: string;
  icon: LucideIcon;
  accuracy: string;
  effort: string;
  desc: string;
  input: MethodInput;
  recommended?: boolean;
  note?: string;
}

/** Ranked AI extraction sources (India-first ordering). */
export const SMART_METHODS: SmartMethod[] = [
  {
    id: "gst-cert",
    priority: 1,
    title: "GST Certificate Upload",
    icon: FileCheck2,
    accuracy: "95%+",
    effort: "30 sec",
    desc: "Upload your GST registration certificate (PDF). AI reads all company details.",
    input: "upload",
    recommended: true,
    note: "Recommended — the best onboarding method in India.",
  },
  {
    id: "gstin",
    priority: 2,
    title: "GST Number Entry",
    icon: ReceiptText,
    accuracy: "90%+",
    effort: "10 sec",
    desc: "Enter your GSTIN — AI fetches name, address, PAN & registration type.",
    input: "gstin",
  },
  {
    id: "invoice",
    priority: 3,
    title: "Retail Bill / Invoice Scan",
    icon: ScanLine,
    accuracy: "90%+",
    effort: "45 sec",
    desc: "Upload a purchase / sales / tax invoice. AI reads GST, tax structure & series.",
    input: "upload",
  },
  {
    id: "card",
    priority: 4,
    title: "Business Card Scan",
    icon: Contact,
    accuracy: "85%",
    effort: "20 sec",
    desc: "Upload a visiting card. AI extracts name, mobile, email, website & address.",
    input: "upload",
  },
  {
    id: "import",
    priority: 5,
    title: "Import from Software",
    icon: DatabaseZap,
    accuracy: "95%",
    effort: "2 min",
    desc: "Export from Tally, Marg, Busy, Zoho or Excel. AI maps company, FY, GST & accounts.",
    input: "software",
  },
  {
    id: "udyam",
    priority: 6,
    title: "Udyam / MSME Certificate",
    icon: BadgeCheck,
    accuracy: "90%+",
    effort: "30 sec",
    desc: "Upload your Udyam certificate. AI extracts company, address, type & owner.",
    input: "upload",
  },
  {
    id: "website",
    priority: 7,
    title: "Website Analysis",
    icon: Globe,
    accuracy: "70%",
    effort: "15 sec",
    desc: "Enter your website URL. AI extracts company, industry, products & contacts.",
    input: "url",
  },
  {
    id: "drug",
    priority: 8,
    title: "Drug License (Pharmacy)",
    icon: Pill,
    accuracy: "90%+",
    effort: "30 sec",
    desc: "Pharmacy only — AI reads licence number, pharmacy name & pharmacist details.",
    input: "upload",
  },
];

/* ----- demo extracted result (same company across methods) ----- */
const EXTRACTED = {
  company: {
    name: "Rao Super Market Pvt Ltd",
    legalName: "Rao Retail Private Limited",
    gst: "29ABCDE1234F1Z5",
    pan: "ABCDE1234F",
    address: "No. 12, MG Road, Shivajinagar",
    state: "Karnataka",
    city: "Bengaluru",
    businessType: "Retail",
    email: "info@raomart.com",
    phone: "+91 98765 43210",
  },
  gst: { gstin: "29ABCDE1234F1Z5", pan: "ABCDE1234F", regType: "regular", stateCode: "29" },
  district: "Bengaluru Urban",
  regTypeLabel: "Regular",
};

const PROCESSING_STEPS = [
  "Company Name Identified",
  "GST Number Identified",
  "Address Identified",
  "Business Type Identified",
  "Contact Details Identified",
];

const REVIEW_FIELDS: [string, string, LucideIcon][] = [
  ["Company Name", EXTRACTED.company.name, Building2],
  ["Legal Name", EXTRACTED.company.legalName, FileText],
  ["GSTIN", EXTRACTED.gst.gstin, ReceiptText],
  ["PAN", EXTRACTED.company.pan, CreditCard],
  ["Address", EXTRACTED.company.address, MapPin],
  ["State", EXTRACTED.company.state, MapPin],
  ["District", EXTRACTED.district, MapPin],
  ["Business Type", EXTRACTED.company.businessType, Store],
  ["Registration Type", EXTRACTED.regTypeLabel, ReceiptText],
  ["Email", EXTRACTED.company.email, Mail],
  ["Phone", EXTRACTED.company.phone, Phone],
];

const SOFTWARE_OPTS = ["Tally", "Marg", "Busy", "Zoho", "Excel"].map((x) => ({
  value: x,
  label: x,
}));

/* ============================================================== modal === */

type Phase = "input" | "processing" | "review";

export function AiSetupModal({
  method,
  pace,
  onClose,
}: {
  method: SmartMethod;
  pace: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("input");
  const [revealed, setRevealed] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const Icon = method.icon;

  useEffect(() => {
    if (phase !== "processing") return;
    const timers: number[] = [];
    PROCESSING_STEPS.forEach((_, idx) => {
      timers.push(window.setTimeout(() => setRevealed(idx + 1), 480 * (idx + 1)));
    });
    let c = 0;
    const interval = window.setInterval(() => {
      c += 4;
      if (c >= 96) {
        c = 96;
        window.clearInterval(interval);
      }
      setConfidence(c);
    }, 80);
    const done = window.setTimeout(
      () => setPhase("review"),
      480 * PROCESSING_STEPS.length + 700
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(interval);
      window.clearTimeout(done);
    };
  }, [phase]);

  function confirm() {
    sessionStorage.setItem(
      "oneerp.setup.start",
      JSON.stringify({
        mode: pace,
        prefill: { company: EXTRACTED.company, gst: EXTRACTED.gst },
      })
    );
    router.push("/setup");
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm">
      <div className="animate-fade-in flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">AI Company Setup</p>
              <p className="text-2xs text-muted">{method.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* -------- INPUT -------- */}
          {phase === "input" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg bg-primary-subtle/50 p-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-xs text-foreground">{method.desc}</p>
              </div>

              {(method.input === "upload" || method.input === "software") && (
                <>
                  {method.input === "software" && (
                    <Select
                      label="Existing Software"
                      options={SOFTWARE_OPTS}
                      placeholder="Select software"
                      defaultValue="Tally"
                      onChange={() => {}}
                    />
                  )}
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-subtle/30">
                    <UploadCloud className="h-8 w-8 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      Drag &amp; drop or click to upload
                    </span>
                    <span className="text-2xs text-subtle">
                      PDF, JPG or PNG — up to 10 MB
                    </span>
                    <input type="file" className="hidden" />
                  </label>
                </>
              )}

              {method.input === "gstin" && (
                <Input
                  label="GSTIN"
                  placeholder="29ABCDE1234F1Z5"
                  defaultValue="29ABCDE1234F1Z5"
                  info="Enter your 15-digit GST number — AI fetches the rest."
                  leadingIcon={<ReceiptText className="h-4 w-4" />}
                />
              )}

              {method.input === "url" && (
                <Input
                  label="Website URL"
                  placeholder="https://www.yourstore.com"
                  defaultValue="https://www.raomart.com"
                  leadingIcon={<Globe className="h-4 w-4" />}
                />
              )}

              <div className="flex items-center justify-between gap-3 pt-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-success" />
                  Accuracy {method.accuracy}
                </span>
                <span>Effort {method.effort}</span>
              </div>

              <Button block size="lg" onClick={() => setPhase("processing")}>
                <Sparkles className="h-4 w-4" />
                Analyze with AI
              </Button>
            </div>
          )}

          {/* -------- PROCESSING -------- */}
          {phase === "processing" && (
            <div className="py-4">
              <div className="flex flex-col items-center text-center">
                <span className="relative grid h-16 w-16 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  <span className="relative grid h-16 w-16 place-items-center rounded-full bg-brand-gradient text-white">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </span>
                </span>
                <h3 className="mt-4 text-base font-bold text-foreground">
                  Analyzing documents…
                </h3>
                <p className="text-xs text-muted">
                  AI is reading and extracting your company details
                </p>
              </div>

              <ul className="mx-auto mt-6 max-w-xs space-y-2.5">
                {PROCESSING_STEPS.map((s, idx) => {
                  const on = idx < revealed;
                  return (
                    <li
                      key={s}
                      className={cn(
                        "flex items-center gap-2.5 text-sm transition",
                        on ? "text-foreground" : "text-subtle/50"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full transition",
                          on ? "bg-success text-white" : "border border-border-strong"
                        )}
                      >
                        {on ? (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin text-subtle" />
                        )}
                      </span>
                      {s}
                    </li>
                  );
                })}
              </ul>

              <div className="mx-auto mt-6 max-w-xs">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted">Confidence Score</span>
                  <span className="font-bold text-primary">{confidence}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand-gradient transition-all"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* -------- REVIEW -------- */}
          {phase === "review" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-success-subtle p-3 text-success">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Details extracted successfully</p>
                  <p className="text-2xs">Confidence score: 96% — please review below.</p>
                </div>
              </div>

              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {REVIEW_FIELDS.map(([label, value, FieldIcon]) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <FieldIcon className="h-4 w-4 shrink-0 text-subtle" />
                    <span className="w-32 shrink-0 text-xs text-muted">{label}</span>
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button block size="lg" onClick={confirm}>
                  Confirm &amp; Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="lg" onClick={confirm}>
                  <Pencil className="h-4 w-4" />
                  Edit Manually
                </Button>
              </div>
              <p className="text-center text-2xs text-subtle">
                Extracted data will pre-fill your setup. You can edit any field in
                the wizard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
