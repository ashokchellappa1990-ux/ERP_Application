/**
 * Validate + normalise a Purchase Return payload against the ORIGINAL purchase
 * invoice + config. Pure (no DB) — the route supplies the invoice context. The
 * return inherits the invoice's purchaseType; inventory effects apply to the
 * Inventory type only (Service / Expense / Asset return value-only).
 */

export interface PrLineInput {
  piItemId?: number | string;
  returnQty?: number | string;
  reason?: string;
  remarks?: string;
  inventoryHandling?: string;
  qrCodes?: string[];
}
export interface PrBodyInput {
  purchaseInvoiceId?: number;
  reason?: string;
  remarks?: string;
  lines?: PrLineInput[];
}

/** Per-line context from the original purchase invoice (one entry per PI item). */
export interface PiItemCtx {
  piItemId: number; grnLineId: number | null; productId: number | null; productName: string; sku: string | null; hsn: string | null;
  invoicedQty: number; alreadyReturned: number;
  rate: number; taxPct: number | null; taxAmount: number; discAmount: number; lineValue: number;
  batchNo: string | null; mfgDate: string | null; expiryDate: string | null;
  serialTracked: boolean; availableSerials: Set<string>; // codes + serialNos that are still returnable
}
export interface PrCtx {
  purchaseType: string;     // Inventory | Service | Expense | Asset
  invoiceDate: string;
  config: { returnAllowed: boolean; reasonMandatory: boolean };
  lines: Map<number, PiItemCtx>;
}

export interface BuiltPrLine {
  piItemId: number; grnLineId: number | null; productId: number | null; productName: string; sku: string | null; hsn: string | null;
  invoicedQty: number; alreadyReturned: number; returnQty: number; rate: number;
  taxPct: number | null; taxAmount: number; discAmount: number; taxableValue: number; returnValue: number;
  reason: string | null; remarks: string | null; inventoryHandling: string;
  batchNo: string | null; mfgDate: string | null; expiryDate: string | null;
  qrCodes: string[];
}
export interface BuiltPr {
  lines: BuiltPrLine[];
  taxableAmount: number; taxAmount: number; returnAmount: number; itemCount: number;
}

const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
const r3 = (n: number) => +(Number(n) || 0).toFixed(3);
const HANDLINGS = new Set(["vendor", "damaged", "scrap"]);

export function buildPurchaseReturnPayload(body: PrBodyInput, ctx: PrCtx): BuiltPr | { error: string } {
  if (!ctx.config.returnAllowed) return { error: "Purchase returns are turned off in Purchase Configuration." };

  const raw = (body.lines ?? []).filter((l) => Number(l.returnQty) > 0);
  if (!raw.length) return { error: "Select at least one line with a return quantity." };
  const isInventory = ctx.purchaseType === "Inventory";

  const lines: BuiltPrLine[] = [];
  let taxableAmount = 0, taxAmount = 0, returnAmount = 0, itemCount = 0;
  const seenSerials = new Set<string>();

  for (const l of raw) {
    const pid = Number(l.piItemId);
    const src = ctx.lines.get(pid);
    if (!src) return { error: "A returned line does not belong to this invoice." };
    const returnQty = r3(Number(l.returnQty));
    const remaining = r3(src.invoicedQty - src.alreadyReturned);
    if (returnQty > remaining + 0.0001) return { error: `Return qty for "${src.productName}" exceeds the available quantity (${remaining}).` };

    const reason = (l.reason ?? "").trim() || (body.reason ?? "").trim() || null;
    if (ctx.config.reasonMandatory && !reason) return { error: `A return reason is required for "${src.productName}".` };
    // Remarks mandatory (spec).
    const remarks = (l.remarks ?? "").trim() || (body.remarks ?? "").trim() || null;
    if (ctx.config.reasonMandatory && !remarks) return { error: `Remarks are required for "${src.productName}".` };

    let handling = (l.inventoryHandling ?? "").trim() || "vendor";
    if (!isInventory) handling = "vendor";
    if (!HANDLINGS.has(handling)) handling = "vendor";

    // Serial-tracked Inventory lines: the exact serials must be supplied + valid.
    let qrCodes: string[] = [];
    if (isInventory && src.serialTracked) {
      qrCodes = Array.from(new Set((l.qrCodes ?? []).map((c) => String(c).trim()).filter(Boolean)));
      if (qrCodes.length !== Math.round(returnQty)) {
        return { error: `Select exactly ${Math.round(returnQty)} serial(s) for "${src.productName}".` };
      }
      for (const c of qrCodes) {
        if (!src.availableSerials.has(c)) return { error: `Serial "${c}" is not an available piece for "${src.productName}".` };
        if (seenSerials.has(c)) return { error: `Serial "${c}" is selected more than once.` };
        seenSerials.add(c);
      }
    }

    // Proportional split of the invoiced line value (already net of discount, incl tax).
    const frac = src.invoicedQty > 0 ? returnQty / src.invoicedQty : 0;
    const returnValue = r2(src.lineValue * frac);
    const lineTax = r2(src.taxAmount * frac);
    const lineDisc = r2(src.discAmount * frac);
    const taxableValue = r2(returnValue - lineTax);

    taxableAmount += taxableValue; taxAmount += lineTax; returnAmount += returnValue; itemCount += returnQty;

    lines.push({
      piItemId: pid, grnLineId: src.grnLineId, productId: src.productId, productName: src.productName, sku: src.sku, hsn: src.hsn,
      invoicedQty: src.invoicedQty, alreadyReturned: src.alreadyReturned, returnQty, rate: src.rate,
      taxPct: src.taxPct, taxAmount: lineTax, discAmount: lineDisc, taxableValue, returnValue,
      reason, remarks, inventoryHandling: handling,
      batchNo: src.batchNo, mfgDate: src.mfgDate, expiryDate: src.expiryDate, qrCodes,
    });
  }

  return {
    lines, taxableAmount: r2(taxableAmount), taxAmount: r2(taxAmount), returnAmount: r2(returnAmount), itemCount: r3(itemCount),
  };
}
