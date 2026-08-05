import type { ReceiptTemplate } from "@/lib/settings/receiptTemplate";

/** Gate token issued right after Pre-Loading Weighment — the vehicle's empty
 * (tare) weight is known, but Load/Net Weight don't exist yet (that only
 * happens after loading + Post-Loading Weighment), so those two always print
 * as blank placeholders here, unlike the (post-loading) Weight Slip. */
export interface TokenSlipData {
  business: { name: string };
  tokenNo: string; productName: string; refNo: string; date: string;
  inTime: string | null;
  customerName: string; vehicleNumber: string | null;
  emptyWeightKg: number;
  payment: string; delivery: string | null;
}

export const TOKEN_SLIP_SAMPLE: TokenSlipData = {
  business: { name: "VASUKI BLUE METAL" },
  tokenNo: "S120260805-09", productName: "BLACK MSAND", refNo: "", date: "05/08/2026",
  inTime: "05/08/2026 9:40AM",
  customerName: "V.RAVISANKAR", vehicleNumber: "TN46L2844",
  emptyWeightKg: 8620,
  payment: "Cash", delivery: "THAILIPATTI",
};

const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
const kg = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Same pure-CSS pseudo-barcode idiom as weightSlipHtml.ts (no barcode library
 * wired into the app) — kept file-local, matching that file's convention. */
function pseudoBarcode(code: string): string {
  const bars = Array.from(code).map((ch, i) => {
    const w = 1 + (ch.charCodeAt(0) % 3);
    return `<div style="display:inline-block;width:${w}px;height:100%;background:${i % 2 === 0 ? "#0f172a" : "transparent"};margin-right:1px"></div>`;
  }).join("");
  return `<div style="height:36px;display:flex;align-items:stretch;justify-content:center;margin:6px 0">${bars}</div>`;
}

const TOKEN_SLIP_STYLE = `
    .token-slip-wrap{font-family:ui-monospace,Consolas,monospace;color:#0f172a;font-size:12px}
    .token-slip{max-width:320px;margin:0 auto;border:1px dashed #94a3b8;padding:10px 14px}
    .token-slip .co{text-align:center;font-weight:800;font-size:14px}
    .token-slip .title{text-align:center;font-size:11px;letter-spacing:.08em;border-top:1px solid #0f172a;border-bottom:1px solid #0f172a;padding:3px 0;margin:6px 0;font-weight:700}
    .token-slip .tok{text-align:center;font-weight:700;margin-top:4px}
    .token-slip .prod{text-align:center;font-weight:700;font-style:italic;letter-spacing:.06em;margin:4px 0}
    .token-slip .row{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0}
    .token-slip .lbl{color:#334155}
    .token-slip .rule{border-top:1px dashed #94a3b8;margin:6px 0}
    .token-slip .notice{text-align:center;font-size:10px;color:#334155;margin-top:8px;line-height:1.5}
    .token-slip .notice b{font-weight:700}
    .token-slip .tokfoot{text-align:center;font-weight:700;margin-top:6px}
`;

/** Just the slip's own CSS + inner markup (no <!doctype>/<html>/<body> wrapper,
 * no auto-print script) — for embedding directly on an in-app page, avoiding
 * the fragility of parsing them back out of buildTokenSlipHtml's full
 * document string. buildTokenSlipHtml (below) is a thin wrapper around this
 * for the rare case a standalone popup document is still wanted. */
export function buildTokenSlipParts(data: TokenSlipData, tpl: Pick<ReceiptTemplate, "title" | "footerNote">): { style: string; bodyHtml: string } {
  const row = (label: string, value: string) => `<div class="row"><span class="lbl">${esc(label)}</span><span>: ${esc(value)}</span></div>`;
  const bodyHtml = `<div class="token-slip-wrap"><div class="token-slip">
    <div class="co">${esc(data.business.name)}</div>
    <div class="title">${esc(tpl.title || "TOKEN")}</div>
    ${pseudoBarcode(data.tokenNo)}
    <div class="tok">${esc(data.tokenNo)}</div>
    <div class="prod">${esc(data.productName)}</div>
    ${row("Token No", data.tokenNo)}
    ${row("RefNo", data.refNo || "—")}
    ${row("Date", data.date)}
    ${data.inTime ? row("In Time", data.inTime) : ""}
    ${row("Customer", data.customerName)}
    ${data.vehicleNumber ? row("Vehicle", data.vehicleNumber) : ""}
    ${row("Empty", `${kg(data.emptyWeightKg)} Kg`)}
    ${row("Payment", data.payment)}
    ${data.delivery ? row("Delivery", data.delivery) : ""}
    ${row("Load", "—")}
    ${row("Net Weight", "—")}
    <div class="rule"></div>
    <div class="notice">
      Please ensure to load the mentioned product in the token.<br/>
      <b>Please maintain below 20KM speed with in crusher limit</b><br/>
      Do not rash drive. For any assistance please contact sales office
    </div>
    ${tpl.footerNote ? `<div class="notice">${esc(tpl.footerNote)}</div>` : ""}
    <div class="tokfoot">${esc(data.tokenNo)}</div>
    </div></div>`;
  return { style: TOKEN_SLIP_STYLE, bodyHtml };
}

/** Gate Token / pre-loading slip — Token No, product, Ref No, date/in-time,
 * customer, vehicle, Empty (tare) weight, payment, delivery, with Load & Net
 * Weight left blank (filled in later on the Weight Slip once the vehicle is
 * loaded and weighed out). Standalone popup-window document — the in-app
 * preview page uses buildTokenSlipParts() directly instead. */
export function buildTokenSlipHtml(data: TokenSlipData, tpl: Pick<ReceiptTemplate, "title" | "footerNote">): string {
  const { style, bodyHtml } = buildTokenSlipParts(data, tpl);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Token ${esc(data.tokenNo)}</title><style>
    @page{margin:8mm}*{box-sizing:border-box}
    ${style}
    </style></head><body>
    ${bodyHtml}
    <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
    </body></html>`;
}
