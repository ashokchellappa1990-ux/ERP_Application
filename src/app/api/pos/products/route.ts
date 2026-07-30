import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { BUCKET_WAREHOUSES } from "@/lib/inventory/buckets";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const parsePct = (v: unknown) => { const n = parseFloat(String(v ?? "").replace("%", "")); return Number.isFinite(n) ? n : 0; };

// GET /api/pos/products?q=  — search sellable products by name / code / SKU /
// barcode / QR code. Returns selling price (retail → MRP) + on-hand stock.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

  // Only leaf products are sellable (a variant style's children are the SKUs).
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.ProductWhereInput = { ...sw, status: "Active", children: { none: {} } };
  // Batch/mfg/expiry + single-use info resolved from a scanned QR code.
  const qrBatch = new Map<number, { batchNo: string | null; mfgDate: string | null; expiryDate: string | null; code: string; mode: string; sold: boolean }>();
  if (q) {
    // A scanned QR reference resolves to its product (and the batch it was made for).
    const qr = await prisma.qrCodeMapping.findMany({ where: { ...sw, code: q }, select: { productId: true, batchNo: true, mfgDate: true, expiryDate: true, code: true, mode: true, status: true }, take: 5 });
    const qrIds = qr.map((m) => m.productId);
    for (const m of qr) if (!qrBatch.has(m.productId)) qrBatch.set(m.productId, { batchNo: m.batchNo, mfgDate: m.mfgDate, expiryDate: m.expiryDate, code: m.code, mode: m.mode, sold: m.status === "Sold" });
    where.OR = [
      { name: { contains: q } }, { code: { contains: q } }, { sku: { contains: q } },
      { barcode: q }, { ean: q }, { gtin: q },
      ...(qrIds.length ? [{ id: { in: qrIds } }] : []),
    ];
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
    take: 30,
    select: { id: true, name: true, code: true, sku: true, barcode: true, hsn: true, baseUom: true, mrp: true, retailPrice: true, gstRate: true, brand: true, invBatch: true, invMfg: true, invExpiry: true, valuation: true, batchSalesPolicy: true },
  });

  const ids = products.map((p) => p.id);
  // On-hand stock for the active branch only (balances are keyed per branch).
  const balances = ids.length
    ? await prisma.inventoryBalance.findMany({ where: { ...sw, productId: { in: ids }, warehouse: { notIn: BUCKET_WAREHOUSES } }, select: { productId: true, qtyOnHand: true, purchaseRate: true, sellingRate: true } })
    : [];
  const stockMap = new Map<number, number>();
  const costMap = new Map<number, number>();
  const sellMap = new Map<number, number>();
  for (const b of balances) {
    stockMap.set(b.productId, (stockMap.get(b.productId) ?? 0) + num(b.qtyOnHand));
    if (b.purchaseRate != null && !costMap.has(b.productId)) costMap.set(b.productId, num(b.purchaseRate));
    if (b.sellingRate != null && !sellMap.has(b.productId)) sellMap.set(b.productId, num(b.sellingRate));
  }

  return NextResponse.json({
    ok: true,
    products: products.map((p) => {
      const cost = costMap.get(p.id) ?? 0;
      const invSelling = sellMap.get(p.id) ?? 0;
      // Selling price: this product's OWN inventory selling price first (each variant
      // can differ), then the product's Retail / MRP, then cost as a last resort.
      // (Variants inherit the parent's retail price, so inventory rate must win.)
      const price = invSelling || num(p.retailPrice) || num(p.mrp) || cost;
      const scanned = qrBatch.get(p.id);
      return {
        id: p.id, name: p.name, sku: p.sku ?? p.code ?? "", barcode: p.barcode ?? "", hsn: p.hsn ?? "",
        uom: p.baseUom ?? "Pcs", brand: p.brand ?? "",
        mrp: num(p.mrp), purchaseRate: cost, sellingRate: invSelling, price, gst: parsePct(p.gstRate),
        stock: stockMap.get(p.id) ?? 0,
        // Batch tracking: whether this product needs a batch, and (if scanned via QR)
        // the batch / mfg / expiry the scanned code belongs to — for the billing screen.
        batchTracked: p.invBatch || p.invMfg || p.invExpiry,
        invBatch: p.invBatch, invMfg: p.invMfg, invExpiry: p.invExpiry,
        valuation: p.valuation || "fifo", batchSalesPolicy: p.batchSalesPolicy || "warn",
        batchNo: scanned?.batchNo ?? null, mfgDate: scanned?.mfgDate ?? null, expiryDate: scanned?.expiryDate ?? null,
        // Scanned QR single-use: the code, its mode, and whether it's already sold.
        qrCode: scanned?.code ?? null, qrMode: scanned?.mode ?? null, qrSold: scanned?.sold ?? false,
      };
    }),
  });
}
