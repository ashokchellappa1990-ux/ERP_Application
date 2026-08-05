import type { ReceiptTemplate } from "@/lib/settings/receiptTemplate";

export interface WeightSlipData {
  business: { name: string };
  tokenNo: string; productName: string; refNo: string; date: string;
  inTime: string | null; outTime: string | null;
  customerName: string; vehicleNumber: string | null;
  emptyWeightKg: number; loadWeightKg: number; netWeightKg: number;
  payment: string; delivery: string | null;
}

export const WEIGHT_SLIP_SAMPLE: WeightSlipData = {
  business: { name: "VASUKI BLUE METAL" },
  tokenNo: "S120260730-14", productName: "BLACK MSAND", refNo: "INV26-27/1362", date: "30/07/2026",
  inTime: "30/07/2026 9:09PM", outTime: "30/07/2026 9:14PM",
  customerName: "M PAVITHRA", vehicleNumber: "TN84H8877",
  emptyWeightKg: 3550, loadWeightKg: 10580, netWeightKg: 7030,
  payment: "Credit", delivery: "KOVILPATTI",
};

const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
const kg = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A pure-CSS pseudo-barcode (repeating bars of varying width keyed off the
 * token number's characters) — good enough for a printed slip; no barcode
 * library is wired into the app, and this avoids adding one for one field. */
function pseudoBarcode(code: string): string {
  const bars = Array.from(code).map((ch, i) => {
    const w = 1 + (ch.charCodeAt(0) % 3);
    return `<div style="display:inline-block;width:${w}px;height:100%;background:${i % 2 === 0 ? "#0f172a" : "transparent"};margin-right:1px"></div>`;
  }).join("");
  return `<div style="height:36px;display:flex;align-items:stretch;justify-content:center;margin:6px 0">${bars}</div>`;
}

const WEIGHT_SLIP_STYLE = `
    .wslip-wrap{font-family:ui-monospace,Consolas,monospace;color:#0f172a;font-size:12px}
    .wslip{max-width:320px;margin:0 auto;border:1px dashed #94a3b8;padding:10px 14px}
    .wslip .co{text-align:center;font-weight:800;font-size:14px}
    .wslip .title{text-align:center;font-size:11px;letter-spacing:.08em;border-top:1px solid #0f172a;border-bottom:1px solid #0f172a;padding:3px 0;margin:6px 0;font-weight:700}
    .wslip .tok{text-align:center;font-weight:700;margin-top:4px}
    .wslip .prod{text-align:center;font-weight:700;margin:4px 0}
    .wslip .row{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0}
    .wslip .lbl{color:#334155}
    .wslip .rule{border-top:1px dashed #94a3b8;margin:6px 0}
    .wslip .footer{text-align:center;font-size:10px;color:#64748b;margin-top:8px}
`;

/** Just the slip's own CSS + inner markup (no <!doctype>/<html>/<body>
 * wrapper, no auto-print script) — for embedding on an in-app preview page.
 * buildWeightSlipHtml (below) wraps this into a standalone popup document. */
export function buildWeightSlipParts(data: WeightSlipData, tpl: Pick<ReceiptTemplate, "title" | "footerNote">): { style: string; bodyHtml: string } {
  const row = (label: string, value: string) => `<div class="row"><span class="lbl">${esc(label)}</span><span>: ${esc(value)}</span></div>`;
  const bodyHtml = `<div class="wslip-wrap"><div class="wslip">
    <div class="co">${esc(data.business.name)}</div>
    <div class="title">${esc(tpl.title || "WEIGHMENT SLIP")}</div>
    ${pseudoBarcode(data.tokenNo)}
    <div class="tok">Token No : ${esc(data.tokenNo)}</div>
    <div class="prod">${esc(data.productName)}</div>
    <div class="rule"></div>
    ${row("RefNo", data.refNo)}
    ${row("Date", data.date)}
    ${data.inTime ? row("In Time", data.inTime) : ""}
    ${data.outTime ? row("Out Time", data.outTime) : ""}
    ${row("Customer", data.customerName)}
    ${data.vehicleNumber ? row("Vehicle", data.vehicleNumber) : ""}
    <div class="rule"></div>
    ${row("Empty", `${kg(data.emptyWeightKg)} Kg`)}
    ${row("Load", `${kg(data.loadWeightKg)} Kg`)}
    ${row("Net Weight", `${kg(data.netWeightKg)} Kg`)}
    <div class="rule"></div>
    ${row("Payment", data.payment)}
    ${data.delivery ? row("Delivery", data.delivery) : ""}
    <div class="footer">${esc(tpl.footerNote || "Thank you for your business.")}</div>
    </div></div>`;
  return { style: WEIGHT_SLIP_STYLE, bodyHtml };
}

/** Small-format weighbridge slip — Token No / Ref No / vehicle / empty-load-net
 * weight / payment / delivery. Standalone popup-window document — the in-app
 * preview page uses buildWeightSlipParts() directly instead. */
export function buildWeightSlipHtml(data: WeightSlipData, tpl: Pick<ReceiptTemplate, "title" | "footerNote">): string {
  const { style, bodyHtml } = buildWeightSlipParts(data, tpl);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Weighment Slip ${esc(data.tokenNo)}</title><style>
    @page{margin:8mm}*{box-sizing:border-box}
    ${style}
    </style></head><body>
    ${bodyHtml}
    <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
    </body></html>`;
}
