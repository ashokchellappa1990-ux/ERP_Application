import type { ReceiptTemplate } from "@/lib/settings/receiptTemplate";
import { amountInWords } from "./numberToWords";

export interface TaxInvoiceT3Line {
  productName: string; hsn: string | null; qty: number; uom: string;
  pricePerUnit: number; taxablePricePerUnit: number; gstPct: number | null; gstAmount: number; amount: number;
}
export interface TaxInvoiceT3HsnRow {
  hsn: string; taxableAmount: number; cgstPct: number; cgstAmount: number; sgstPct: number; sgstAmount: number; totalTax: number;
}
export interface TaxInvoiceT3Data {
  business: { name: string; address: string; phone: string; email: string; gstin: string; state: string };
  invoiceNo: string; date: string; placeOfSupply: string; deliveryDate: string | null;
  driverName: string | null; vehicleNumber: string | null; driverMobile: string | null; deliveryLocation: string | null;
  customer: { name: string; address: string; contact: string | null; gstin: string | null; state: string };
  lines: TaxInvoiceT3Line[];
  subTotal: number; roundOff: number; total: number; paymentMode: string;
  hsnRows: TaxInvoiceT3HsnRow[]; totalTax: number;
  /** base64 data: URIs from Settings > Invoice Template, or null if not uploaded. */
  qrCodeImage: string | null; signatureImage: string | null;
  termsNote: string;
}

export const TAX_INVOICE_T3_SAMPLE: TaxInvoiceT3Data = {
  business: { name: "Vasuki Blue Metals", address: "Malapatti Village, Ettayapuram Tk, Thoothukudi Dist", phone: "+91 9443233624, 6379315843", email: "vasukibluemetal@gmail.com", gstin: "33ABBPV4637N1Z8", state: "33-Tamil Nadu" },
  invoiceNo: "INV/24-25/1989", date: "09-09-2024", placeOfSupply: "33-Tamil Nadu", deliveryDate: "07/09/2024",
  driverName: "VELMURUGAN", vehicleNumber: "TN20CA3587", driverMobile: null, deliveryLocation: "PUTHUR",
  customer: { name: "T.SHANTHI CONTRACTOR", address: "NA 49/2 MIDDLE STREET\nVALLINAYAGAPURAM ETTAYAPURAM TALUK", contact: "9791463089", gstin: "33CXYPS8300N1ZL", state: "33-Tamil Nadu" },
  lines: [{ productName: "M Sand Black", hsn: "2517", qty: 19.06, uom: "Tons", pricePerUnit: 652.38, taxablePricePerUnit: 652.38, gstPct: 5, gstAmount: 621.72, amount: 13056.08 }],
  subTotal: 13056.08, roundOff: 3.92, total: 13060.0, paymentMode: "Credit",
  hsnRows: [{ hsn: "2517", taxableAmount: 12434.36, cgstPct: 2.5, cgstAmount: 310.86, sgstPct: 2.5, sgstAmount: 310.86, totalTax: 621.72 }],
  totalTax: 621.72,
  qrCodeImage: null, signatureImage: null,
  termsNote: "Thanks for doing business with us!",
};

const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br/>");
const money = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Template 3 — GST-style A4 tax invoice matching a standard e-invoicing-tool
 * layout: company/invoice-meta header with driver/vehicle/delivery fields,
 * Bill To block, a per-line Price/Taxable-Price/GST table, amount-in-words +
 * totals, an HSN-wise CGST/SGST summary table, and a footer with a Bank QR
 * code, terms, and an uploaded signature — none of which the existing B2B_T2
 * design has. Printed from Load & Dispatch and the standalone Sales Invoice
 * (B2B) page. */
export function buildTaxInvoiceT3Html(data: TaxInvoiceT3Data, tpl: Pick<ReceiptTemplate, "title" | "footerNote">): string {
  const rows = data.lines.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(l.productName)}</td>
      <td>${esc(l.hsn || "—")}</td>
      <td class="r">${qty(l.qty)}</td>
      <td>${esc(l.uom)}</td>
      <td class="r">${money(l.pricePerUnit)}</td>
      <td class="r">${money(l.taxablePricePerUnit)}</td>
      <td class="r">${money(l.gstAmount)}${l.gstPct != null ? `<div class="sub">(${l.gstPct}%)</div>` : ""}</td>
      <td class="r">${money(l.amount)}</td>
    </tr>`).join("");
  const totalQty = data.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const totalTaxable = data.lines.reduce((s, l) => s + (Number(l.taxablePricePerUnit) || 0), 0);
  const totalAmount = data.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const hsnRows = data.hsnRows.map((h) => `
    <tr>
      <td>${esc(h.hsn)}</td>
      <td class="r">${money(h.taxableAmount)}</td>
      <td class="r">${h.cgstPct}%</td>
      <td class="r">${money(h.cgstAmount)}</td>
      <td class="r">${h.sgstPct}%</td>
      <td class="r">${money(h.sgstAmount)}</td>
      <td class="r">${money(h.totalTax)}</td>
    </tr>`).join("");
  const hsnTaxable = data.hsnRows.reduce((s, h) => s + h.taxableAmount, 0);
  const hsnCgst = data.hsnRows.reduce((s, h) => s + h.cgstAmount, 0);
  const hsnSgst = data.hsnRows.reduce((s, h) => s + h.sgstAmount, 0);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(tpl.title || "Tax Invoice")} ${esc(data.invoiceNo)}</title><style>
    @page{margin:10mm}*{box-sizing:border-box}body{font-family:ui-sans-serif,system-ui,Arial;margin:0;color:#0f172a;font-size:11.5px}
    .wrap{max-width:800px;margin:0 auto;border:1px solid #94a3b8}
    .hdr{text-align:center;padding:6px 0;position:relative;font-size:16px;font-weight:800;border-bottom:1px solid #94a3b8}
    .orig{position:absolute;right:10px;top:8px;font-size:10px;font-weight:600;color:#475569}
    .top{display:flex;border-bottom:1px solid #94a3b8}
    .top .co{flex:1;padding:8px 10px;border-right:1px solid #94a3b8}
    .top .meta{flex:1}
    .co .name{font-size:15px;font-weight:800}
    .co .line{font-size:10.5px;color:#334155;margin-top:2px}
    table.meta-tbl{width:100%;border-collapse:collapse;height:100%}
    table.meta-tbl td{border:1px solid #94a3b8;padding:4px 8px;font-size:10.5px;vertical-align:top}
    table.meta-tbl .lbl{color:#475569;font-size:9.5px}
    table.meta-tbl .val{font-weight:700}
    .bill{padding:8px 10px;border-bottom:1px solid #94a3b8}
    .bill .lbl{font-size:9.5px;color:#475569}
    .bill .name{font-weight:800;font-size:13px;margin-top:2px}
    .bill .line{font-size:10.5px;color:#334155;margin-top:1px}
    table.items{width:100%;border-collapse:collapse}
    table.items th,table.items td{border:1px solid #94a3b8;padding:5px 7px;font-size:10.5px;text-align:left;vertical-align:top}
    table.items th{background:#f1f5f9;font-size:9.5px;text-transform:none;font-weight:700}
    .r{text-align:right}
    .sub{font-size:9px;color:#64748b}
    .words-row{display:flex;border-bottom:1px solid #94a3b8}
    .words{flex:1;padding:8px 10px;border-right:1px solid #94a3b8;font-size:10.5px}
    .amts{flex:1}
    table.amts-tbl{width:100%;border-collapse:collapse}
    table.amts-tbl td{padding:4px 10px;font-size:11px}
    table.amts-tbl .lbl{color:#334155}
    table.amts-tbl tr.total td{font-weight:800;font-size:12.5px;border-top:1px solid #94a3b8}
    .pay{padding:6px 10px 10px;font-size:10.5px}
    .pay .lbl{color:#475569;font-size:9.5px}
    .pay .val{font-weight:700}
    table.hsn{width:100%;border-collapse:collapse;border-top:1px solid #94a3b8}
    table.hsn th,table.hsn td{border:1px solid #94a3b8;padding:5px 7px;font-size:10.5px}
    table.hsn th{background:#f1f5f9;font-size:9.5px;font-weight:700}
    .foot{display:flex;border-top:1px solid #94a3b8}
    .foot .col{flex:1;padding:10px;border-right:1px solid #94a3b8}
    .foot .col:last-child{border-right:none}
    .foot h3{font-size:10.5px;font-weight:700;margin:0 0 6px}
    .qr img{width:90px;height:90px;object-fit:contain}
    .qr .tag{font-size:9px;font-weight:700;color:#16a34a;margin-top:2px}
    .sign{text-align:center}
    .sign img{max-width:130px;max-height:50px;object-fit:contain;margin:6px 0}
    .sign .box{margin-top:${data.signatureImage ? "0" : "34px"};font-size:10.5px;font-weight:600}
    .footer{text-align:center;font-size:9px;color:#94a3b8;padding:6px 0;border-top:1px solid #e2e8f0}
    </style></head><body><div class="wrap">
    <div class="hdr">TAX INVOICE<span class="orig">ORIGINAL</span></div>
    <div class="top">
      <div class="co">
        <div class="name">${esc(data.business.name)}</div>
        <div class="line">${esc(data.business.address)}</div>
        ${data.business.phone ? `<div class="line">Phone no.: ${esc(data.business.phone)}</div>` : ""}
        ${data.business.email ? `<div class="line">Email: ${esc(data.business.email)}</div>` : ""}
        <div class="line">GSTIN: ${esc(data.business.gstin)}</div>
        <div class="line">State: ${esc(data.business.state)}</div>
      </div>
      <div class="meta">
        <table class="meta-tbl"><tbody>
          <tr><td><div class="lbl">Invoice No.</div><div class="val">${esc(data.invoiceNo)}</div></td><td><div class="lbl">Date</div><div class="val">${esc(data.date)}</div></td></tr>
          <tr><td><div class="lbl">Place of Supply</div><div class="val">${esc(data.placeOfSupply)}</div></td><td><div class="lbl">Delivery Date</div><div class="val">${esc(data.deliveryDate || "—")}</div></td></tr>
          <tr><td><div class="lbl">Driver Name</div><div class="val">${esc(data.driverName || "—")}</div></td><td><div class="lbl">Vehicle Number</div><div class="val">${esc(data.vehicleNumber || "—")}</div></td></tr>
          <tr><td><div class="lbl">Driver Mobile No</div><div class="val">${esc(data.driverMobile || "—")}</div></td><td><div class="lbl">Delivery Location</div><div class="val">${esc(data.deliveryLocation || "—")}</div></td></tr>
        </tbody></table>
      </div>
    </div>
    <div class="bill">
      <div class="lbl">Bill To</div>
      <div class="name">${esc(data.customer.name)}</div>
      <div class="line">${nl2br(data.customer.address)}</div>
      ${data.customer.contact ? `<div class="line">Contact No.: ${esc(data.customer.contact)}</div>` : ""}
      ${data.customer.gstin ? `<div class="line">GSTIN Number: ${esc(data.customer.gstin)}</div>` : ""}
      <div class="line">State: ${esc(data.customer.state)}</div>
    </div>
    <table class="items"><thead><tr>
      <th>#</th><th>Item name</th><th>HSN/SAC</th><th class="r">Quantity</th><th>Unit</th>
      <th class="r">Price/ Unit</th><th class="r">Taxable Price/ Unit</th><th class="r">GST</th><th class="r">Amount</th>
    </tr></thead><tbody>${rows}
      <tr><td colspan="3"><strong>Total</strong></td><td class="r"><strong>${qty(totalQty)}</strong></td><td></td><td></td><td class="r"><strong>${money(totalTaxable)}</strong></td><td></td><td class="r"><strong>${money(totalAmount)}</strong></td></tr>
    </tbody></table>
    <div class="words-row">
      <div class="words"><div class="lbl" style="color:#475569;font-size:9.5px">Invoice Amount In Words</div><strong>${esc(amountInWords(data.total))}</strong></div>
      <div class="amts">
        <table class="amts-tbl"><tbody>
          <tr><td class="lbl">Sub Total</td><td class="r">${money(data.subTotal)}</td></tr>
          <tr><td class="lbl">Round off</td><td class="r">${data.roundOff < 0 ? "-" : ""}${money(Math.abs(data.roundOff))}</td></tr>
          <tr class="total"><td>Total</td><td class="r">${money(data.total)}</td></tr>
        </tbody></table>
      </div>
    </div>
    <div class="pay"><div class="lbl">Payment Mode</div><div class="val">${esc(data.paymentMode)}</div></div>
    <table class="hsn"><thead><tr>
      <th rowspan="2">HSN/ SAC</th><th rowspan="2">Taxable amount</th><th colspan="2">CGST</th><th colspan="2">SGST</th><th rowspan="2">Total Tax Amount</th>
    </tr><tr><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>${hsnRows}
      <tr><td><strong>Total</strong></td><td class="r"><strong>${money(hsnTaxable)}</strong></td><td></td><td class="r"><strong>${money(hsnCgst)}</strong></td><td></td><td class="r"><strong>${money(hsnSgst)}</strong></td><td class="r"><strong>${money(data.totalTax)}</strong></td></tr>
    </tbody></table>
    <div class="foot">
      <div class="col qr">
        <h3>Bank Details</h3>
        ${data.qrCodeImage ? `<img src="${data.qrCodeImage}" alt="Scan to pay" /><div class="tag">SCAN TO PAY</div>` : `<div class="sub">No bank QR uploaded — add one in Settings &gt; Invoice Template.</div>`}
      </div>
      <div class="col">
        <h3>Terms and conditions</h3>
        <div>${esc(data.termsNote || tpl.footerNote || "Thanks for doing business with us!")}</div>
      </div>
      <div class="col sign">
        <h3>For: ${esc(data.business.name)}</h3>
        ${data.signatureImage ? `<img src="${data.signatureImage}" alt="Signature" />` : ""}
        <div class="box">Authorized Signatory</div>
      </div>
    </div>
    <div class="footer">This is a computer generated invoice</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
    </div></body></html>`;
}
