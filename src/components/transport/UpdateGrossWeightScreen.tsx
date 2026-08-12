"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Scale, ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";

interface Data { id: number; gateEntryNo: string; vehicleNo: string; supplierName: string | null; entryType: string; status: string; grossWeight: number | null }

export function UpdateGrossWeightScreen() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [grossWeight, setGrossWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/transport/gate-entry/${id}/gross-weight`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j.data); })
      .finally(() => setLoading(false));
  }, [id]);

  async function submit() {
    const n = Number(grossWeight);
    if (!Number.isFinite(n) || n < 0 || grossWeight.trim() === "") { setError("Enter a valid gross weight."); return; }
    setError("");
    setSaving(true);
    const j = await fetch(`/api/transport/gate-entry/${id}/gross-weight`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grossWeight: n }),
    }).then((r) => r.json()).catch(() => ({}));
    setSaving(false);
    if (!j.ok) { setError(j.message || "Could not save."); return; }
    toast.success("Gross weight recorded.");
    router.push("/transport/gate-entry");
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading gate entry…" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-muted">Gate entry not found. <Link href="/transport/gate-entry" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/transport/gate-entry" className="hover:text-foreground">Vehicle Gate Entry</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Update Gross Weight</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> Update Gross Weight</h1>
          <p className="mt-0.5 text-sm text-muted">{data.gateEntryNo} — {data.vehicleNo}{data.supplierName ? ` — ${data.supplierName}` : ""}</p>
        </div>
        <Link href="/transport/gate-entry"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {data.grossWeight != null ? (
        <SectionCard icon={Scale} title="Gross Weight">
          <p className="text-sm text-muted">Gross weight is already recorded for this entry: <strong className="text-foreground">{data.grossWeight} Kg</strong>.</p>
        </SectionCard>
      ) : (
        <SectionCard icon={Scale} title="Gross Weight">
          <div className="max-w-xs">
            <label className="mb-1 block text-2xs font-semibold text-muted">Gross Vehicle Weight (Kg)</label>
            <input type="number" min={0} autoFocus value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} placeholder="0" className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          </div>
          {error && <p className="mt-2 text-2xs font-medium text-danger">{error}</p>}
          <div className="mt-4 flex items-center gap-2">
            <Button size="md" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Submit</Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
