"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Boxes, IndianRupee, CalendarClock, Warehouse, Pencil,
  Printer, Sparkles, CheckCircle2, X, Layers, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { QrCode } from "@/components/ui/QrCode";
import { qrSvgString } from "@/lib/masters/qr";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { formatMoneyWith, type GeneralConfigData } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import type { OpeningStockDetail as ViewDoc, OpeningStockDetailLine as ViewLine } from "@/lib/contracts/openingStock";

interface QrSettings {
  darkColor: string; lightColor: string; errorCorrection: "L" | "M" | "Q" | "H"; moduleStyle: "square" | "dots" | "rounded";
  labelWidthMm: number; labelHeightMm: number; showName: boolean; showPrice: boolean; showCodeText: boolean; defaultMode: "shared" | "unique";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

export default function OpeningStockViewPage() {
  const fmt = useFmt();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [doc, setDoc] = useState<ViewDoc | null>(null);
  const [settings, setSettings] = useState<QrSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [mode, setMode] = useState<Record<number, "shared" | "unique">>({});
  const [printFor, setPrintFor] = useState<ViewLine | null>(null);

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([
      fetch(`/api/inventory/opening-stock/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/settings/qr-code`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]);
    if (d.ok) {
      setDoc(d.data);
      setMode((prev) => { const next = { ...prev }; for (const l of d.data.lines) next[l.id] = next[l.id] || l.qrMode || s.settings?.defaultMode || "shared"; return next; });
    }
    if (s.ok) setSettings(s.settings);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function generate(line: ViewLine) {
    setBusy(line.id);
    await fetch(`/api/inventory/opening-stock/${id}/qr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineId: line.id, mode: mode[line.id] }) });
    await load();
    setBusy(null);
  }

  async function doPrint(line: ViewLine, count: number) {
    setBusy(line.id);
    const res = await fetch(`/api/inventory/opening-stock/${id}/qr/print`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineId: line.id, count }) });
    const j = await res.json().catch(() => ({}));
    if (j.ok && settings) printSheet(j.codes as string[], j.line, settings, fmt.cfg);
    setPrintFor(null);
    await load();
    setBusy(null);
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading document…" /></div>;
  if (!doc) return <div className="py-16 text-center text-sm text-muted">Document not found. <Link href="/masters/opening-stock" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <Link href="/masters/opening-stock" className="hover:text-foreground">Opening Stock Setup</Link>
            <span className="text-subtle">/</span><span className="font-medium text-foreground">{doc.docNo}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{doc.docNo}</h1>
            <Badge tone={doc.status === "Submitted" ? "success" : "warning"}>{doc.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-subtle">Application Reference Number — generate &amp; print QR labels for each stock line below.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/masters/opening-stock"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Link href={`/masters/opening-stock/bulk?id=${doc.id}`}><Button size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Meta icon={CalendarClock} label="As-on Date" value={doc.asOnDate} />
        <Meta icon={Warehouse} label="Warehouse" value={doc.warehouse || "—"} />
        <Meta icon={Boxes} label="Total Quantity" value={fmt.qty(doc.totalQty)} />
        <Meta icon={IndianRupee} label="Stock Value" value={fmt.money(doc.totalValue)} />
      </div>

      {/* Lines + QR controls */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Stock Lines &amp; QR Labels</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">QR Mode</th>
                <th className="px-4 py-3 text-center">QR Status</th>
                <th className="px-4 py-3 text-center">Printed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l) => {
                const generated = l.qrStatus === "Generated";
                const printed = l.printedQty > 0;
                const isShared = (generated ? l.qrMode : mode[l.id]) === "shared";
                const lineBusy = busy === l.id;
                return (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{l.productName}</div>
                      <div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt.qty(l.qty)}</td>
                    <td className="px-4 py-3 text-2xs text-muted">{l.batchNo || "—"}{l.expiryDate ? ` · exp ${l.expiryDate}` : ""}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex overflow-hidden rounded-md border border-border">
                        {(["shared", "unique"] as const).map((m) => (
                          <button key={m} disabled={generated} onClick={() => setMode((p) => ({ ...p, [l.id]: m }))}
                            className={cn("px-2.5 py-1 text-2xs font-semibold transition", (mode[l.id] || "shared") === m ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2", generated && "cursor-not-allowed opacity-70")}>
                            {m === "shared" ? "Same" : "Unique"}
                          </button>
                        ))}
                      </div>
                      <div className="mt-0.5 text-[10px] text-subtle">{(mode[l.id] || "shared") === "shared" ? "1 code, all qty" : "1 code per piece"}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!generated ? (
                        <Badge tone="neutral">Pending</Badge>
                      ) : printed ? (
                        <Badge tone="success">Code Generated &amp; Printed</Badge>
                      ) : (
                        <Badge tone="warning">Code Generated, Not Printed</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-2xs">
                      {generated ? <span className={cn("font-semibold", l.printedQty >= l.qty ? "text-success" : "text-warning")}>{l.printedQty} / {l.qty}</span> : <span className="text-subtle">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Generate when pending; allow Regenerate only for per-piece (unique) codes. */}
                        {(!generated || !isShared) && (
                          <Button variant={generated ? "outline" : "primary"} size="sm" onClick={() => generate(l)} disabled={lineBusy}>
                            <Sparkles className="h-3.5 w-3.5" /> {generated ? "Regenerate" : lineBusy ? "…" : "Generate"}
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setPrintFor(l)} disabled={!generated || lineBusy}>
                          <Printer className="h-3.5 w-3.5" /> Print
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {printFor && settings && <PrintDialog line={printFor} settings={settings} busy={busy === printFor.id} onClose={() => setPrintFor(null)} onPrint={(n) => doPrint(printFor, n)} />}
    </div>
  );
}

/* ---- print sheet (new window) ---- */
function printSheet(codes: string[], line: { name: string; sku: string; mrp: number | null }, s: QrSettings, cfg: GeneralConfigData) {
  const cards = codes.map((code) => `
    <div class="lbl">
      <div class="qr">${qrSvgString(code, 150, { dark: s.darkColor, light: s.lightColor, ec: s.errorCorrection, style: s.moduleStyle })}</div>
      <div class="meta">
        ${s.showName ? `<div class="nm">${esc(line.name)}</div>` : ""}
        ${s.showCodeText ? `<div class="cd">${esc(code)}</div>` : ""}
        ${s.showPrice && line.mrp ? `<div class="pr">MRP ${esc(formatMoneyWith(cfg, line.mrp))}</div>` : ""}
      </div>
    </div>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR Labels — ${esc(line.name)}</title><style>
    @page{margin:8mm}*{box-sizing:border-box}body{font-family:ui-sans-serif,system-ui,Arial;margin:0;color:#0f172a}
    .sheet{display:grid;grid-template-columns:repeat(auto-fill,${s.labelWidthMm}mm);gap:3mm}
    .lbl{width:${s.labelWidthMm}mm;height:${s.labelHeightMm}mm;border:0.3mm dashed #cbd5e1;border-radius:1.5mm;padding:1.5mm;display:flex;gap:1.5mm;align-items:center;page-break-inside:avoid;overflow:hidden}
    .qr svg{width:${Math.min(s.labelHeightMm - 4, s.labelWidthMm * 0.45)}mm;height:${Math.min(s.labelHeightMm - 4, s.labelWidthMm * 0.45)}mm;display:block}
    .meta{min-width:0;flex:1}.nm{font-size:6.5pt;font-weight:700;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .cd{font-family:ui-monospace,monospace;font-size:5pt;color:#334155;margin-top:0.5mm;word-break:break-all}.pr{font-size:6.5pt;font-weight:700;margin-top:0.5mm}
  </style></head><body><div class="sheet">${cards}</div><script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`;
  const w = window.open("", "_blank", "width=920,height=720");
  if (!w) return;
  w.document.write(html); w.document.close();
}

function PrintDialog({ line, settings, busy, onClose, onPrint }: { line: ViewLine; settings: QrSettings; busy: boolean; onClose: () => void; onPrint: (n: number) => void }) {
  const remaining = Math.max(0, line.qty - line.printedQty);
  const [count, setCount] = useState<number>(remaining > 0 ? remaining : line.qty);
  const sampleCode = line.sku || "ITEM";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><Printer className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-foreground">Print QR Labels</h2><p className="text-2xs text-muted">{line.productName}</p></div></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Quantity" value={line.qty} icon={Boxes} />
            <Stat label={line.qrMode === "unique" ? "Unique codes" : "Shared code"} value={line.qrMode === "unique" ? line.qrGeneratedCount : 1} icon={line.qrMode === "unique" ? Hash : Layers} />
            <Stat label="Printed" value={line.printedQty} icon={Printer} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">How many labels to print now?</label>
            <input type="number" min={1} max={5000} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-2xs">
              {remaining > 0 && <button onClick={() => setCount(remaining)} className="rounded border border-border bg-surface px-2 py-0.5 text-muted hover:border-primary hover:text-primary">Remaining ({remaining})</button>}
              <button onClick={() => setCount(line.qty)} className="rounded border border-border bg-surface px-2 py-0.5 text-muted hover:border-primary hover:text-primary">All ({line.qty})</button>
              <button onClick={() => setCount(10)} className="rounded border border-border bg-surface px-2 py-0.5 text-muted hover:border-primary hover:text-primary">10</button>
            </div>
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-info-subtle px-3 py-2 text-2xs text-info">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {line.qrMode === "unique" ? "Each label carries a different reference number. Partial prints continue from where you left off." : "Every label carries the same reference number. You can reprint any count, any time."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 rounded-lg bg-surface-2 p-3">
            <QrCode value={sampleCode} size={56} options={{ dark: settings.darkColor, light: settings.lightColor, ec: settings.errorCorrection, style: settings.moduleStyle }} />
            <div className="text-2xs text-muted">Sample label appearance<br /><span className="text-subtle">styled from QR Code Settings</span></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={() => onPrint(Math.max(1, count))} disabled={busy}><Printer className="h-4 w-4" /> {busy ? "Printing…" : `Print ${Math.max(1, count)} Label${count > 1 ? "s" : ""}`}</Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Boxes }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <Icon className="mx-auto h-3.5 w-3.5 text-muted" />
      <div className="mt-0.5 text-sm font-bold text-foreground">{value}</div>
      <div className="text-[10px] text-subtle">{label}</div>
    </div>
  );
}
function Meta({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0"><div className="truncate text-sm font-bold text-foreground">{value}</div><div className="text-2xs text-subtle">{label}</div></div>
    </div>
  );
}
