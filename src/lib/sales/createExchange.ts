import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildReturnPayload, type SaleLineCtx, type BuiltReturn } from "@/lib/sales/returnPayload";
import { prepareSale, type PreparedSale } from "@/lib/sales/createSale";
import { createReturnTx } from "@/lib/sales/createReturn";
import { createSaleTx } from "@/lib/sales/createSale";
import type { ExchangeConfig } from "@/lib/sales/exchangeConfig";
import type { SalesExchangeCreateInput } from "@/lib/contracts/salesExchange";
import type { TerminalStamp } from "@/lib/pos/terminalContext";
import type { ScopeUser } from "@/lib/auth/scope";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

/** Map a configured settlement mode → a sale/return tender mode. */
export function settleTender(mode: string): string {
  switch ((mode || "").toLowerCase()) {
    case "cash": return "Cash";
    case "upi": return "UPI";
    case "card": return "Card";
    case "wallet": return "Wallet";
    case "creditnote": return "Credit Note";
    case "storecredit": return "Store Credit";
    default: return "Cash";
  }
}

export type SaleWithLines = Prisma.SaleGetPayload<{ include: { lines: true } }>;

/** Per-sale-line qty already taken back (completed return/exchange legs + pending
 * exchange reservations) — used to cap the exchangeable quantity. */
export async function exchangedQtyMap(tenantId: number, saleId: number, excludeExchangeId?: number): Promise<Map<number, number>> {
  const [retAgg, pendItems] = await Promise.all([
    prisma.salesReturnLine.groupBy({ by: ["saleLineId"], where: { salesReturn: { saleId, status: { not: "Rejected" } } }, _sum: { returnQty: true } }),
    prisma.salesExchangeItem.groupBy({
      by: ["saleLineId"],
      where: { side: "RETURN", exchange: { tenantId, originalSaleId: saleId, status: "Pending", ...(excludeExchangeId ? { id: { not: excludeExchangeId } } : {}) } },
      _sum: { qty: true },
    }),
  ]);
  const m = new Map<number, number>();
  for (const a of retAgg) if (a.saleLineId != null) m.set(a.saleLineId, num(a._sum.returnQty));
  for (const a of pendItems) if (a.saleLineId != null) m.set(a.saleLineId, (m.get(a.saleLineId) ?? 0) + num(a._sum.qty));
  return m;
}

export interface ExchangeLegs {
  built: BuiltReturn;
  prepared: PreparedSale;
  returnValue: number;
  newSaleValue: number;
  priceDifference: number;
  settlementType: "collect" | "refund" | "even";
  settlementMode: string;
}

/** Validate the exchange against config + the original sale and produce both legs
 * (return payload + prepared new sale). Pure compute over already-loaded data plus
 * read-only catalog/tax lookups via prepareSale. Returns `{ error }` on any rule break. */
export async function buildExchangeLegs(
  user: ScopeUser,
  sale: SaleWithLines,
  input: SalesExchangeCreateInput,
  cfg: ExchangeConfig,
  opts?: { excludeExchangeId?: number },
): Promise<ExchangeLegs | { error: string }> {
  if (!cfg.exchangeAllowed) return { error: "Sales exchange is turned off in Sales Exchange Configuration." };

  // Channel gate.
  const channel = sale.channel ?? "POS";
  if (channel === "POS" && !cfg.allowB2cExchange) return { error: "B2C exchanges are disabled in configuration." };
  if (channel === "B2B" && !cfg.allowB2bExchange) return { error: "B2B exchanges are disabled in configuration." };

  // Settlement mode (must be enabled).
  const settlementMode = (input.settlementMode || cfg.defaultSettlement || "cash").trim();
  if (cfg.settlementModes.length && !cfg.settlementModes.includes(settlementMode)) {
    return { error: "Selected settlement mode is not enabled in Sales Exchange Configuration." };
  }

  // Build the per-line context from the original sale.
  const returned = await exchangedQtyMap(user.tenantId, sale.id, opts?.excludeExchangeId);
  const linesCtx = new Map<number, SaleLineCtx>();
  for (const sl of sale.lines) {
    linesCtx.set(sl.id, {
      saleLineId: sl.id, productId: sl.productId, productName: sl.productName, sku: sl.sku ?? null,
      soldQty: num(sl.qty), alreadyReturned: returned.get(sl.id) ?? 0,
      rate: num(sl.rate), discAmount: num(sl.discAmount), taxAmount: num(sl.taxAmount), value: num(sl.value), cost: num(sl.cost),
      batchNo: sl.batchNo ?? null, mfgDate: sl.mfgDate ?? null, expiryDate: sl.expiryDate ?? null,
    });
  }

  // Quantity rules.
  for (const rl of input.returnLines) {
    const src = linesCtx.get(Number(rl.saleLineId));
    if (!src) return { error: "A returned line does not belong to this invoice." };
    const qty = num(rl.returnQty);
    const remaining = r2(src.soldQty - src.alreadyReturned);
    if (!cfg.allowPartialExchange && qty < remaining - 0.0001) return { error: `Partial exchange is disabled — exchange the full quantity of "${src.productName}".` };
    if (cfg.fullQtyMandatory && qty < remaining - 0.0001) return { error: `Full quantity is mandatory for "${src.productName}".` };
    if (cfg.maxExchangeQty != null && qty > cfg.maxExchangeQty + 0.0001) return { error: `Exchange quantity for "${src.productName}" exceeds the maximum of ${cfg.maxExchangeQty}.` };
  }

  // Return leg — reuse the return payload builder (period, qty, value, handling).
  const built = buildReturnPayload(
    { lines: input.returnLines.map((l) => ({ saleLineId: l.saleLineId, returnQty: l.returnQty, reason: l.reason || input.reason, remarks: l.remarks, inventoryHandling: l.inventoryHandling })) },
    {
      saleDate: sale.saleDate, warehouse: sale.warehouse || "Main Store",
      config: { returnAllowed: true, reasonMandatory: false, inventoryHandlingEnabled: true, maxReturnDays: cfg.maxExchangeDays, refundModes: cfg.settlementModes, defaultInventoryHandling: cfg.defaultHandling },
      lines: linesCtx,
    },
  );
  if ("error" in built) return { error: built.error };

  // New-item leg — reuse the sale preparer; then mark it fully settled.
  const prep = await prepareSale(user, {
    saleDate: new Date().toISOString().slice(0, 10), warehouse: sale.warehouse || "Main Store",
    customerId: sale.customerId ?? undefined, customerName: sale.customerName ?? undefined, customerPhone: sale.customerPhone ?? undefined,
    lines: input.newLines, payments: [],
  });
  if ("error" in prep) return { error: prep.error };

  const returnValue = r2(built.refundAmount);
  const newSaleValue = r2(prep.total);
  const priceDifference = r2(newSaleValue - returnValue);
  const settlementType: ExchangeLegs["settlementType"] = priceDifference > 0.004 ? "collect" : priceDifference < -0.004 ? "refund" : "even";

  // Price rules.
  if (priceDifference !== 0 && !cfg.ignorePriceDifference) {
    if (!cfg.allowPriceDifference) return { error: "Price differences are not allowed for exchanges." };
    if (settlementType === "collect" && !cfg.collectIfHigher) return { error: "Collecting an additional amount for a dearer item is disabled." };
    if (settlementType === "refund" && !cfg.refundIfLower) return { error: "Refunding the difference for a cheaper item is disabled." };
  }

  // Settle the new sale in full via the chosen tender → net cash = price difference.
  const tender = settleTender(settlementMode);
  prep.payments = [{ mode: tender, amount: newSaleValue, reference: input.settlementRef || null }];
  prep.amountPaid = newSaleValue;
  prep.changeDue = 0;
  prep.paymentStatus = "Paid";
  prep.paymentMode = tender;

  return { built, prepared: prep, returnValue, newSaleValue, priceDifference, settlementType, settlementMode };
}

export interface PostExchangeOpts {
  user: { id: number; tenantId: number };
  seg: { businessId?: number; branchId?: number };
  stamp: TerminalStamp;
  sale: SaleWithLines;
  legs: ExchangeLegs;
  exchangeDate: string;
}

/** Create the two posted legs (return + new sale) for a Completed exchange inside
 * the caller's tx and return their ids to link onto the SalesExchange header. */
export async function postExchangeLegs(tx: Prisma.TransactionClient, opts: PostExchangeOpts): Promise<{ returnId: number; newSaleId: number }> {
  const { user, seg, stamp, sale, legs, exchangeDate } = opts;
  const channel = sale.channel ?? "POS";

  const ret = await createReturnTx(tx, {
    user, seg, stamp,
    sale: { id: sale.id, invoiceNo: sale.invoiceNo, customerId: sale.customerId, customerName: sale.customerName, customerPhone: sale.customerPhone },
    built: legs.built, refundMode: legs.settlementMode, status: "Completed", returnDate: exchangeDate,
    refundRemarks: "Sales exchange", notes: "Auto-created by sales exchange",
  });
  const newSale = await createSaleTx(tx, legs.prepared, { user, seg, stamp, channel, series: channel === "B2B" ? "b2b" : "b2c" });
  return { returnId: ret.id, newSaleId: newSale.id };
}
