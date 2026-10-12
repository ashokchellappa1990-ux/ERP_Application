/** Client-side download / print helpers (no external libs). Call from the browser. */

export function downloadBlob(content: string, fileName: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadJson(obj: unknown, fileName: string) {
  downloadBlob(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2), fileName, "application/json");
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Build CSV text from columns + rows. */
export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const head = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[], fileName: string) {
  downloadBlob(toCsv(columns, rows), fileName, "text/csv;charset=utf-8");
}

/** Excel export (dependency-free): an HTML table served as .xls — Excel opens it
 *  natively and keeps numeric cells numeric. */
export function downloadExcel(
  columns: { key: string; label: string; money?: boolean }[],
  rows: Record<string, unknown>[],
  fileName: string,
  opts?: { title?: string; totals?: Record<string, number> },
) {
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
  const th = columns.map((c) => `<th style="background:#eef2ff;border:1px solid #c7d2fe;text-align:${c.money ? "right" : "left"};font-weight:bold">${esc(c.label)}</th>`).join("");
  const tr = rows.map((r) => `<tr>${columns.map((c) => `<td style="border:1px solid #d1d5db;text-align:${c.money ? "right" : "left"}">${esc(r[c.key])}</td>`).join("")}</tr>`).join("");
  const tot = opts?.totals
    ? `<tr>${columns.map((c, i) => i === 0 ? `<td style="border:1px solid #d1d5db;font-weight:bold">Total</td>` : `<td style="border:1px solid #d1d5db;text-align:${c.money ? "right" : "left"};font-weight:bold">${opts.totals && c.key in opts.totals ? esc(opts.totals[c.key]) : ""}</td>`).join("")}</tr>`
    : "";
  const titleRow = opts?.title ? `<tr><th colspan="${columns.length}" style="text-align:left;font-size:14px">${esc(opts.title)}</th></tr>` : "";
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">${titleRow}<thead><tr>${th}</tr></thead><tbody>${tr}${tot}</tbody></table></body></html>`;
  const name = fileName.endsWith(".xls") || fileName.endsWith(".xlsx") ? fileName : `${fileName.replace(/\.csv$/, "")}.xls`;
  downloadBlob(html, name, "application/vnd.ms-excel");
}

/** Open a print window with a titled table (uses the browser print → PDF flow). */
export function printTable(opts: { title: string; subtitle?: string; columns: { key: string; label: string; money?: boolean }[]; rows: Record<string, unknown>[]; totals?: Record<string, number> }) {
  if (typeof window === "undefined") return;
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
  const th = opts.columns.map((c) => `<th style="text-align:${c.money ? "right" : "left"}">${esc(c.label)}</th>`).join("");
  const tr = opts.rows.map((r) => `<tr>${opts.columns.map((c) => `<td style="text-align:${c.money ? "right" : "left"}">${esc(r[c.key])}</td>`).join("")}</tr>`).join("");
  const tfoot = opts.totals
    ? `<tr class="tot">${opts.columns.map((c, i) => i === 0 ? `<td><b>Total</b></td>` : `<td style="text-align:${c.money ? "right" : "left"}">${opts.totals && c.key in opts.totals ? `<b>${esc(opts.totals[c.key])}</b>` : ""}</td>`).join("")}</tr>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 2px}p.sub{color:#555;margin:0 0 14px;font-size:12px}
  table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:5px 8px}th{background:#f2f4f7}tr.tot td{background:#f8fafc}
  @media print{button{display:none}}</style></head><body>
  <h1>${esc(opts.title)}</h1><p class="sub">${esc(opts.subtitle ?? "")}</p>
  <table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody><tfoot>${tfoot}</tfoot></table>
  <script>window.onload=function(){window.print()}</script></body></html>`;
  const w = window.open("", "_blank", "width=1000,height=720");
  if (w) { w.document.write(html); w.document.close(); w.focus(); }
}
