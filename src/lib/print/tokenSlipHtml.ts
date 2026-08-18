import type { ReceiptTemplate } from "@/lib/settings/receiptTemplate";
import { qrSvgString } from "@/lib/masters/qr";

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
  // Vehicle Gate Entry No (e.g. "VH-GT-ENT-0826-00087") — shown as "Token No"
  // in place of the weighment's own number when available. Optional so
  // TOKEN_SLIP_SAMPLE / older callers without it still render (falls back to
  // tokenNo).
  gateEntryNo?: string;
  // Opaque unguessable link target for the public Start/Complete Loading
  // page (VehicleGateEntry.publicToken) — NOT the gateEntryNo, which is only
  // unique per-tenant and unsafe as a public cross-tenant lookup key.
  publicToken?: string;
}

export const TOKEN_SLIP_SAMPLE: TokenSlipData = {
  business: { name: "VASUKI BLUE METAL" },
  tokenNo: "S120260805-09", productName: "BLACK MSAND", refNo: "", date: "2026-08-05",
  inTime: "05/08/2026 9:40AM",
  customerName: "V.RAVISANKAR", vehicleNumber: "TN46L2844",
  emptyWeightKg: 8620,
  payment: "Cash", delivery: "THAILIPATTI",
  gateEntryNo: "VH-GT-ENT-0826-00087",
  publicToken: "sample-preview-token",
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

/** Real, scannable QR — encodes a digital link (within this app's own
 * domain) to the gate entry, not just the token text. The destination page
 * itself (view details, pick a user, Start Loading / Complete Loading) is a
 * separate, later build — this only needs to point at a stable, identifiable
 * URL today so the printed token keeps working once that page exists. */
function tokenQr(link: string): string {
  const svg = qrSvgString(link, 96, { ec: "M" });
  return `<div style="display:flex;justify-content:center;margin:6px 0">${svg}</div>`;
}

/** The Vehicle Gate Entry's public "Start Loading / Complete Loading" page —
 * keyed by the entry's opaque publicToken (see tokenQr's comment), never the
 * gateEntryNo, which is only unique per-tenant. */
export function tokenLinkFor(originUrl: string, publicToken: string): string {
  return `${originUrl.replace(/\/$/, "")}/transport/gate-entry/loading/${encodeURIComponent(publicToken)}`;
}

const BRAND_FONT_PX: Record<string, number> = { normal: 14, large: 18, xlarge: 22 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-18" or a Date -> "18-Aug-2026" — the slip's own fixed date
 * format, independent of whatever raw format the source field is stored in. */
function fmtSlipDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return String(input);
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** Base slip CSS + the two configurable knobs (brand name size, bold values)
 * baked in as concrete px/weight — kept as a function (not a static
 * constant) since those two vary per saved template. */
function tokenSlipStyle(brandFontSize: string | undefined, boldValues: boolean | undefined): string {
  const coPx = BRAND_FONT_PX[brandFontSize ?? "normal"] ?? BRAND_FONT_PX.normal;
  const valWeight = boldValues ? 700 : 400;
  return `
    .token-slip-wrap{font-family:ui-monospace,Consolas,monospace;color:#0f172a;font-size:12px}
    .token-slip{max-width:320px;margin:0 auto;border:1px dashed #94a3b8;padding:10px 14px}
    .token-slip .co{text-align:center;font-weight:800;font-size:${coPx}px}
    .token-slip .title{text-align:center;font-size:11px;letter-spacing:.08em;border-top:1px solid #0f172a;border-bottom:1px solid #0f172a;padding:3px 0;margin:6px 0;font-weight:700}
    .token-slip .tok{text-align:center;font-weight:700;margin-top:4px}
    .token-slip .prod{text-align:center;font-weight:700;font-style:italic;letter-spacing:.06em;margin:4px 0}
    .token-slip .row{display:flex;gap:2px;padding:1.5px 0}
    .token-slip .lbl{color:#334155;width:72px;flex-shrink:0}
    .token-slip .val{flex:1;font-weight:${valWeight}}
    .token-slip .rule{border-top:1px dashed #94a3b8;margin:6px 0}
    .token-slip .notice{text-align:center;font-size:10px;color:#334155;margin-top:8px;line-height:1.5}
    .token-slip .notice b{font-weight:700}
    .token-slip .tokfoot{text-align:center;font-weight:700;margin-top:6px}
`;
}

/** Just the slip's own CSS + inner markup (no <!doctype>/<html>/<body> wrapper,
 * no auto-print script) — for embedding directly on an in-app page, avoiding
 * the fragility of parsing them back out of buildTokenSlipHtml's full
 * document string. buildTokenSlipHtml (below) is a thin wrapper around this
 * for the rare case a standalone popup document is still wanted. */
export function buildTokenSlipParts(
  data: TokenSlipData,
  tpl: Pick<ReceiptTemplate, "title" | "footerNote" | "tokenCodeType" | "tokenBrandFontSize" | "tokenBoldValues">,
  originUrl = "",
): { style: string; bodyHtml: string } {
  // Fixed-width .lbl (see tokenSlipStyle) is what actually keeps every
  // colon lined up — the label text itself no longer needs the colon baked
  // in since .val supplies it uniformly.
  const row = (label: string, value: string) => `<div class="row"><span class="lbl">${esc(label)}</span><span class="val">: ${esc(value)}</span></div>`;
  const displayTokenNo = data.gateEntryNo || data.tokenNo;
  const codeHtml = tpl.tokenCodeType === "barcode"
    ? pseudoBarcode(displayTokenNo)
    : tokenQr(originUrl && data.publicToken ? tokenLinkFor(originUrl, data.publicToken) : displayTokenNo);
  const bodyHtml = `<div class="token-slip-wrap"><div class="token-slip">
    <div class="co">${esc(data.business.name)}</div>
    <div class="title">${esc(tpl.title || "TOKEN")}</div>
    ${codeHtml}
    <div class="prod">${esc(data.productName)}</div>
    ${row("Token No", displayTokenNo)}
    ${row("RefNo", data.refNo || "—")}
    ${row("Date", fmtSlipDate(data.date))}
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
    <div class="tokfoot">${esc(displayTokenNo)}</div>
    </div></div>`;
  return { style: tokenSlipStyle(tpl.tokenBrandFontSize, tpl.tokenBoldValues), bodyHtml };
}

/** Gate Token / pre-loading slip — Token No, product, Ref No, date/in-time,
 * customer, vehicle, Empty (tare) weight, payment, delivery, with Load & Net
 * Weight left blank (filled in later on the Weight Slip once the vehicle is
 * loaded and weighed out). Standalone popup-window document — the in-app
 * preview page uses buildTokenSlipParts() directly instead. */
export function buildTokenSlipHtml(
  data: TokenSlipData,
  tpl: Pick<ReceiptTemplate, "title" | "footerNote" | "tokenCodeType" | "tokenBrandFontSize" | "tokenBoldValues">,
  originUrl = "",
): string {
  const { style, bodyHtml } = buildTokenSlipParts(data, tpl, originUrl);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Token ${esc(data.gateEntryNo || data.tokenNo)}</title><style>
    @page{margin:8mm}*{box-sizing:border-box}
    ${style}
    </style></head><body>
    ${bodyHtml}
    <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
    </body></html>`;
}
