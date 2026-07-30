"use client";

import { useMemo, useState } from "react";
import { X, Printer, QrCode as QrCodeIcon, Hash, Layers, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { qrSvgString } from "@/lib/masters/qr";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

export interface QrTarget {
  name: string;
  code: string;
  sku: string;
  barcode?: string;
  mrp?: number;
  stock?: number;
}

type CodeMode = "perPiece" | "single";

const SIZES = {
  S: { label: "Small", w: 38, h: 25, qr: 18, fs: 5.5, fsCode: 5, cols: "repeat(auto-fill,38mm)" },
  M: { label: "Medium", w: 50, h: 30, qr: 22, fs: 6.5, fsCode: 5.5, cols: "repeat(auto-fill,50mm)" },
  L: { label: "Large", w: 65, h: 38, qr: 28, fs: 8, fsCode: 6.5, cols: "repeat(auto-fill,65mm)" },
} as const;
type SizeKey = keyof typeof SIZES;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

/** Build the per-piece / single list of sticker codes. */
function buildCodes(base: string, qty: number, mode: CodeMode): string[] {
  const n = Math.max(1, Math.min(500, Math.floor(qty) || 1));
  if (mode === "single") return Array.from({ length: n }, () => base);
  const pad = String(n).length < 3 ? 3 : String(n).length;
  return Array.from({ length: n }, (_, i) => `${base}-${String(i + 1).padStart(pad, "0")}`);
}

export function QrStickerModal({ target, onClose }: { target: QrTarget; onClose: () => void }) {
  const fmt = useFmt();
  const base = target.sku || target.code || target.name;
  const [mode, setMode] = useState<CodeMode>("single");
  const [qty, setQty] = useState<number>(target.stock && target.stock > 0 ? Math.min(target.stock, 100) : 1);
  const [size, setSize] = useState<SizeKey>("M");

  const codes = useMemo(() => buildCodes(base, qty, mode), [base, qty, mode]);
  const dims = SIZES[size];

  function print() {
    const cards = codes
      .map(
        (code) => `
      <div class="st">
        <div class="qr">${qrSvgString(code, 120)}</div>
        <div class="meta">
          <div class="nm">${esc(target.name)}</div>
          <div class="cd">${esc(code)}</div>
          ${target.mrp ? `<div class="pr">MRP ${esc(fmt.money(target.mrp))}</div>` : ""}
        </div>
      </div>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR Stickers — ${esc(target.name)}</title>
      <style>
        @page { margin: 8mm; }
        * { box-sizing: border-box; }
        body { font-family: ui-sans-serif, system-ui, Arial, sans-serif; margin: 0; color: #0f172a; }
        .sheet { display: grid; grid-template-columns: ${dims.cols}; gap: 3mm; }
        .st { width: ${dims.w}mm; height: ${dims.h}mm; border: 0.3mm dashed #cbd5e1; border-radius: 1.5mm;
              padding: 1.5mm; display: flex; gap: 1.5mm; align-items: center; page-break-inside: avoid; overflow: hidden; }
        .qr svg { width: ${dims.qr}mm; height: ${dims.qr}mm; display: block; }
        .meta { min-width: 0; flex: 1; }
        .nm { font-size: ${dims.fs}pt; font-weight: 700; line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .cd { font-family: ui-monospace, "Courier New", monospace; font-size: ${dims.fsCode}pt; color: #334155; margin-top: 0.6mm; word-break: break-all; }
        .pr { font-size: ${dims.fs}pt; font-weight: 700; margin-top: 0.6mm; }
      </style></head><body>
      <div class="sheet">${cards}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>
      </body></html>`;
    const w = window.open("", "_blank", "width=920,height=720");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white">
              <QrCodeIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Generate QR Stickers</h2>
              <p className="text-2xs text-muted">{target.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-5 overflow-y-auto p-5 sm:grid-cols-[1fr_220px]">
          <div className="space-y-5">
            {/* Coding mode */}
            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">How should the codes be assigned?</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <ModeCard
                  active={mode === "single"}
                  icon={Layers}
                  title="Single code for all pieces"
                  desc="Every piece shares one code. Inventory is tracked by quantity."
                  onClick={() => setMode("single")}
                />
                <ModeCard
                  active={mode === "perPiece"}
                  icon={Hash}
                  title="Unique code per piece"
                  desc="Each piece gets its own serialised code for piece-level tracking."
                  onClick={() => setMode("perPiece")}
                />
              </div>
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-info-subtle px-3 py-2 text-2xs text-info">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {mode === "single"
                  ? "Inventory will be maintained as a single SKU with a running quantity."
                  : "Inventory will be maintained as serialised stock — one row per piece (good for high-value / warranty items)."}
              </div>
            </div>

            {/* Quantity + size */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Number of stickers</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus"
                />
                {target.stock != null && (
                  <button onClick={() => setQty(Math.max(1, target.stock || 1))} className="mt-1 text-2xs text-primary hover:underline">
                    Use current stock ({target.stock})
                  </button>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Sticker size</label>
                <div className="flex gap-1.5">
                  {(Object.keys(SIZES) as SizeKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setSize(k)}
                      className={cn(
                        "flex-1 rounded-md border px-2 py-2 text-2xs font-semibold transition",
                        size === k ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40"
                      )}
                    >
                      {SIZES[k].label}
                      <span className="block text-[9px] font-normal text-subtle">{SIZES[k].w}×{SIZES[k].h}mm</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-2xs text-muted">
              Will produce <strong className="text-foreground">{codes.length}</strong> sticker{codes.length > 1 ? "s" : ""} ·{" "}
              {mode === "perPiece" ? (
                <>codes <span className="font-mono text-foreground">{codes[0]}</span> … <span className="font-mono text-foreground">{codes[codes.length - 1]}</span></>
              ) : (
                <>code <span className="font-mono text-foreground">{base}</span></>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="flex flex-col items-center justify-start gap-2 rounded-xl border border-border bg-surface-2 p-4">
            <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Sticker preview</span>
            <div className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border-strong bg-white p-2.5">
              <QrCode value={codes[0]} size={66} />
              <div className="min-w-0">
                <div className="truncate text-2xs font-bold text-slate-900">{target.name}</div>
                <div className="break-all font-mono text-[9px] text-slate-600">{codes[0]}</div>
                {target.mrp ? <div className="text-2xs font-bold text-slate-900">MRP {fmt.money(target.mrp)}</div> : null}
              </div>
            </div>
            <span className="text-[10px] text-subtle">{mode === "perPiece" ? "Each piece unique" : "Same code on every sticker"}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-2 px-5 py-3">
          <span className="text-2xs text-subtle">Opens a print-ready sheet in a new tab.</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
            <Button size="md" onClick={print}>
              <Printer className="h-4 w-4" /> Print {codes.length} Sticker{codes.length > 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeCard({ active, icon: Icon, title, desc, onClick }: { active: boolean; icon: typeof Hash; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 text-left transition",
        active ? "border-primary bg-primary-subtle/50 ring-1 ring-primary/30" : "border-border bg-surface hover:border-primary/40 hover:bg-surface-2"
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-xs font-bold", active ? "text-primary" : "text-foreground")}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </span>
      <span className="text-2xs leading-relaxed text-muted">{desc}</span>
    </button>
  );
}
