"use client";

import { useEffect, useState } from "react";
import { Building2, X, MapPin, Phone, Landmark, Clock, BadgeCheck, User } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";

interface BranchInfo {
  id: number; name: string; code: string; type: string; status: string; isDefault: boolean;
  manager: string; contactPerson: string; phone: string; email: string;
  gstin: string; address: string; city: string; state: string; pincode: string;
  openTime: string; closeTime: string;
  bankName: string; bankAccount: string; bankIfsc: string; bankUpi: string;
  businessName: string; businessGstin: string;
}

/** Read-only branch setup panel shown from the dashboard "View Branch Setup" CTA.
 * Pulls the signed-in user's own branch (incl. bank details) from the DB. */
export function BranchSetupModal({ onClose }: { onClose: () => void }) {
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/system/branches/me", { cache: "no-store" }).then((r) => r.json());
        if (j.ok) setBranch(j.branch);
        else setError(j.message || "Could not load branch setup.");
      } catch { setError("Could not reach the server. Please try again."); }
      finally { setLoading(false); }
    })();
  }, []);

  const addr = branch ? [branch.address, branch.city, branch.state, branch.pincode].filter(Boolean).join(", ") : "";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-2 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white"><Building2 className="h-5 w-5" /></span>
            <div>
              <h3 className="text-base font-bold text-foreground">Branch Setup</h3>
              <p className="text-2xs text-muted">{branch ? `${branch.businessName || "Your business"} · view only` : "Loading…"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted transition hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="py-16"><AppLoader label="Loading branch setup…" /></div>
        ) : error ? (
          <div className="px-5 py-12 text-center text-sm text-muted">{error}</div>
        ) : branch ? (
          <div className="space-y-5 px-5 py-5">
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-bold text-foreground">{branch.name}</h4>
              <Badge tone="primary" className="font-mono">{branch.code}</Badge>
              <Badge tone={branch.status === "active" ? "success" : "neutral"}>{branch.status === "active" ? "Active" : "Inactive"}</Badge>
              {branch.isDefault && <Badge tone="info">Default</Badge>}
            </div>

            <Section icon={BadgeCheck} title="Branch Details">
              <KV k="Branch Type" v={branch.type} />
              <KV k="Branch GSTIN" v={branch.gstin} mono />
              <KV k="Business" v={branch.businessName} />
              <KV k="Business GSTIN" v={branch.businessGstin} mono />
            </Section>

            <Section icon={User} title="Contact">
              <KV k="Manager" v={branch.manager} />
              <KV k="Contact Person" v={branch.contactPerson} />
              <KV k="Phone" v={branch.phone} icon={<Phone className="h-3 w-3" />} />
              <KV k="Email" v={branch.email} />
            </Section>

            <Section icon={MapPin} title="Address & Hours">
              <KV k="Address" v={addr} full />
              {(branch.openTime || branch.closeTime) && <KV k="Operating Hours" v={[branch.openTime, branch.closeTime].filter(Boolean).join(" – ")} icon={<Clock className="h-3 w-3" />} />}
            </Section>

            <Section icon={Landmark} title="Bank Details">
              <KV k="Bank Name" v={branch.bankName} />
              <KV k="Account Number" v={branch.bankAccount} mono />
              <KV k="IFSC" v={branch.bankIfsc} mono />
              <KV k="UPI ID" v={branch.bankUpi} mono />
            </Section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><Icon className="h-3.5 w-3.5 text-primary" /> {title}</p>
      <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}
function KV({ k, v, mono, full, icon }: { k: string; v: string; mono?: boolean; full?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{k}</div>
      <div className={`mt-0.5 flex items-center gap-1.5 text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{icon}{v || <span className="text-subtle">—</span>}</div>
    </div>
  );
}
