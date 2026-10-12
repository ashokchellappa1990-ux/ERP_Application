"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Palette, Type, QrCode, Barcode as BarcodeIcon, Image as ImageIcon, Minus, Undo2, Redo2, ZoomIn, ZoomOut, Eye, Save, Plus, Trash2, Copy, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { PLACEHOLDERS, TEMPLATE_CATEGORIES, type CouponTemplateRow, type TemplateLayout, type TemplateObject, type CouponRenderData } from "@/lib/contracts/coupon";
import { renderCoupon, defaultLayout, qrCells } from "@/lib/coupon/render";

const API = "/api/coupon";
const SAMPLE: CouponRenderData = { CompanyName: "One ERP Retail", BranchName: "Main Store", CampaignName: "Diwali Dhamaka", CouponNumber: "CPN0000123", CouponCode: "AB7X9K2Q", Discount: "10% OFF", CustomerName: "Ashok Kumar", IssueDate: "2026-07-01", ExpiryDate: "2026-12-31", Terms: "Terms & conditions apply. One coupon per bill.", GeneratedDate: "2026-07-01", qrData: "CPN0000123", barcodeData: "CPN0000123", securityCode: "7F3K9A" };
const uid = () => `o${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export function CouponDesigner() {
  const toast = useToast();
  const [templates, setTemplates] = useState<CouponTemplateRow[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [name, setName] = useState("Untitled");
  const [category, setCategory] = useState("Generic");
  const [layout, setLayout] = useState<TemplateLayout>(defaultLayout);
  const [selId, setSelId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.4);
  const [busy, setBusy] = useState(false);
  const hist = useRef<TemplateLayout[]>([defaultLayout()]);
  const hi = useRef(0);

  const loadTemplates = useCallback(async () => { const j = await fetch(`${API}/templates`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setTemplates(j.rows); }, []);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const reset = (l: TemplateLayout) => { hist.current = [structuredClone(l)]; hi.current = 0; setLayout(l); };
  const push = (l: TemplateLayout) => { hist.current = hist.current.slice(0, hi.current + 1); hist.current.push(structuredClone(l)); hi.current++; setLayout(l); };
  const undo = () => { if (hi.current > 0) { hi.current--; setLayout(structuredClone(hist.current[hi.current])); } };
  const redo = () => { if (hi.current < hist.current.length - 1) { hi.current++; setLayout(structuredClone(hist.current[hi.current])); } };

  function loadTemplate(t: CouponTemplateRow) { setTemplateId(t.id); setName(t.name); setCategory(t.category); reset(structuredClone(t.layout)); setSelId(null); }
  function newTemplate() { setTemplateId(null); setName("Untitled"); setCategory("Generic"); reset(defaultLayout()); setSelId(null); }

  const sel = layout.objects.find((o) => o.id === selId) ?? null;
  const patchLayout = (p: Partial<TemplateLayout>) => push({ ...layout, ...p });
  const patchObj = (id: string, p: Partial<TemplateObject>, commit = true) => { const l = { ...layout, objects: layout.objects.map((o) => (o.id === id ? { ...o, ...p } : o)) }; commit ? push(l) : setLayout(l); };
  function addObject(type: TemplateObject["type"]) {
    const base: TemplateObject = { id: uid(), type, x: 20, y: 20, w: type === "qr" ? 80 : type === "barcode" ? 110 : type === "divider" ? 200 : 140, h: type === "qr" ? 80 : type === "barcode" ? 34 : type === "divider" ? 2 : 20, rotation: 0, font: "Arial", size: 14, color: "#111827", align: "left" };
    if (type === "text") base.text = "New text";
    if (type === "divider") base.color = "#cccccc";
    push({ ...layout, objects: [...layout.objects, base] }); setSelId(base.id);
  }
  function insertPlaceholder(ph: string) {
    if (sel && sel.type === "text") patchObj(sel.id, { text: (sel.text || "") + " " + ph });
    else { const o: TemplateObject = { id: uid(), type: "text", x: 20, y: 20, w: 160, h: 20, rotation: 0, text: ph, font: "Arial", size: 14, color: "#111827", align: "left" }; push({ ...layout, objects: [...layout.objects, o] }); setSelId(o.id); }
  }
  function removeSel() { if (!sel) return; push({ ...layout, objects: layout.objects.filter((o) => o.id !== sel.id) }); setSelId(null); }
  function dupSel() { if (!sel) return; const c = { ...structuredClone(sel), id: uid(), x: sel.x + 12, y: sel.y + 12 }; push({ ...layout, objects: [...layout.objects, c] }); setSelId(c.id); }

  // drag / resize
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const onDown = (e: React.MouseEvent, o: TemplateObject, mode: "move" | "resize") => {
    e.stopPropagation(); setSelId(o.id);
    drag.current = { id: o.id, mode, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, ow: o.w, oh: o.h };
    const move = (ev: MouseEvent) => {
      const d = drag.current; if (!d) return; const dx = (ev.clientX - d.sx) / zoom, dy = (ev.clientY - d.sy) / zoom;
      if (d.mode === "move") patchObj(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) }, false);
      else patchObj(d.id, { w: Math.max(6, Math.round(d.ow + dx)), h: Math.max(2, Math.round(d.oh + dy)) }, false);
    };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); if (drag.current) { push(layoutRef.current); drag.current = null; } };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  };
  const layoutRef = useRef(layout); useEffect(() => { layoutRef.current = layout; }, [layout]);

  function preview() {
    const w = window.open("", "_blank", "width=520,height=360"); if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Preview</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#f1f5f9">${renderCoupon(layout, SAMPLE)}</body></html>`);
    w.document.close();
  }
  async function save(asNew = false) {
    if (!name.trim()) { toast.error("Enter a template name."); return; }
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveTemplate", ...(templateId && !asNew ? { id: templateId } : {}), name: asNew ? `${name} copy` : name, category, layout: JSON.stringify(layout) }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false); if (toast.result(j, "Template saved.")) { if (j.id) setTemplateId(j.id); loadTemplates(); }
  }
  async function del(t: CouponTemplateRow) { if (!window.confirm(`Delete template "${t.name}"?`)) return; const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deleteTemplate", id: t.id }) }).then((r) => r.json()); if (toast.result(j, "Deleted.")) { if (templateId === t.id) newTemplate(); loadTemplates(); } }

  async function onLogo(files: FileList | null) { if (!files?.[0]) return; const f = files[0]; const url: string = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); }); const o: TemplateObject = { id: uid(), type: "image", x: 16, y: 12, w: 60, h: 60, rotation: 0, src: url }; push({ ...layout, objects: [...layout.objects, o] }); setSelId(o.id); }
  async function onBg(files: FileList | null) { if (!files?.[0]) return; const f = files[0]; const url: string = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); }); patchLayout({ bgImage: url }); }

  const inp = "h-8 w-full rounded border border-border bg-surface-2 px-2 text-xs focus:border-primary focus:outline-none";

  return (
    <div className="grid gap-3 lg:grid-cols-[220px_1fr_240px]">
      {/* Templates */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-1.5 text-xs font-bold text-foreground"><LayoutTemplate className="h-4 w-4 text-primary" /> Templates</p><Button size="sm" variant="outline" onClick={newTemplate}><Plus className="h-3.5 w-3.5" /></Button></div>
      <div className="max-h-[520px] space-y-2 overflow-y-auto">
        {TEMPLATE_CATEGORIES.map((cat) => { const list = templates.filter((t) => t.category === cat); if (!list.length) return null; return (
          <div key={cat}><p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-subtle">{cat}</p>
            {list.map((t) => <div key={t.id} className={cn("group mb-1 flex items-center justify-between rounded-md border px-2 py-1 text-xs", templateId === t.id ? "border-primary bg-primary-subtle" : "border-border hover:border-primary/40")}><button onClick={() => loadTemplate(t)} className="flex-1 truncate text-left text-foreground">{t.name}</button>{!t.isSystem && <button onClick={() => del(t)} className="text-danger opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>}</div>)}
          </div>
        ); })}
      </div>
      </div>

      {/* Canvas + toolbar */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-2 shadow-sm">
          <input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-40 rounded border border-border bg-surface-2 px-2 text-sm font-semibold focus:border-primary focus:outline-none" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 rounded border border-border bg-surface-2 px-2 text-xs">{TEMPLATE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <span className="mx-1 h-5 w-px bg-border" />
          <Tool icon={Type} label="Text" onClick={() => addObject("text")} />
          <Tool icon={QrCode} label="QR" onClick={() => addObject("qr")} />
          <Tool icon={BarcodeIcon} label="Barcode" onClick={() => addObject("barcode")} />
          <label className="inline-flex cursor-pointer items-center"><Tool icon={ImageIcon} label="Logo" onClick={() => {}} /><input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files)} /></label>
          <Tool icon={Minus} label="Divider" onClick={() => addObject("divider")} />
          <span className="mx-1 h-5 w-px bg-border" />
          <Tool icon={Undo2} label="Undo" onClick={undo} />
          <Tool icon={Redo2} label="Redo" onClick={redo} />
          <Tool icon={ZoomOut} label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} />
          <span className="text-2xs text-muted">{Math.round(zoom * 100)}%</span>
          <Tool icon={ZoomIn} label="Zoom in" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))} />
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="outline" onClick={preview}><Eye className="h-3.5 w-3.5" /> Preview</Button>
          <Button size="sm" disabled={busy} onClick={() => save(false)}><Save className="h-3.5 w-3.5" /> Save</Button>
          {templateId && <Button size="sm" variant="outline" disabled={busy} onClick={() => save(true)}><Copy className="h-3.5 w-3.5" /> Save As</Button>}
        </div>
        <div className="flex min-h-[420px] items-start justify-center overflow-auto rounded-xl border border-border bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:20px_20px] p-8" onMouseDown={() => setSelId(null)}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
            <div style={{ position: "relative", width: layout.width, height: layout.height, background: layout.bg, backgroundImage: layout.bgImage ? `url(${layout.bgImage})` : undefined, backgroundSize: "cover", border: `${layout.borderWidth}px solid ${layout.border}`, borderRadius: layout.borderRadius, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
              {layout.objects.map((o) => (
                <div key={o.id} onMouseDown={(e) => onDown(e, o, "move")} style={{ position: "absolute", left: o.x, top: o.y, width: o.w, height: o.h, transform: `rotate(${o.rotation || 0}deg)`, transformOrigin: "center", cursor: "move", outline: selId === o.id ? "1.5px solid #6366f1" : "none", boxSizing: "border-box" }}>
                  <ObjView o={o} />
                  {selId === o.id && <span onMouseDown={(e) => onDown(e, o, "resize")} style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, background: "#6366f1", borderRadius: 2, cursor: "nwse-resize" }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">{PLACEHOLDERS.map((p) => <button key={p} onClick={() => insertPlaceholder(p)} className="rounded-full border border-border bg-surface px-2 py-0.5 text-2xs font-medium text-muted hover:border-primary/40 hover:text-primary">{p}</button>)}</div>
      </div>

      {/* Properties */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        {!sel ? (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground"><Palette className="h-4 w-4 text-primary" /> Coupon</p>
            <div className="grid grid-cols-2 gap-2">
              <L label="Width"><input type="number" value={layout.width} onChange={(e) => patchLayout({ width: Number(e.target.value) || 360 })} className={inp} /></L>
              <L label="Height"><input type="number" value={layout.height} onChange={(e) => patchLayout({ height: Number(e.target.value) || 190 })} className={inp} /></L>
              <L label="Background"><input type="color" value={layout.bg} onChange={(e) => patchLayout({ bg: e.target.value })} className="h-8 w-full rounded border border-border" /></L>
              <L label="Border Color"><input type="color" value={layout.border} onChange={(e) => patchLayout({ border: e.target.value })} className="h-8 w-full rounded border border-border" /></L>
              <L label="Border Width"><input type="number" value={layout.borderWidth} onChange={(e) => patchLayout({ borderWidth: Number(e.target.value) || 0 })} className={inp} /></L>
              <L label="Radius"><input type="number" value={layout.borderRadius} onChange={(e) => patchLayout({ borderRadius: Number(e.target.value) || 0 })} className={inp} /></L>
            </div>
            <div className="mt-2 flex gap-2"><label className="flex-1 cursor-pointer rounded border border-dashed border-border-strong bg-surface-2 px-2 py-1.5 text-center text-2xs text-muted hover:text-primary">Background image<input type="file" accept="image/*" className="hidden" onChange={(e) => onBg(e.target.files)} /></label>{layout.bgImage && <button onClick={() => patchLayout({ bgImage: "" })} className="rounded border border-border px-2 text-2xs text-danger">Clear</button>}</div>
            <p className="mt-3 text-2xs text-muted">Click an object on the canvas to edit it. Use the placeholder chips to insert dynamic fields.</p>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold text-foreground">{sel.type.toUpperCase()}</p><div className="flex gap-1"><button onClick={dupSel} title="Duplicate" className="grid h-6 w-6 place-items-center rounded border border-border text-muted hover:text-primary"><Copy className="h-3 w-3" /></button><button onClick={removeSel} title="Delete" className="grid h-6 w-6 place-items-center rounded border border-border text-muted hover:text-danger"><Trash2 className="h-3 w-3" /></button></div></div>
            {sel.type === "text" && <>
              <L label="Text / Placeholder"><textarea value={sel.text || ""} onChange={(e) => patchObj(sel.id, { text: e.target.value })} rows={2} className={cn(inp, "h-auto py-1")} /></L>
              <div className="grid grid-cols-2 gap-2">
                <L label="Font"><select value={sel.font} onChange={(e) => patchObj(sel.id, { font: e.target.value })} className={inp}>{["Arial", "Helvetica", "Georgia", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS"].map((f) => <option key={f}>{f}</option>)}</select></L>
                <L label="Size"><input type="number" value={sel.size} onChange={(e) => patchObj(sel.id, { size: Number(e.target.value) || 14 })} className={inp} /></L>
                <L label="Color"><input type="color" value={sel.color || "#111827"} onChange={(e) => patchObj(sel.id, { color: e.target.value })} className="h-8 w-full rounded border border-border" /></L>
                <L label="Align"><select value={sel.align} onChange={(e) => patchObj(sel.id, { align: e.target.value as TemplateObject["align"] })} className={inp}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></L>
              </div>
              <div className="mt-1 flex gap-3 text-xs"><label className="flex items-center gap-1"><input type="checkbox" checked={!!sel.bold} onChange={(e) => patchObj(sel.id, { bold: e.target.checked })} /> Bold</label><label className="flex items-center gap-1"><input type="checkbox" checked={!!sel.italic} onChange={(e) => patchObj(sel.id, { italic: e.target.checked })} /> Italic</label></div>
            </>}
            {sel.type === "divider" && <L label="Color"><input type="color" value={sel.color || "#cccccc"} onChange={(e) => patchObj(sel.id, { color: e.target.value })} className="h-8 w-full rounded border border-border" /></L>}
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <L label="X"><input type="number" value={sel.x} onChange={(e) => patchObj(sel.id, { x: Number(e.target.value) || 0 })} className={inp} /></L>
              <L label="Y"><input type="number" value={sel.y} onChange={(e) => patchObj(sel.id, { y: Number(e.target.value) || 0 })} className={inp} /></L>
              <L label="W"><input type="number" value={sel.w} onChange={(e) => patchObj(sel.id, { w: Number(e.target.value) || 10 })} className={inp} /></L>
              <L label="H"><input type="number" value={sel.h} onChange={(e) => patchObj(sel.id, { h: Number(e.target.value) || 4 })} className={inp} /></L>
            </div>
            <L label={`Rotation ${sel.rotation || 0}°`}><input type="range" min={0} max={360} value={sel.rotation || 0} onChange={(e) => patchObj(sel.id, { rotation: Number(e.target.value) }, false)} onMouseUp={() => push(layout)} className="w-full" /></L>
          </div>
        )}
      </div>
    </div>
  );
}

function Tool({ icon: Icon, label, onClick }: { icon: typeof Type; label: string; onClick: () => void }) {
  return <button title={label} onClick={onClick} className="grid h-8 w-8 place-items-center rounded border border-border text-muted transition hover:border-primary/40 hover:text-primary"><Icon className="h-4 w-4" /></button>;
}
function L({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-0.5 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }

function ObjView({ o }: { o: TemplateObject }) {
  if (o.type === "text") return <div style={{ width: "100%", height: "100%", fontFamily: o.font, fontSize: o.size, color: o.color, fontWeight: o.bold ? 700 : 400, fontStyle: o.italic ? "italic" : "normal", textAlign: o.align, background: o.bgColor, display: "flex", alignItems: "center", justifyContent: o.align === "center" ? "center" : o.align === "right" ? "flex-end" : "flex-start", overflow: "hidden", lineHeight: 1.15, padding: "0 2px", pointerEvents: "none" }}>{o.text}</div>;
  if (o.type === "qr") { const n = 11, g = qrCells(o.text || "sample", n); return <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateColumns: `repeat(${n},1fr)`, background: "#fff", pointerEvents: "none" }}>{g.flat().map((c, i) => <div key={i} style={{ background: c ? "#111" : "#fff" }} />)}</div>; }
  if (o.type === "barcode") return <div style={{ width: "100%", height: "100%", background: "repeating-linear-gradient(90deg,#111 0 2px,#fff 2px 4px)", pointerEvents: "none" }} />;
  if (o.type === "image") return o.src ? <img src={o.src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} /> : <div style={{ width: "100%", height: "100%", border: "1px dashed #bbb", fontSize: 9, color: "#999", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>Image</div>;
  if (o.type === "divider") return <div style={{ width: "100%", height: "100%", background: o.color, pointerEvents: "none" }} />;
  return null;
}
