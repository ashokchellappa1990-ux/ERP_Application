import type { Prisma } from "@prisma/client";

/**
 * Single-use control for "unique"-mode QR codes (one code = one piece). A unique
 * code may be sold once; afterwards it is marked Sold and can't be scanned/sold
 * again. "shared"-mode codes front a whole line and are never marked Sold.
 *
 * `qrCodes` on each sale line is the CSV of unique codes scanned for that line.
 */

/** Flatten the scanned codes off the request lines (deduped, trimmed). Codes now
 * arrive as a string[] per line and are stored one-row-per-code in sale_line_qrs. */
export function collectQrCodes(lines: Array<{ qrCodes?: string[] | null }>): string[] {
  const set = new Set<string>();
  for (const l of lines) {
    for (const c of l.qrCodes ?? []) {
      const code = String(c).trim();
      if (code) set.add(code);
    }
  }
  return [...set];
}

/**
 * Validate scanned codes are sellable: each must exist for this tenant and, when
 * it's a unique code, must not already be Sold. Returns an error message (the
 * first violation) or null. Run before committing the sale → map to HTTP 422.
 */
export async function validateQrCodes(tx: Prisma.TransactionClient, tenantId: number, codes: string[], warehouse?: string | null): Promise<string | null> {
  if (!codes.length) return null;
  const rows = await tx.qrCodeMapping.findMany({ where: { tenantId, code: { in: codes } }, select: { code: true, mode: true, status: true, warehouse: true, serialNo: true } });
  const byCode = new Map(rows.map((r) => [r.code, r]));
  for (const c of codes) {
    const r = byCode.get(c);
    if (!r) return `QR / serial code ${c} is not recognised.`;
    const label = r.serialNo ? `Serial ${r.serialNo}` : `QR code ${c}`;
    // A unique/serial piece must be Available (status "Active") to be sold.
    if (r.mode === "unique" && r.status !== "Active") {
      return r.status === "Sold" ? `${label} has already been sold — it can't be used again.` : `${label} is ${r.status} and not available for sale.`;
    }
    // When billing from a specific warehouse, the piece must belong to it.
    if (r.mode === "unique" && warehouse && r.warehouse && r.warehouse !== warehouse) {
      return `${label} belongs to ${r.warehouse}, not ${warehouse}.`;
    }
  }
  return null;
}

/**
 * Mark unique codes Sold against a sale. Uses a conditional update (only codes
 * still Active are claimed); throws if any couldn't be claimed (lost a race / was
 * sold between validation and commit) so the surrounding transaction rolls back.
 */
export interface MarkSoldOpts {
  invoiceNo?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  saleDate?: string | null;     // warranty start
  warrantyMonths?: number | null; // default 12 when omitted (serial products)
}
export async function markQrCodesSold(tx: Prisma.TransactionClient, tenantId: number, codes: string[], saleId: number, opts: MarkSoldOpts = {}): Promise<void> {
  if (!codes.length) return;
  // Warranty window for serial-tracked pieces: start = sale date, end = +N months.
  const start = opts.saleDate || new Date().toISOString().slice(0, 10);
  let warrantyEnd: string | null = null;
  const months = opts.warrantyMonths ?? 12;
  if (months > 0) {
    const d = new Date(start + "T00:00:00");
    if (!isNaN(d.getTime())) {
      d.setMonth(d.getMonth() + months);
      // Format from local parts (avoid toISOString UTC shift causing an off-by-one).
      warrantyEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  const res = await tx.qrCodeMapping.updateMany({
    where: { tenantId, code: { in: codes }, mode: "unique", status: "Active" },
    data: {
      status: "Sold", soldSaleId: saleId, soldAt: new Date(), soldInvoiceNo: opts.invoiceNo ?? undefined,
      customerId: opts.customerId ?? undefined, customerName: opts.customerName ?? undefined,
      warrantyStart: start, warrantyEnd, activatedAt: new Date(),
    },
  });
  const uniqueCount = await tx.qrCodeMapping.count({ where: { tenantId, code: { in: codes }, mode: "unique" } });
  if (res.count !== uniqueCount) {
    throw new Error("A scanned QR / serial code was already sold. Please re-scan and try again.");
  }
}
