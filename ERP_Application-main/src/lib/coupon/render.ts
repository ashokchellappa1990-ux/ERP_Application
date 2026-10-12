import type { TemplateLayout, TemplateObject, CouponRenderData } from "@/lib/contracts/coupon";

/** Pure coupon renderer — turns a designer TemplateLayout + coupon data into HTML.
 *  Used by the print flow AND the designer preview. No React / DB dependencies.
 *  (QR/barcode are rendered as deterministic VISUAL placeholders — a real scannable
 *  encoder is a future enhancement; the layout/positioning is fully honoured.) */

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

export function fillPlaceholders(text: string, data: Partial<CouponRenderData>): string {
  return text.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = (data as Record<string, unknown>)[k];
    return v == null ? "" : String(v);
  });
}

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Deterministic pseudo-QR grid (visual). */
export function qrCells(data: string, n = 17): boolean[][] {
  const grid: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  let h = hash(data || "coupon");
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { h = Math.imul(h ^ (x * 31 + y * 17), 2654435761) >>> 0; grid[y][x] = (h & 7) < 3; }
  const finder = (ox: number, oy: number) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { const edge = x === 0 || x === 6 || y === 0 || y === 6; const core = x >= 2 && x <= 4 && y >= 2 && y <= 4; grid[oy + y][ox + x] = edge || core; } };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  return grid;
}
function qrHtml(data: string, size: number): string {
  const n = 17, cells = qrCells(data, n), px = Math.max(1, Math.floor(size / n));
  const rows = cells.map((row) => `<div style="display:flex">${row.map((c) => `<div style="width:${px}px;height:${px}px;background:${c ? "#111" : "#fff"}"></div>`).join("")}</div>`).join("");
  return `<div style="display:inline-block;background:#fff;padding:2px">${rows}</div>`;
}
function barcodeHtml(data: string, w: number, h: number): string {
  const s = data || "00000000"; const bars: string[] = [];
  for (let i = 0; i < s.length; i++) { const code = s.charCodeAt(i); for (let b = 0; b < 4; b++) { const bw = ((code >> b) & 1) ? 3 : 1; const black = (code >> (b + 4)) & 1; bars.push(`<div style="width:${bw}px;height:${h - 12}px;background:${black ? "#111" : "#fff"}"></div>`); } }
  return `<div style="display:flex;align-items:flex-end;gap:1px;height:${h - 12}px">${bars.join("")}</div><div style="font:9px monospace;text-align:center;letter-spacing:1px">${esc(data)}</div>`;
}

export function renderObject(obj: TemplateObject, data: Partial<CouponRenderData>): string {
  const base = `position:absolute;left:${obj.x}px;top:${obj.y}px;width:${obj.w}px;height:${obj.h}px;transform:rotate(${obj.rotation || 0}deg);transform-origin:center;overflow:hidden;`;
  if (obj.type === "text") {
    const style = `${base}font-family:${obj.font || "Arial"};font-size:${obj.size || 14}px;color:${obj.color || "#111"};font-weight:${obj.bold ? "700" : "400"};font-style:${obj.italic ? "italic" : "normal"};text-align:${obj.align || "left"};display:flex;align-items:center;justify-content:${obj.align === "center" ? "center" : obj.align === "right" ? "flex-end" : "flex-start"};${obj.bgColor ? `background:${obj.bgColor};` : ""}padding:0 2px;line-height:1.15`;
    return `<div style="${style}">${esc(fillPlaceholders(obj.text || "", data))}</div>`;
  }
  if (obj.type === "qr") return `<div style="${base}display:flex;align-items:center;justify-content:center">${qrHtml(data.qrData || obj.text || "", Math.min(obj.w, obj.h))}</div>`;
  if (obj.type === "barcode") return `<div style="${base}display:flex;flex-direction:column;align-items:center;justify-content:center">${barcodeHtml(data.barcodeData || obj.text || "", obj.w, obj.h)}</div>`;
  if (obj.type === "image") return obj.src ? `<img src="${obj.src}" style="${base}object-fit:contain" />` : `<div style="${base}border:1px dashed #bbb;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999">Image</div>`;
  if (obj.type === "divider") return `<div style="${base}background:${obj.color || "#ccc"}"></div>`;
  return "";
}

export function renderCoupon(layout: TemplateLayout, data: Partial<CouponRenderData>): string {
  const style = `position:relative;width:${layout.width}px;height:${layout.height}px;background:${layout.bg || "#fff"};${layout.bgImage ? `background-image:url(${layout.bgImage});background-size:cover;` : ""}border:${layout.borderWidth ?? 2}px solid ${layout.border || "#333"};border-radius:${layout.borderRadius ?? 10}px;overflow:hidden`;
  return `<div style="${style}">${(layout.objects || []).map((o) => renderObject(o, data)).join("")}</div>`;
}

export function renderSheet(cards: string[], layout: TemplateLayout, perPage = 4): string {
  const cols = perPage >= 8 ? 4 : perPage >= 4 ? 2 : 1;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Coupons</title><style>@page{margin:12mm}body{margin:0;font-family:Arial}.sheet{display:grid;grid-template-columns:repeat(${cols},max-content);gap:14px;justify-content:center;padding:14px}@media print{button{display:none}}</style></head><body><div class="sheet">${cards.join("")}</div><script>window.onload=function(){window.print()}</script></body></html>`;
}

/** Default coupon layout used when a template is not chosen. */
export function defaultLayout(): TemplateLayout {
  return {
    width: 360, height: 190, bg: "#ffffff", border: "#4338ca", borderWidth: 2, borderRadius: 12,
    objects: [
      { id: "co", type: "text", x: 14, y: 12, w: 220, h: 22, rotation: 0, text: "{CompanyName}", font: "Arial", size: 16, color: "#4338ca", bold: true, align: "left" },
      { id: "cn", type: "text", x: 14, y: 36, w: 220, h: 16, rotation: 0, text: "{CampaignName}", size: 11, color: "#555", align: "left" },
      { id: "ds", type: "text", x: 14, y: 66, w: 220, h: 40, rotation: 0, text: "{Discount}", size: 26, color: "#dc2626", bold: true, align: "left" },
      { id: "no", type: "text", x: 14, y: 120, w: 220, h: 20, rotation: 0, text: "Coupon: {CouponNumber}", size: 13, color: "#111", bold: true, align: "left" },
      { id: "ex", type: "text", x: 14, y: 144, w: 220, h: 14, rotation: 0, text: "Valid till {ExpiryDate}", size: 10, color: "#777", align: "left" },
      { id: "tm", type: "text", x: 14, y: 162, w: 330, h: 22, rotation: 0, text: "{Terms}", size: 8, color: "#999", align: "left" },
      { id: "qr", type: "qr", x: 258, y: 30, w: 84, h: 84, rotation: 0 },
      { id: "bc", type: "barcode", x: 244, y: 122, w: 104, h: 34, rotation: 0 },
    ],
  };
}
