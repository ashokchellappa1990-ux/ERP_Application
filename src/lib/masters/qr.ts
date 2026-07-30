/**
 * Real, scannable QR codes for sticker previews & printing, backed by the
 * `qrcode` package. `qrMatrix()` returns the on/off module grid synchronously
 * and `qrSvgString()` renders it to SVG markup — used by both the on-screen
 * <QrCode> component and the print sheet so they always match.
 */

import QRCode from "qrcode";

export type QrEc = "L" | "M" | "Q" | "H";
export type QrStyle = "square" | "dots" | "rounded";

export interface QrRenderOptions {
  dark?: string;
  light?: string;
  ec?: QrEc;
  style?: QrStyle;
}

/** Build the on/off module matrix for a value (true = dark module). */
export function qrMatrix(value: string, ec: QrEc = "M"): boolean[][] {
  const qr = QRCode.create(value || "ONEPOS", { errorCorrectionLevel: ec });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const m: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(!!data[r * n + c]);
    m.push(row);
  }
  return m;
}

/** Render a value as an SVG markup string (used for previews and printing). */
export function qrSvgString(value: string, px = 120, opts: QrRenderOptions = {}): string {
  const dark = opts.dark || "#0f172a";
  const light = opts.light || "#ffffff";
  const style = opts.style || "square";
  const m = qrMatrix(value, opts.ec || "M");
  const n = m.length;
  const quiet = 2;
  const total = n + quiet * 2;
  const cell = px / total;
  let shapes = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue;
      const x = +((c + quiet) * cell).toFixed(2);
      const y = +((r + quiet) * cell).toFixed(2);
      const s = +cell.toFixed(2);
      if (style === "dots") {
        const cr = +(s / 2).toFixed(2);
        shapes += `<circle cx="${+(x + cr).toFixed(2)}" cy="${+(y + cr).toFixed(2)}" r="${+(cr * 0.92).toFixed(2)}"/>`;
      } else if (style === "rounded") {
        shapes += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${+(s * 0.28).toFixed(2)}"/>`;
      } else {
        shapes += `<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" shape-rendering="${style === "square" ? "crispEdges" : "geometricPrecision"}"><rect width="${px}" height="${px}" fill="${light}"/><g fill="${dark}">${shapes}</g></svg>`;
}
