"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Target, Plus, Trash2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { fetchJson, useOptions, pickerFor } from "./shared";

interface Line { key: string; dimensionType: string; dimensionRefId: number | null; dimensionValue: string | null; dimensionLabel: string; annual: number }
const uid = () => Math.random().toString(36).slice(2, 9);

export function TargetEditor({ targetId }: { targetId?: number }) {
  const router = useRouter();
  const opt = useOptions();
  const fmt = useFmt();
  const [fy, setFy] = useState("");
  const [title, setTitle] = useState("");
  const [dimension, setDimension] = useState("branch");
  const [targetType, setTargetType] = useState("salesValue");
  const [period, setPeriod] = useState("monthly");
  const [distribution, setDistribution] = useState("equal");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pickRef, setPickRef] = useState("");
  const [pickAnnual, setPickAnnual] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(!targetId);

  useEffect(() => { if (opt && !fy) setFy(opt.fyList[1] ?? opt.fyList[0] ?? ""); }, [opt, fy]);

  // Edit mode: hydrate
  useEffect(() => {
    if (!targetId) return;
    fetchJson<{ ok: boolean; target: { fy: string; title: string | null; dimension: string; targetType: string; period: string; distribution: string; remarks: string | null; lines: { dimensionType: string; dimensionRefId: number | null; dimensionValue: string | null; dimensionLabel: string | null; annual: number }[] } }>(`/api/sales/target/${targetId}`).then((j) => {
      if (!j.ok) return; const t = j.target;
      setFy(t.fy); setTitle(t.title ?? ""); setDimension(t.dimension); setTargetType(t.targetType); setPeriod(t.period); setDistribution(t.distribution); setRemarks(t.remarks ?? "");
      setLines(t.lines.map((l) => ({ key: uid(), dimensionType: l.dimensionType, dimensionRefId: l.dimensionRefId, dimensionValue: l.dimensionValue, dimensionLabel: l.dimensionLabel ?? "", annual: Number(l.annual) })));
      setLoaded(true);
    });
  }, [targetId]);

  const picker = useMemo(() => (opt ? pickerFor(dimension, opt.options) : null), [opt, dimension]);
  const total = lines.reduce((s, l) => s + (Number(l.annual) || 0), 0);

  const addLine = () => {
    const annual = Number(pickAnnual) || 0; if (annual <= 0) { setErr("Enter a target value."); return; }
    if (dimension === "business") {
      if (lines.length) { setErr("Business dimension has a single line."); return; }
      setLines([{ key: uid(), dimensionType: "business", dimensionRefId: null, dimensionValue: null, dimensionLabel: "Business", annual }]);
    } else {
      if (!picker || !pickRef) { setErr("Pick a value."); return; }
      const item = picker.items.find((x) => String(picker.mode === "ref" ? x.id : x.value) === pickRef);
      if (!item) return;
      if (lines.some((l) => (picker.mode === "ref" ? l.dimensionRefId === item.id : l.dimensionValue === item.value))) { setErr("Already added."); return; }
      setLines([...lines, { key: uid(), dimensionType: dimension, dimensionRefId: picker.mode === "ref" ? item.id! : null, dimensionValue: picker.mode === "value" ? item.value! : null, dimensionLabel: item.name, annual }]);
    }
    setPickRef(""); setPickAnnual(""); setErr("");
  };

  const save = async (submit: boolean) => {
    if (!fy) { setErr("Select a financial year."); return; }
    if (!lines.length) { setErr("Add at least one target line."); return; }
    setBusy(true); setErr("");
    const body = { fy, title, dimension, targetType, period, distribution, currency: "INR", remarks, lines: lines.map((l) => ({ dimensionType: l.dimensionType, dimensionRefId: l.dimensionRefId, dimensionValue: l.dimensionValue, dimensionLabel: l.dimensionLabel, annual: l.annual })) };
    const res = targetId
      ? await fetchJson<{ ok: boolean; id?: number; message?: string }>(`/api/sales/target/${targetId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      : await fetchJson<{ ok: boolean; id?: number; message?: string }>(`/api/sales/target`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setErr(res.message || "Save failed."); setBusy(false); return; }
    const id = targetId ?? res.id!;
    if (submit) await fetchJson(`/api/sales/target/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit" }) });
    router.push(`/sales/target/${id}`);
  };

  if (!opt || !loaded) return <div className="p-10"><AppLoader label="Loading…" /></div>;
  const dimComputable = opt.dimensions.find((d) => d.key === dimension)?.computable !== false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white"><Target className="h-6 w-6" /></span>
        <div><h1 className="text-lg font-bold text-foreground">{targetId ? "Edit Target" : "New Sales Target"}</h1><p className="text-xs text-muted">Choose a dimension &amp; type, add lines, then submit for approval.</p></div>
      </div>

      {/* Header */}
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Financial Year"><select value={fy} onChange={(e) => setFy(e.target.value)} className={inp}>{opt.fyList.map((f) => <option key={f} value={f}>{f}</option>)}</select></Field>
        <Field label="Title (optional)"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} placeholder="e.g. FY26-27 branch plan" /></Field>
        <Field label="Target Dimension"><select value={dimension} onChange={(e) => { setDimension(e.target.value); setLines([]); setPickRef(""); }} className={inp}>{opt.dimensions.map((d) => <option key={d.key} value={d.key}>{d.label}{d.computable === false ? " (plan-only)" : ""}</option>)}</select></Field>
        <Field label="Target Type"><select value={targetType} onChange={(e) => setTargetType(e.target.value)} className={inp}>{opt.targetTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></Field>
        <Field label="Period"><select value={period} onChange={(e) => setPeriod(e.target.value)} className={inp}>{opt.periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></Field>
        <Field label="Distribution"><select value={distribution} onChange={(e) => setDistribution(e.target.value)} className={inp}>{opt.distributions.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select></Field>
      </div>

      {!dimComputable && <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-2xs text-warning">This dimension is planning-only — achievement isn&apos;t auto-measured from sales.</div>}

      {/* Line builder */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-foreground">Target Lines</h2>
        <div className="flex flex-wrap items-end gap-2">
          {dimension !== "business" && picker && (
            <Field label="Assign to"><select value={pickRef} onChange={(e) => setPickRef(e.target.value)} className={`${inp} min-w-[14rem]`}><option value="">Select {dimension}…</option>{picker.items.map((x) => <option key={String(x.id ?? x.value)} value={String(picker.mode === "ref" ? x.id : x.value)}>{x.name}</option>)}</select></Field>
          )}
          <Field label="Annual Target"><input value={pickAnnual} onChange={(e) => setPickAnnual(e.target.value)} type="number" className={`${inp} w-40`} placeholder="0" /></Field>
          <Button size="sm" variant="secondary" onClick={addLine}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>

        {lines.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wide text-muted"><th className="py-1.5">Dimension</th><th className="py-1.5 text-right">Annual Target</th><th className="py-1.5" /></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 font-medium text-foreground">{l.dimensionLabel}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt.money(l.annual)}</td>
                  <td className="py-1.5 text-right"><button onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="rounded p-1 hover:bg-surface-2"><Trash2 className="h-4 w-4 text-danger" /></button></td>
                </tr>
              ))}
              <tr className="font-bold"><td className="py-2">Total</td><td className="py-2 text-right tabular-nums text-foreground">{fmt.money(total)}</td><td /></tr>
            </tbody>
          </table>
        )}
      </div>

      <Field label="Remarks"><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className={`${inp} h-16 w-full py-1.5`} /></Field>
      {err && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</div>}
      <div className="flex items-center gap-2">
        <Button onClick={() => save(false)} disabled={busy} variant="outline"><Save className="h-4 w-4" /> Save Draft</Button>
        <Button onClick={() => save(true)} disabled={busy}><Send className="h-4 w-4" /> Save &amp; Submit</Button>
      </div>
    </div>
  );
}

const inp = "h-9 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</span>{children}</label>;
}
