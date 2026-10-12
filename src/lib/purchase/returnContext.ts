import { prisma } from "@/lib/db/prisma";
import type { PiItemCtx } from "@/lib/purchase/returnPayload";
import type { PiReturnLine, PiReturnSource } from "@/lib/contracts/purchaseReturn";

const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface PiReturnContext {
  pi: {
    id: number; invoiceNo: string; invoiceDate: string; invoiceType: string; purchaseType: string; status: string;
    grnId: number | null; grnNo: string; poNo: string; warehouse: string;
    supplierId: number | null; supplier: string; supplierGstin: string;
    taxableAmount: number; gstAmount: number; totalInvoiceAmount: number;
  };
  lines: PiReturnLine[];
}

/**
 * Load a Purchase Invoice + per-item returnable context (invoiced qty − already
 * returned), and the still-available manufacturer serials for serial-tracked
 * products (from the invoice's GRN(s)). Shared by the lookup GET and create POST.
 */
export async function loadPiReturnContext(tenantId: number, piId: number): Promise<PiReturnContext | null> {
  const pi = await prisma.purchaseInvoice.findFirst({ where: { id: piId, tenantId }, include: { items: { orderBy: { id: "asc" } }, grnMap: true } });
  if (!pi) return null;

  const grnIds = pi.grnMap.map((g) => g.grnId);
  const firstGrn = pi.grnMap[0] ?? null;

  // Already-returned per PI item (across non-cancelled returns).
  const agg = await prisma.purchaseReturnItem.groupBy({
    by: ["piItemId"],
    where: { piItemId: { in: pi.items.map((i) => i.id) }, purchaseReturn: { purchaseInvoiceId: piId, status: { not: "Cancelled" } } },
    _sum: { returnQty: true },
  });
  const returned = new Map<number, number>(agg.filter((a) => a.piItemId != null).map((a) => [a.piItemId as number, num(a._sum.returnQty)]));

  // Serial-tracked products + their still-available serials (from the GRN(s)).
  const productIds = Array.from(new Set(pi.items.map((i) => i.productId).filter((x): x is number => x != null)));
  const prods = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, invSerial: true } }) : [];
  const serialPids = new Set(prods.filter((p) => p.invSerial).map((p) => p.id));
  const serialRows = serialPids.size
    ? await prisma.qrCodeMapping.findMany({
        where: { tenantId, productId: { in: [...serialPids] }, serialNo: { not: null }, status: "Active", ...(grnIds.length ? { grnId: { in: grnIds } } : {}) },
        select: { id: true, serialNo: true, code: true, productId: true },
        orderBy: { id: "asc" },
      })
    : [];
  const serialsByProduct = new Map<number, { id: number; serialNo: string; code: string }[]>();
  for (const s of serialRows) {
    const arr = serialsByProduct.get(s.productId) ?? [];
    arr.push({ id: s.id, serialNo: s.serialNo ?? s.code, code: s.code });
    serialsByProduct.set(s.productId, arr);
  }

  const lines: PiReturnLine[] = pi.items.map((it) => {
    const invoicedQty = num(it.qty);
    const alreadyReturned = returned.get(it.id) ?? 0;
    const serialTracked = it.productId != null && serialPids.has(it.productId);
    return {
      piItemId: it.id, grnLineId: it.grnLineId, productId: it.productId, productName: it.productName, sku: it.sku ?? "", hsn: it.hsn ?? "",
      invoicedQty, alreadyReturned, returnableQty: +(invoicedQty - alreadyReturned).toFixed(3),
      rate: num(it.unitPrice), taxPct: num(it.taxPct), taxAmount: num(it.taxAmount), discAmount: num(it.discAmount), lineValue: num(it.lineValue),
      batchNo: it.batchNo ?? "", mfgDate: it.mfgDate ?? "", expiryDate: it.expiryDate ?? "",
      serialTracked, availableSerials: serialTracked && it.productId != null ? (serialsByProduct.get(it.productId) ?? []) : [],
    };
  });

  return {
    pi: {
      id: pi.id, invoiceNo: pi.invoiceNo, invoiceDate: pi.supplierInvoiceDate ?? pi.createdAt.toISOString().slice(0, 10),
      invoiceType: pi.invoiceType, purchaseType: pi.purchaseType, status: pi.status,
      grnId: firstGrn?.grnId ?? null, grnNo: firstGrn?.grnNo ?? "", poNo: pi.poNo ?? "", warehouse: pi.warehouse ?? "",
      supplierId: pi.supplierId, supplier: pi.supplier ?? "", supplierGstin: pi.supplierGstin ?? "",
      taxableAmount: num(pi.taxableAmount), gstAmount: num(pi.gstAmount), totalInvoiceAmount: num(pi.totalInvoiceAmount),
    },
    lines,
  };
}

/** Shape the context into the PiReturnSource DTO for the lookup endpoint. */
export function toPiReturnSource(ctx: PiReturnContext): PiReturnSource {
  return { ...ctx.pi, lines: ctx.lines };
}

/** Build the per-item ctx Map the payload builder consumes (server-side, for POST). */
export function toPayloadCtxLines(ctx: PiReturnContext): Map<number, PiItemCtx> {
  const map = new Map<number, PiItemCtx>();
  for (const l of ctx.lines) {
    const availableSerials = new Set<string>();
    for (const s of l.availableSerials) { availableSerials.add(s.code); if (s.serialNo) availableSerials.add(s.serialNo); }
    map.set(l.piItemId, {
      piItemId: l.piItemId, grnLineId: l.grnLineId, productId: l.productId, productName: l.productName, sku: l.sku || null, hsn: l.hsn || null,
      invoicedQty: l.invoicedQty, alreadyReturned: l.alreadyReturned,
      rate: l.rate, taxPct: l.taxPct || null, taxAmount: l.taxAmount, discAmount: l.discAmount, lineValue: l.lineValue,
      batchNo: l.batchNo || null, mfgDate: l.mfgDate || null, expiryDate: l.expiryDate || null,
      serialTracked: l.serialTracked, availableSerials,
    });
  }
  return map;
}
