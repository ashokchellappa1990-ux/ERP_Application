"use client";

import { useEffect, useState } from "react";
import { Truck, Package, User, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useBrand } from "@/components/theme/ThemeProvider";

interface Operator { id: number; name: string }
interface Data {
  businessName: string;
  gateEntryNo: string;
  vehicleNumber: string | null;
  customerName: string | null;
  productName: string | null;
  status: string;
  nextAction: "start" | "complete" | null;
  statusMessage: string;
  operators: Operator[];
  loadingStartedAt: string | null;
  loadingStartedBy: string | null;
  loadingCompletedAt: string | null;
  loadingCompletedBy: string | null;
  loadingDuration: string | null;
}

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

const STATUS_TONE: Record<string, string> = {
  Waiting: "bg-surface-2 text-muted",
  "Inside Factory": "bg-info-subtle text-info",
  Loading: "bg-warning-subtle text-warning",
  "Loading Completed": "bg-success-subtle text-success",
  Completed: "bg-success-subtle text-success",
  Exited: "bg-primary-subtle text-primary",
  Dispatched: "bg-primary-subtle text-primary",
  Draft: "bg-surface-2 text-muted",
  Ready: "bg-info-subtle text-info",
  Cancelled: "bg-danger-subtle text-danger",
};

/** Public, no-login mobile page — reached by scanning the QR on a printed
 * Pre Load Weight Slip. Shows the gate entry's details, lets the person pick
 * their name (Loading Operator master), and Start Loading / Complete
 * Loading. Deliberately talks straight to /api/public/... (no session). */
export function PublicLoadingScreen({ token }: { token: string }) {
  const brand = useBrand();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [operatorId, setOperatorId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  async function refresh() {
    const j = await fetch(`/api/public/gate-entry-loading/${token}`, { cache: "no-store" }).then((r) => r.json());
    if (!j.ok) { setErrorMsg(j.message || "This link is invalid or has expired."); return; }
    setData(j.data);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try { await refresh(); } catch { if (active) setErrorMsg("Network error — could not load this page."); } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [token]);

  async function submit() {
    if (!data?.nextAction || !operatorId) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const j = await fetch(`/api/public/gate-entry-loading/${token}?action=${data.nextAction}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operatorId }),
      }).then((r) => r.json());
      if (!j.ok) { setErrorMsg(j.message || "Could not save. Please try again."); setBusy(false); return; }
      setDoneMsg(j.message);
      await refresh(); // pulls the fresh status + start/complete timestamps together
      setOperatorId("");
    } catch {
      setErrorMsg("Network error — please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center bg-brand-gradient px-4 py-3 shadow-sm">
        <Logo showText invert />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        {loading && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted">Loading…</p>
          </div>
        )}

        {!loading && errorMsg && !data && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <AlertTriangle className="h-8 w-8 text-danger" />
            <p className="text-sm font-semibold text-foreground">{errorMsg}</p>
          </div>
        )}

        {!loading && data && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-primary-subtle/40 px-5 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{data.businessName}</p>
              <h1 className="mt-1 flex items-center justify-center gap-2 text-lg font-bold text-foreground"><Truck className="h-5 w-5 text-primary" /> Vehicle Loading</h1>
            </div>

            <div className="space-y-3 px-5 py-4">
              <Row label="Gate Entry No" value={data.gateEntryNo} />
              {data.vehicleNumber && <Row label="Vehicle" value={data.vehicleNumber} />}
              {data.customerName && <Row label="Customer" value={data.customerName} />}
              {data.productName && <Row label="Product" value={data.productName} />}
              <div className="flex items-center justify-between pt-1">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted">Status</span>
                <span className={`rounded-full px-2.5 py-1 text-2xs font-bold ${STATUS_TONE[data.status] || "bg-surface-2 text-muted"}`}>{data.status}</span>
              </div>
            </div>

            {(data.loadingStartedAt || data.loadingCompletedAt) && (
              <div className="space-y-3 border-t border-border bg-surface-2/30 px-5 py-4">
                {data.loadingStartedAt && <Row label="Start Loading" value={`${fmtDateTime(data.loadingStartedAt)}${data.loadingStartedBy ? ` — ${data.loadingStartedBy}` : ""}`} />}
                {data.loadingCompletedAt && <Row label="Complete Loading" value={`${fmtDateTime(data.loadingCompletedAt)}${data.loadingCompletedBy ? ` — ${data.loadingCompletedBy}` : ""}`} />}
                {data.loadingDuration && <Row label="Time Taken" value={data.loadingDuration} />}
              </div>
            )}

            <div className="border-t border-border px-5 py-4">
              {doneMsg && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-success-subtle px-3 py-2.5 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> {doneMsg}
                </div>
              )}
              {errorMsg && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-danger-subtle px-3 py-2.5 text-sm font-semibold text-danger">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {errorMsg}
                </div>
              )}

              {data.nextAction ? (
                <>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground"><User className="h-3.5 w-3.5" /> Select Your Name</label>
                  <select
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value ? Number(e.target.value) : "")}
                    className="mb-3 h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">— Choose your name —</option>
                    {data.operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  {data.operators.length === 0 && <p className="mb-3 text-2xs text-danger">No loading operators are set up yet — ask your admin to add one under Masters.</p>}
                  <button
                    onClick={submit}
                    disabled={!operatorId || busy}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary text-sm font-bold text-white shadow-lg shadow-primary/25 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                    {data.nextAction === "start" ? "Start Loading" : "Complete Loading"}
                  </button>
                </>
              ) : (
                <p className="text-center text-sm text-muted">{data.statusMessage || "No action available for this gate entry right now."}</p>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      <footer className="border-t border-border bg-card px-4 py-3 text-center text-2xs text-subtle">
        © {new Date().getFullYear()} {brand.productName}. All rights reserved.
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-semibold text-primary">{value}</span>
    </div>
  );
}
