/** Build a printable Stock Transfer Delivery Challan (internal, non-tax document). */
interface ChallanHeader { dispatchNo: string; dispatchDate: string; referenceNo: string | null; challanNo: string | null; sourceName: string; sourceWarehouse: string | null; destinationName: string; destinationWarehouse: string | null; vehicleNo: string | null; driverName: string | null; transportName: string | null; lrNumber: string | null; totalDispatchQty: number; totalItems: number }
interface ChallanItem { productName: string; sku: string | null; batchNo: string | null; expiryDate: string | null; serials: string[]; uom: string | null; dispatchQty: number }

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function buildChallanHtml(h: ChallanHeader, items: ChallanItem[], challanNo?: string | null): string {
  const dc = challanNo ?? h.challanNo ?? h.dispatchNo;
  const rows = items.map((it, i) => `<tr>
    <td class="c">${i + 1}</td>
    <td>${esc(it.productName)}${it.sku ? `<div class="sub">${esc(it.sku)}</div>` : ""}</td>
    <td>${it.serials.length ? esc(it.serials.join(", ")) : it.batchNo ? esc(it.batchNo) + (it.expiryDate ? ` · exp ${esc(it.expiryDate)}` : "") : "—"}</td>
    <td class="c">${esc(it.uom || "")}</td>
    <td class="r">${esc(it.dispatchQty)}</td>
  </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Delivery Challan ${esc(dc)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:24px;font-size:12px}
    h1{font-size:18px;margin:0 0 2px} .muted{color:#666} .title{text-align:center;margin-bottom:14px}
    .title h1{letter-spacing:.5px} .badge{display:inline-block;border:1px solid #999;border-radius:4px;padding:1px 8px;font-size:11px;margin-top:4px}
    .grid{display:flex;gap:16px;border:1px solid #ccc;border-radius:6px;padding:12px;margin-bottom:12px}
    .grid > div{flex:1} .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;font-weight:bold}
    .val{font-weight:bold;margin-top:2px} .meta{display:flex;flex-wrap:wrap;gap:6px 22px;margin-bottom:12px;font-size:11px}
    table{width:100%;border-collapse:collapse;margin-top:6px} th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f3f3f3;font-size:10px;text-transform:uppercase;letter-spacing:.4px} .r{text-align:right} .c{text-align:center}
    .sub{font-size:10px;color:#888} .foot{display:flex;justify-content:space-between;margin-top:40px}
    .sign{width:30%;border-top:1px solid #999;padding-top:4px;text-align:center;font-size:11px;color:#555}
    .note{margin-top:16px;font-size:10px;color:#888}
  </style></head><body>
    <div class="title"><h1>DELIVERY CHALLAN</h1><div class="muted">Internal Stock Transfer — Not a Tax Invoice</div><div class="badge">${esc(dc)}</div></div>
    <div class="grid">
      <div><div class="lbl">Dispatch From</div><div class="val">${esc(h.sourceName)}</div>${h.sourceWarehouse ? `<div class="muted">${esc(h.sourceWarehouse)}</div>` : ""}</div>
      <div><div class="lbl">Deliver To</div><div class="val">${esc(h.destinationName)}</div>${h.destinationWarehouse ? `<div class="muted">${esc(h.destinationWarehouse)}</div>` : ""}</div>
    </div>
    <div class="meta">
      <span><b>Challan No:</b> ${esc(dc)}</span>
      <span><b>Dispatch No:</b> ${esc(h.dispatchNo)}</span>
      <span><b>Date:</b> ${esc(h.dispatchDate)}</span>
      ${h.referenceNo ? `<span><b>Reference:</b> ${esc(h.referenceNo)}</span>` : ""}
      ${h.vehicleNo ? `<span><b>Vehicle:</b> ${esc(h.vehicleNo)}</span>` : ""}
      ${h.driverName ? `<span><b>Driver:</b> ${esc(h.driverName)}</span>` : ""}
      ${h.transportName ? `<span><b>Transport:</b> ${esc(h.transportName)}</span>` : ""}
      ${h.lrNumber ? `<span><b>LR No:</b> ${esc(h.lrNumber)}</span>` : ""}
    </div>
    <table><thead><tr><th class="c">#</th><th>Product</th><th>Batch / Serial</th><th class="c">UoM</th><th class="r">Qty</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4" class="r"><b>Total (${esc(h.totalItems)} items)</b></td><td class="r"><b>${esc(h.totalDispatchQty)}</b></td></tr></tfoot></table>
    <div class="foot"><div class="sign">Prepared By</div><div class="sign">Driver / Carrier</div><div class="sign">Received By</div></div>
    <div class="note">This delivery challan accompanies an internal stock transfer. Goods remain company property in transit until received at the destination.</div>
    <script>window.onload=function(){}</script>
  </body></html>`;
}
