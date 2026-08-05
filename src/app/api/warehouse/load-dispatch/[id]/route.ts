import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { loadDispatchUpdateInput } from "@/lib/contracts/loadDispatch";
import type { LoadDispatchDetail } from "@/lib/contracts/loadDispatch";
import { getDispatchConfig } from "@/lib/settings/dispatchConfig";
import { computeDriverBatta, computeTransitPass } from "@/lib/settings/transportConfigDefaults";

const PERM = "warehouse.transfer";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/warehouse/load-dispatch/[id] — full detail with items.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const doc = await prisma.loadDispatch.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, include: { items: { orderBy: { id: "asc" } } } });
  if (!doc) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });

  const [vehicle, sale] = await Promise.all([
    doc.vehicleId ? prisma.vehicleMaster.findFirst({ where: { id: doc.vehicleId }, select: { vehicleNo: true } }) : Promise.resolve(null),
    doc.saleId ? prisma.sale.findFirst({ where: { id: doc.saleId, tenantId: user.tenantId }, select: { invoiceNo: true, paymentMode: true, total: true, amountPaid: true } }) : Promise.resolve(null),
  ]);

  const data: LoadDispatchDetail = {
    id: doc.id, dispatchNo: doc.dispatchNo, dispatchDate: doc.dispatchDate, docType: doc.docType as LoadDispatchDetail["docType"],
    sourceRefType: doc.sourceRefType, sourceRefId: doc.sourceRefId, sourceRefNo: doc.sourceRefNo,
    partyType: doc.partyType, partyId: doc.partyId, partyName: doc.partyName,
    deliveryAddress: doc.deliveryAddress, warehouse: doc.warehouse, destinationWarehouse: doc.destinationWarehouse,
    vehicleGateEntryId: doc.vehicleGateEntryId,
    transportCompanyId: doc.transportCompanyId, vehicleId: doc.vehicleId, vehicleNo: vehicle?.vehicleNo ?? null, vehicleType: doc.vehicleType,
    driverName: doc.driverName, driverMobile: doc.driverMobile, driverLicenseNo: doc.driverLicenseNo,
    helperName: doc.helperName, helperMobile: doc.helperMobile, routeId: doc.routeId,
    sealNumber: doc.sealNumber, trailerNumber: doc.trailerNumber, containerNumber: doc.containerNumber,
    loadingBayId: doc.loadingBayId, supervisor: doc.supervisor,
    loadingStart: doc.loadingStart ? doc.loadingStart.toISOString() : null, loadingEnd: doc.loadingEnd ? doc.loadingEnd.toISOString() : null,
    packages: doc.packages, pallets: doc.pallets,
    status: doc.status as LoadDispatchDetail["status"],
    totalProducts: doc.totalProducts, totalQty: num(doc.totalQty), totalWeight: doc.totalWeight != null ? num(doc.totalWeight) : null, totalPackages: doc.totalPackages,
    remarks: doc.remarks, cancelReason: doc.cancelReason,
    deliveryChallanId: doc.deliveryChallanId, saleId: doc.saleId,
    paymentMode: doc.paymentMode as LoadDispatchDetail["paymentMode"], paymentAmount: doc.paymentAmount != null ? num(doc.paymentAmount) : null,
    paymentMethod: doc.paymentMethod, bankId: doc.bankId, bankName: doc.bankName, bankAccount: doc.bankAccount,
    paymentSplits: Array.isArray(doc.paymentSplits) ? (doc.paymentSplits as unknown as LoadDispatchDetail["paymentSplits"]) : null,
    vehicleRent: num(doc.vehicleRent), transitPassQty: doc.transitPassQty != null ? num(doc.transitPassQty) : null,
    transitPassAmount: num(doc.transitPassAmount), driverBattaAmount: num(doc.driverBattaAmount),
    driverBattaMode: doc.driverBattaMode as LoadDispatchDetail["driverBattaMode"],
    saleInvoiceNo: sale?.invoiceNo ?? null, saleType: sale?.paymentMode ?? null,
    saleOutstanding: sale ? num(sale.total) - num(sale.amountPaid) : null,
    createdByName: doc.createdByName, createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString(),
    items: doc.items.map((it) => ({
      id: it.id, productId: it.productId, productName: it.productName, sku: it.sku, uom: it.uom,
      batchNo: it.batchNo, mfgDate: it.mfgDate, expiryDate: it.expiryDate, serialNo: it.serialNo,
      allocationLotId: it.allocationLotId, allocatedQty: num(it.allocatedQty), dispatchedQty: num(it.dispatchedQty), pendingQty: num(it.pendingQty),
      rate: it.rate != null ? num(it.rate) : null, value: num(it.value),
      discPct: it.discPct != null ? num(it.discPct) : null, discAmount: num(it.discAmount),
      taxPct: it.taxPct != null ? num(it.taxPct) : null, taxableValue: num(it.taxableValue), taxAmount: num(it.taxAmount),
      qrCode: it.qrCode, remarks: it.remarks,
    })),
  };
  return NextResponse.json({ ok: true, data });
}

// PUT /api/warehouse/load-dispatch/[id] — edit Transport Info / loading
// details / item dispatch quantities while still Draft or Ready.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "LoadDispatch", entityId: id });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = loadDispatchUpdateInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const input = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const doc = await prisma.loadDispatch.findFirst({ where: { ...sw, id, deletedAt: null }, select: { id: true, status: true, dispatchNo: true, businessId: true, branchId: true, docType: true } });
  if (!doc) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });
  if (!["Draft", "Ready", "Loading"].includes(doc.status)) return NextResponse.json({ ok: false, message: `A ${doc.status} dispatch can no longer be edited.` }, { status: 422 });

  // Driver Batta / Transit Pass — same "never trust the client for money"
  // recompute this dispatch was created with (see createDirectCustomerDispatch),
  // now also applied here so a Payment Details correction after creation
  // (e.g. a mistyped Transit Pass Qty) is recalculated the same way.
  const cfg = await getDispatchConfig(user);
  const itemsForTon = input.items
    ? input.items.map((it) => ({ uom: it.uom ?? null, dispatchedQty: it.dispatchedQty }))
    : await prisma.loadDispatchItem.findMany({ where: { loadDispatchId: id }, select: { uom: true, dispatchedQty: true } });
  const tonQty = itemsForTon.reduce((s, it) => s + ((it.uom || "").toLowerCase() === "ton" ? Number(it.dispatchedQty) : 0), 0);
  const driverBattaAmount = Math.round(computeDriverBatta(cfg, tonQty) * 100) / 100;
  const transitPassQty = cfg.fields.transitPassQtyMode === "AutoNetWeight" ? tonQty : (input.transitPassQty != null ? Math.max(0, input.transitPassQty) : undefined);
  const transitPassAmount = transitPassQty != null ? Math.round(computeTransitPass(cfg, transitPassQty) * 100) / 100 : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.loadDispatch.update({
      where: { id },
      data: {
        vehicleGateEntryId: input.vehicleGateEntryId, transportCompanyId: input.transportCompanyId, vehicleId: input.vehicleId,
        vehicleType: input.vehicleType, driverName: input.driverName, driverMobile: input.driverMobile, driverLicenseNo: input.driverLicenseNo,
        helperName: input.helperName, helperMobile: input.helperMobile, routeId: input.routeId,
        sealNumber: input.sealNumber, trailerNumber: input.trailerNumber, containerNumber: input.containerNumber,
        loadingBayId: input.loadingBayId, supervisor: input.supervisor,
        loadingStart: input.loadingStart ? new Date(input.loadingStart) : undefined, loadingEnd: input.loadingEnd ? new Date(input.loadingEnd) : undefined,
        packages: input.packages, pallets: input.pallets, remarks: input.remarks,
        totalPackages: input.packages != null ? input.packages : undefined,
        paymentMode: input.payment?.paymentMode, paymentAmount: input.payment?.paymentAmount,
        paymentMethod: input.payment?.paymentMethod, bankId: input.payment?.bankId,
        bankName: input.payment?.bankName, bankAccount: input.payment?.bankAccount,
        vehicleRent: input.vehicleRent, transitPassQty, transitPassAmount, driverBattaAmount,
        driverBattaMode: input.driverBattaMode,
        updatedBy: user.id,
      },
    });

    if (input.items) {
      for (const it of input.items) {
        if (it.dispatchedQty > it.allocatedQty + 0.001) throw new Error(`"${it.productName ?? "Item"}" — dispatched quantity cannot exceed the allocated quantity.`);
      }
      // Simple replace-all-lines update path (this screen doesn't do per-line diffing).
      await tx.loadDispatchItem.deleteMany({ where: { loadDispatchId: id } });
      await tx.loadDispatchItem.createMany({
        data: input.items.map((it) => {
          const rate = it.rate ?? 0;
          const gross = rate * it.dispatchedQty;
          const discPct = it.discPct ?? null;
          const discAmount = it.discAmount ?? (discPct ? gross * (discPct / 100) : 0);
          const taxableValue = Math.max(0, gross - discAmount);
          const taxPct = it.taxPct ?? null;
          const taxAmount = taxPct ? taxableValue * (taxPct / 100) : 0;
          return {
            tenantId: user.tenantId, loadDispatchId: id, productId: it.productId, productName: it.productName ?? "",
            sku: it.sku ?? null, uom: it.uom ?? null, batchNo: it.batchNo ?? null, mfgDate: it.mfgDate ?? null, expiryDate: it.expiryDate ?? null,
            serialNo: it.serialNo ?? null, allocationLotId: it.allocationLotId ?? null,
            allocatedQty: it.allocatedQty, dispatchedQty: it.dispatchedQty, pendingQty: Math.max(0, it.allocatedQty - it.dispatchedQty),
            rate: it.rate ?? null, discPct, discAmount, taxPct, taxableValue, taxAmount, value: taxableValue + taxAmount,
            qrCode: it.qrCode ?? null, remarks: it.remarks ?? null,
          };
        }),
      });
      const totals = input.items.reduce((s, it) => ({ qty: s.qty + it.dispatchedQty, count: s.count + 1 }), { qty: 0, count: 0 });
      await tx.loadDispatch.update({ where: { id }, data: { totalQty: totals.qty, totalProducts: totals.count } });
    }
  });

  await writeAudit(prisma, user, { action: "load_dispatch.update", entity: "LoadDispatch", entityId: id, summary: `Updated Load & Dispatch ${doc.dispatchNo}`, businessId: doc.businessId ?? null, branchId: doc.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Saved." });
}
