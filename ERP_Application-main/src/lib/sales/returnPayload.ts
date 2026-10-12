/**
 * Validate + normalise a Sales Return Add payload against the ORIGINAL sale and
 * the return configuration. Pure (no DB) — the route supplies the sale context.
 */

export interface ReturnLineInput {
  saleLineId?: number | string;
  returnQty?: number | string;
  reason?: string;
  remarks?: string;
  inventoryHandling?: string;
}
export interface ReturnBodyInput {
  saleId?: number; invoiceNo?: string;
  customerId?: number | null; customerName?: string; customerPhone?: string;
  refundMode?: string; refundRef?: string; refundRemarks?: string; notes?: string;
  lines?: ReturnLineInput[];
}

/** Per-line context from the original sale (one entry per sale line). */
export interface SaleLineCtx {
  saleLineId: number; productId: number; productName: string; sku: string | null;
  soldQty: number; alreadyReturned: number;
  rate: number; discAmount: number; taxAmount: number; value: number; cost: number;
  batchNo: string | null; mfgDate: string | null; expiryDate: string | null;
}
export interface ReturnCtx {
  saleDate: string;
  warehouse: string;
  config: {
    returnAllowed: boolean;
    reasonMandatory: boolean;
    inventoryHandlingEnabled: boolean;
    maxReturnDays: number | null; // null = unlimited
    refundModes: string[]; // allowed
    defaultInventoryHandling: string;
  };
  lines: Map<number, SaleLineCtx>;
}

export interface BuiltReturnLine {
  saleLineId: number; productId: number; productName: string; sku: string | null;
  soldQty: number; returnQty: number; rate: number; discAmount: number; taxAmount: number;
  taxableValue: number; returnValue: number; cost: number; unitCost: number;
  reason: string | null; remarks: string | null; inventoryHandling: string;
  batchNo: string | null; mfgDate: string | null; expiryDate: string | null;
}
export interface BuiltReturn {
  lines: BuiltReturnLine[];
  grossAmount: number; discountAdj: number; taxAdj: number; refundAmount: number; itemCount: number;
  inventoryCost: number; writeOffCost: number;
}

const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
const r3 = (n: number) => +(Number(n) || 0).toFixed(3);
const HANDLINGS = new Set(["good", "damaged", "expired", "vendor", "scrap", "quarantine"]);

export function buildReturnPayload(body: ReturnBodyInput, ctx: ReturnCtx): BuiltReturn | { error: string } {
  if (!ctx.config.returnAllowed) return { error: "Sales returns are turned off in Sales Return Configuration." };

  // Max return period (vs the original sale date).
  if (ctx.config.maxReturnDays != null && ctx.saleDate) {
    const sold = new Date(ctx.saleDate + "T00:00:00");
    if (!isNaN(sold.getTime())) {
      const days = Math.floor((Date.now() - sold.getTime()) / 86400000);
      if (days > ctx.config.maxReturnDays) return { error: `Return window of ${ctx.config.maxReturnDays} days has passed for this invoice.` };
    }
  }
  if (body.refundMode && ctx.config.refundModes.length && !ctx.config.refundModes.includes(body.refundMode)) {
    return { error: "Selected refund mode is not enabled in Sales Return Configuration." };
  }

  const raw = (body.lines ?? []).filter((l) => Number(l.returnQty) > 0);
  if (!raw.length) return { error: "Select at least one product with a return quantity." };

  const lines: BuiltReturnLine[] = [];
  let grossAmount = 0, discountAdj = 0, taxAdj = 0, refundAmount = 0, itemCount = 0, inventoryCost = 0, writeOffCost = 0;

  for (const l of raw) {
    const sid = Number(l.saleLineId);
    const src = ctx.lines.get(sid);
    if (!src) return { error: "A returned line does not belong to this invoice." };
    const returnQty = r3(Number(l.returnQty));
    const remaining = r3(src.soldQty - src.alreadyReturned);
    if (returnQty > remaining + 0.0001) return { error: `Return qty for "${src.productName}" exceeds the returnable quantity (${remaining}).` };

    const reason = (l.reason ?? "").trim() || null;
    if (ctx.config.reasonMandatory && !reason) return { error: `A return reason is required for "${src.productName}".` };

    let handling = (l.inventoryHandling ?? "").trim() || ctx.config.defaultInventoryHandling || "good";
    if (!ctx.config.inventoryHandlingEnabled) handling = "good";
    if (!HANDLINGS.has(handling)) handling = "good";

    // Proportional refund of the sold line (value already net of discount, incl tax).
    const frac = src.soldQty > 0 ? returnQty / src.soldQty : 0;
    const returnValue = r2(src.value * frac);
    const lineTax = r2(src.taxAmount * frac);
    const lineDisc = r2(src.discAmount * frac);
    const taxableValue = r2(returnValue - lineTax);
    const unitCost = src.soldQty > 0 ? r2(src.cost / src.soldQty) : 0;
    const lineCost = r2(unitCost * returnQty);

    grossAmount += returnValue; taxAdj += lineTax; discountAdj += lineDisc; refundAmount += returnValue; itemCount += returnQty;
    inventoryCost += lineCost;
    if (handling === "damaged" || handling === "expired" || handling === "scrap") writeOffCost += lineCost;

    lines.push({
      saleLineId: sid, productId: src.productId, productName: src.productName, sku: src.sku,
      soldQty: src.soldQty, returnQty, rate: src.rate, discAmount: lineDisc, taxAmount: lineTax,
      taxableValue, returnValue, cost: lineCost, unitCost,
      reason, remarks: (l.remarks ?? "").trim() || null, inventoryHandling: handling,
      batchNo: src.batchNo, mfgDate: src.mfgDate, expiryDate: src.expiryDate,
    });
  }

  return {
    lines, grossAmount: r2(grossAmount), discountAdj: r2(discountAdj), taxAdj: r2(taxAdj),
    refundAmount: r2(refundAmount), itemCount: r3(itemCount), inventoryCost: r2(inventoryCost), writeOffCost: r2(writeOffCost),
  };
}
