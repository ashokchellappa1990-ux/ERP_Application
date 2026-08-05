import type { ReceiptTemplate } from "@/lib/settings/receiptTemplate";
import { amountInWords } from "./numberToWords";

export interface TaxInvoiceLine {
  description: string; hsn: string | null;
  rate: number; qty: number; uom: string;
  lineTotal: number;
  weight?: { empty: number; load: number; net: number; unit: string } | null;
}
export interface TaxInvoiceData {
  business: { name: string; address: string; gstin: string; phone?: string };
  invoiceNo: string; billDateTime: string; billType: string;
  vehicleNumber: string | null; deliveryTo: string | null; driverName: string | null;
  customer: { name: string; gstin: string; place: string };
  lines: TaxInvoiceLine[];
  totalTax: number; sgstPct: number | null; sgstAmount: number; cgstPct: number | null; cgstAmount: number;
  royaltyPassLabel: string; royaltyPass: number;
  roundOff: number; total: number;
}

export const TAX_INVOICE_SAMPLE: TaxInvoiceData = {
  business: { name: "VASUKI BLUE METAL", address: "2797/B2, Nellai Main Road, Indira Nagar, Kovilpatti, Thoothukudi, Tamil Nadu, 628501", gstin: "33ABBPV4637N1Z8" },
  invoiceNo: "INV26-27/1362", billDateTime: "30-07-2026 21:14:00", billType: "Credit",
  vehicleNumber: "TN84H8877", deliveryTo: "KOVILPATTI", driverName: null,
  customer: { name: "M PAVITHRA", gstin: "0", place: "KOVILPATTI" },
  lines: [{ description: "BLACK MSAND", hsn: "2517", rate: 714.29, qty: 7.03, uom: "Ton", lineTotal: 5021.46, weight: { empty: 3.55, load: 10.58, net: 7.03, unit: "Ton" } }],
  totalTax: 251.08, sgstPct: 2.5, sgstAmount: 125.54, cgstPct: 2.5, cgstAmount: 125.54,
  royaltyPassLabel: "Royalty Pass", royaltyPass: 650,
  roundOff: -0.54, total: 5920.0,
};

const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
const money = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TAX_INVOICE_STYLE = `
    .tinv-wrap{font-family:ui-sans-serif,system-ui,Arial;color:#0f172a;font-size:12.5px}
    .tinv{max-width:760px;margin:0 auto}
    .tinv .hdr{text-align:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:8px;position:relative}
    .tinv .hdr .dt{position:absolute;right:0;top:0;font-size:10px;color:#475569}
    .tinv .co{font-size:18px;font-weight:800;letter-spacing:.02em}
    .tinv .addr{font-size:11px;color:#334155;margin-top:2px}
    .tinv .gstin{font-size:11px;margin-top:2px;font-weight:600}
    .tinv .title{margin-top:8px;font-size:14px;font-weight:800;text-decoration:underline}
    .tinv .meta{display:flex;justify-content:space-between;gap:16px;margin:10px 0;font-size:11.5px}
    .tinv .meta .col{flex:1}
    .tinv .meta .lbl{color:#475569}
    .tinv .meta .name{font-weight:800;font-size:13px}
    .tinv table{width:100%;border-collapse:collapse;margin-top:4px}
    .tinv th,.tinv td{border:1px solid #cbd5e1;padding:6px 8px;font-size:11.5px;text-align:left;vertical-align:top}
    .tinv th{background:#f1f5f9;text-transform:uppercase;font-size:9.5px;letter-spacing:.04em}
    .tinv .r{text-align:right}
    .tinv .sub{font-size:10px;color:#64748b}
    .tinv .wt{font-size:10px;color:#64748b;margin-top:2px}
    .tinv .totals{margin-top:0}
    .tinv .totals table{margin-top:0}
    .tinv .totals td{border:none;padding:3px 8px}
    .tinv .totals .lbl{color:#334155}
    .tinv .grand{font-size:16px;font-weight:800}
    .tinv .words{display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px;border-top:1px dashed #94a3b8;padding-top:8px}
    .tinv .words .txt{font-size:11px;max-width:70%}
    .tinv .sign{display:flex;justify-content:space-between;margin-top:34px;font-size:11px}
    .tinv .sign .box{text-align:center}
    .tinv .decl{font-size:10px;color:#475569;margin-top:14px;max-width:65%}
    .tinv .footer{text-align:center;font-size:9.5px;color:#94a3b8;border-top:1px solid #e2e8f0;margin-top:14px;padding-top:6px}
`;

/** Just this design's own CSS + inner markup (no <!doctype>/<html>/<body>
 * wrapper, no auto-print script) — for embedding on an in-app preview page.
 * buildTaxInvoiceHtml (below) wraps this into a standalone popup document. */
export function buildTaxInvoiceParts(data: TaxInvoiceData, tpl: Pick<ReceiptTemplate, "title" | "footerNote">): { style: string; bodyHtml: string } {
  const rows = data.lines.map((l) => `
    <tr>
      <td>${esc(l.description)}${l.hsn ? ` <span class="sub">HSN : ${esc(l.hsn)}</span>` : ""}
        ${l.weight ? `<div class="wt">Empty Weight ${qty(l.weight.empty)} &nbsp; Load Weight ${qty(l.weight.load)} &nbsp; Net Weight ${qty(l.weight.net)} ${esc(l.weight.unit)}</div>` : ""}
      </td>
      <td class="r">${money(l.rate)}</td>
      <td class="r">${qty(l.qty)}</td>
      <td>${esc(l.uom)}</td>
      <td class="r">${money(l.lineTotal)}</td>
    </tr>`).join("");

  const bodyHtml = `<div class="tinv-wrap"><div class="tinv">
    <div class="hdr">
      <div class="dt">${esc(data.billDateTime)}</div>
      <div class="co">${esc(data.business.name)}</div>
      <div class="addr">${esc(data.business.address)}</div>
      <div class="gstin">GSTIN No : ${esc(data.business.gstin)}</div>
      <div class="title">${esc(tpl.title || "Tax Invoice")}</div>
    </div>
    <div class="meta">
      <div class="col">
        <div class="lbl">Bill To :</div>
        <div class="name">${esc(data.customer.name)}</div>
        <div>GSTIN : ${esc(data.customer.gstin || "0")}</div>
        <div>${esc(data.customer.place)}</div>
      </div>
      <div class="col r">
        <div><span class="lbl">Bill No</span> : ${esc(data.invoiceNo)}</div>
        <div><span class="lbl">Bill Date</span> : ${esc(data.billDateTime)}</div>
        <div><span class="lbl">Bill Type</span> : ${esc(data.billType)}</div>
        ${data.vehicleNumber ? `<div><span class="lbl">Vehicle Number</span> : ${esc(data.vehicleNumber)}</div>` : ""}
        ${data.deliveryTo ? `<div><span class="lbl">Delivery To</span> : ${esc(data.deliveryTo)}</div>` : ""}
        <div><span class="lbl">Driver</span> : ${esc(data.driverName || "")}</div>
      </div>
    </div>
    <table><thead><tr><th>Description</th><th class="r">Rate</th><th class="r">Qty</th><th>Per</th><th class="r">Line Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <table class="totals"><tbody>
      <tr><td class="lbl">Tax</td><td class="r">${money(data.totalTax)}</td></tr>
      <tr><td class="lbl">${data.sgstPct != null ? `SGST ${data.sgstPct}% : ${money(data.sgstAmount)}` : ""} ${data.cgstPct != null ? `&nbsp;&nbsp; CGST ${data.cgstPct}% : ${money(data.cgstAmount)}` : ""}</td><td></td></tr>
      ${data.royaltyPass ? `<tr><td class="lbl">${esc(data.royaltyPassLabel)}</td><td class="r">${money(data.royaltyPass)}</td></tr>` : ""}
      <tr><td class="lbl">Round off</td><td class="r">${data.roundOff < 0 ? "-" : ""}${money(Math.abs(data.roundOff))}</td></tr>
    </tbody></table>
    <div class="words">
      <div class="txt"><strong>Amount Chargeable (in words) :</strong><br/>${esc(amountInWords(data.total))}</div>
      <div class="grand">Total &nbsp; ${money(data.total)}</div>
    </div>
    <div class="decl">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
    <div class="sign"><div></div><div class="box">Authorized Signatory<br/><br/>For ${esc(data.business.name)}</div></div>
    <div class="footer">${tpl.footerNote ? `${esc(tpl.footerNote)} — ` : ""}This is a computer generated invoice</div>
    </div></div>`;
  return { style: TAX_INVOICE_STYLE, bodyHtml };
}

/** Template 2 — "Tax Invoice" A4 design (Bill To/Bill No/Vehicle/Driver header
 * block, weighbridge-style item line with Empty/Load/Net weight, GST + Royalty
 * Pass + Round Off, amount-in-words). Standalone popup-window document — the
 * in-app preview page uses buildTaxInvoiceParts() directly instead. */
export function buildTaxInvoiceHtml(data: TaxInvoiceData, tpl: Pick<ReceiptTemplate, "title" | "footerNote">): string {
  const { style, bodyHtml } = buildTaxInvoiceParts(data, tpl);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(tpl.title || "Tax Invoice")} ${esc(data.invoiceNo)}</title><style>
    @page{margin:10mm}*{box-sizing:border-box}
    ${style}
    </style></head><body>
    ${bodyHtml}
    <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
    </body></html>`;
}
