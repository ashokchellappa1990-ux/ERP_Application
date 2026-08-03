import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { gateEntryInput } from "@/lib/contracts/transport";
import { getDispatchConfig } from "@/lib/settings/dispatchConfig";

const PERM = "transport.gate-entry";

// GET /api/transport/gate-entry — list + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const customerName = (url.searchParams.get("customerName") ?? "").trim();
  const vehicleId = Number(url.searchParams.get("vehicleId") ?? "");
  const fromDate = (url.searchParams.get("fromDate") ?? "").trim();
  const toDate = (url.searchParams.get("toDate") ?? "").trim();
  const dispatchFromDate = (url.searchParams.get("dispatchFromDate") ?? "").trim();
  const dispatchToDate = (url.searchParams.get("dispatchToDate") ?? "").trim();
  const product = (url.searchParams.get("product") ?? "").trim();
  // "All" | "Generated" | "NotGenerated" — combinable with invoiceStatus below
  // so e.g. "DC Generated but Invoice Not Posted" is just both filters set at once.
  const dcStatusFilter = url.searchParams.get("dcStatus") ?? "All";
  const invoiceStatusFilter = url.searchParams.get("invoiceStatus") ?? "All";

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.VehicleGateEntryWhereInput = { ...sw, deletedAt: null };
  if (q) where.OR = [{ gateEntryNo: { contains: q } }, { referenceNo: { contains: q } }, { customerName: { contains: q } }];
  // Used by Direct Customer Dispatch to auto-load Transport/Driver details +
  // the gate reference number once a customer is picked, without a separate
  // manual gate-entry search step.
  if (customerName) where.customerName = { contains: customerName };
  // Fallback match when the vehicle was picked manually instead of via the
  // customer — finds that vehicle's own active gate entry (for Weighment Management).
  if (vehicleId > 0) where.vehicleId = vehicleId;
  if (status !== "All") where.status = status;
  // Vehicle Entry Date (arrivalTime) range filter — distinct from Dispatch Date below.
  if (fromDate || toDate) {
    where.arrivalTime = {
      ...(fromDate ? { gte: new Date(`${fromDate}T00:00:00`) } : {}),
      ...(toDate ? { lte: new Date(`${toDate}T23:59:59`) } : {}),
    };
  }

  // Product Name filter + Dispatch Date filter both live on tables joined to
  // this one (gate-entry items / dispatch items / the linked LoadDispatch's
  // own dispatchDate) — resolve each to a set of matching gate entry ids first,
  // then intersect them (AND) and apply as an `id IN (...)` restriction.
  const idRestrictions: number[][] = [];
  if (product) {
    const [gateItems, dispatchItems] = await Promise.all([
      prisma.vehicleGateEntryItem.findMany({ where: { tenantId: user.tenantId, productName: { contains: product } }, select: { gateEntryId: true } }),
      prisma.loadDispatchItem.findMany({ where: { tenantId: user.tenantId, productName: { contains: product } }, select: { loadDispatchId: true } }),
    ]);
    const dispatchIds = Array.from(new Set(dispatchItems.map((i) => i.loadDispatchId)));
    const dispatchGateIds = dispatchIds.length
      ? (await prisma.loadDispatch.findMany({ where: { id: { in: dispatchIds } }, select: { vehicleGateEntryId: true } })).map((d) => d.vehicleGateEntryId).filter((v): v is number => v != null)
      : [];
    idRestrictions.push(Array.from(new Set([...gateItems.map((i) => i.gateEntryId), ...dispatchGateIds])));
  }
  if (dispatchFromDate || dispatchToDate) {
    const dw: Prisma.LoadDispatchWhereInput = { tenantId: user.tenantId, deletedAt: null, vehicleGateEntryId: { not: null } };
    if (dispatchFromDate || dispatchToDate) {
      dw.dispatchDate = { ...(dispatchFromDate ? { gte: dispatchFromDate } : {}), ...(dispatchToDate ? { lte: dispatchToDate } : {}) };
    }
    const matches = await prisma.loadDispatch.findMany({ where: dw, select: { vehicleGateEntryId: true } });
    idRestrictions.push(Array.from(new Set(matches.map((m) => m.vehicleGateEntryId).filter((v): v is number => v != null))));
  }
  // Stats cards read scope-wide (ignoring the list's own search/status/date
  // filters) — Load & Dispatch Completed / DC Generated / Invoice Posted are
  // derived from each gate entry's most-recent linked Load & Dispatch status,
  // same rule as the per-row Dispatch/DC/Invoice Status columns below. This
  // scope-wide lookup is computed BEFORE the main `rows` query so a DC/Invoice
  // Status filter (below) can also restrict `where.id` before that query runs.
  const allEntries = await prisma.vehicleGateEntry.findMany({ where: { ...sw, deletedAt: null }, select: { id: true } });
  const total = allEntries.length;
  const allIds = allEntries.map((e) => e.id);
  const allDispatchesForStats = allIds.length
    ? await prisma.loadDispatch.findMany({ where: { vehicleGateEntryId: { in: allIds }, deletedAt: null }, orderBy: { id: "desc" }, select: { vehicleGateEntryId: true, status: true } })
    : [];
  const latestStatusByGate = new Map<number, string>();
  for (const d of allDispatchesForStats) if (d.vehicleGateEntryId != null && !latestStatusByGate.has(d.vehicleGateEntryId)) latestStatusByGate.set(d.vehicleGateEntryId, d.status);
  const DISPATCHED_OR_LATER = ["Dispatched", "Delivery Challan Generated", "Sales Invoice Posted"];
  const DC_OR_LATER = ["Delivery Challan Generated", "Sales Invoice Posted"];
  let completed = 0, dcGenerated = 0, invoicePosted = 0;
  for (const st of latestStatusByGate.values()) {
    if (DISPATCHED_OR_LATER.includes(st)) completed++;
    if (DC_OR_LATER.includes(st)) dcGenerated++;
    if (st === "Sales Invoice Posted") invoicePosted++;
  }

  // DC Status / Invoice Status filters — combinable (both ANDed), so picking
  // "Generated" + "NotPosted" together finds exactly "DC generated but
  // invoice not yet posted". Only gate entries that are at least Dispatched
  // have a meaningful DC/Invoice status at all, so anything earlier is excluded
  // the moment either filter is active.
  if (dcStatusFilter !== "All" || invoiceStatusFilter !== "All") {
    const matchIds = allIds.filter((gid) => {
      const st = latestStatusByGate.get(gid);
      if (!st || !DISPATCHED_OR_LATER.includes(st)) return false;
      const dcGeneratedNow = DC_OR_LATER.includes(st);
      const invoicePostedNow = st === "Sales Invoice Posted";
      if (dcStatusFilter === "Generated" && !dcGeneratedNow) return false;
      if (dcStatusFilter === "NotGenerated" && dcGeneratedNow) return false;
      if (invoiceStatusFilter === "Posted" && !invoicePostedNow) return false;
      if (invoiceStatusFilter === "NotPosted" && invoicePostedNow) return false;
      return true;
    });
    idRestrictions.push(matchIds);
  }
  if (idRestrictions.length) {
    let ids = idRestrictions[0];
    for (let i = 1; i < idRestrictions.length; i++) { const s = new Set(idRestrictions[i]); ids = ids.filter((id) => s.has(id)); }
    where.id = { in: ids };
  }

  const [rows, waiting, inside] = await Promise.all([
    prisma.vehicleGateEntry.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.vehicleGateEntry.count({ where: { ...sw, status: "Waiting", deletedAt: null } }),
    prisma.vehicleGateEntry.count({ where: { ...sw, status: "Inside Factory", deletedAt: null } }),
  ]);

  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const driverIds = Array.from(new Set(rows.map((r) => r.driverId).filter((v): v is number => !!v)));
  const companyIds = Array.from(new Set(rows.map((r) => r.transportCompanyId).filter((v): v is number => !!v)));
  const gateEntryIds = rows.map((r) => r.id);
  const [vehicles, drivers, companies, dispatches] = await Promise.all([
    prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }),
    driverIds.length ? prisma.driverMaster.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    companyIds.length ? prisma.transportCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    // The Load & Dispatch linked to this gate entry, once one has been
    // submitted — its own status (Draft→Ready→Loading→Dispatched→Delivery
    // Challan Generated→Sales Invoice Posted) takes over the list's displayed
    // status/action for that row instead of the raw physical gate status.
    gateEntryIds.length ? prisma.loadDispatch.findMany({ where: { vehicleGateEntryId: { in: gateEntryIds }, deletedAt: null }, orderBy: { id: "desc" }, select: { id: true, vehicleGateEntryId: true, status: true, totalQty: true, saleId: true, dispatchDate: true } }) : Promise.resolve([]),
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const dMap = new Map(drivers.map((d) => [d.id, d.name]));
  const cMap = new Map(companies.map((c) => [c.id, c.name]));
  // Most recent dispatch per gate entry (a gate entry could in principle be
  // referenced by more than one, though that's not the normal flow).
  const dispatchMap = new Map<number, { id: number; status: string; totalQty: Prisma.Decimal; saleId: number | null; dispatchDate: string }>();
  for (const d of dispatches) if (d.vehicleGateEntryId != null && !dispatchMap.has(d.vehicleGateEntryId)) dispatchMap.set(d.vehicleGateEntryId, { id: d.id, status: d.status, totalQty: d.totalQty, saleId: d.saleId, dispatchDate: d.dispatchDate });

  const dispatchIds = dispatches.map((d) => d.id);
  const saleIds = Array.from(new Set(dispatches.map((d) => d.saleId).filter((v): v is number => !!v)));
  const [itemAgg, sales, dispatchItemNames, gateItemNames, preWs, postWs] = await Promise.all([
    dispatchIds.length ? prisma.loadDispatchItem.groupBy({ by: ["loadDispatchId"], where: { loadDispatchId: { in: dispatchIds }, deletedAt: null }, _sum: { taxableValue: true, taxAmount: true } }) : Promise.resolve([]),
    saleIds.length ? prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, invoiceNo: true, paymentStatus: true, paymentMode: true, total: true, amountPaid: true } }) : Promise.resolve([]),
    // Product names shown on the row's hover/expand detail panel — from the
    // linked dispatch's own items once one exists, else from what was
    // captured directly on the gate entry (Item Details, optional at gate time).
    dispatchIds.length ? prisma.loadDispatchItem.findMany({ where: { loadDispatchId: { in: dispatchIds }, deletedAt: null }, select: { loadDispatchId: true, productName: true } }) : Promise.resolve([]),
    gateEntryIds.length ? prisma.vehicleGateEntryItem.findMany({ where: { gateEntryId: { in: gateEntryIds } }, select: { gateEntryId: true, productName: true } }) : Promise.resolve([]),
    // Pre/Post-Loading Weighment — shown on the hover/expand detail panel only
    // (removed as its own columns per an earlier decluttering request).
    gateEntryIds.length ? prisma.preLoadingWeighment.findMany({ where: { gateEntryId: { in: gateEntryIds } }, orderBy: { id: "desc" }, select: { gateEntryId: true, tareWeight: true } }) : Promise.resolve([]),
    gateEntryIds.length ? prisma.postLoadingWeighment.findMany({ where: { gateEntryId: { in: gateEntryIds } }, select: { gateEntryId: true, grossWeight: true, netWeight: true } }) : Promise.resolve([]),
  ]);
  const totalValueByDispatch = new Map(itemAgg.map((a) => [a.loadDispatchId, Number(a._sum.taxableValue ?? 0) + Number(a._sum.taxAmount ?? 0)]));
  const saleMap = new Map(sales.map((s) => [s.id, s]));
  const dispatchNamesMap = new Map<number, string[]>();
  for (const it of dispatchItemNames) { const arr = dispatchNamesMap.get(it.loadDispatchId) ?? []; arr.push(it.productName); dispatchNamesMap.set(it.loadDispatchId, arr); }
  const gateNamesMap = new Map<number, string[]>();
  for (const it of gateItemNames) { const arr = gateNamesMap.get(it.gateEntryId) ?? []; arr.push(it.productName); gateNamesMap.set(it.gateEntryId, arr); }
  const preMap = new Map<number, number>();
  for (const w of preWs) if (!preMap.has(w.gateEntryId)) preMap.set(w.gateEntryId, Number(w.tareWeight));
  const postMap = new Map(postWs.map((w) => [w.gateEntryId, { gross: Number(w.grossWeight), net: Number(w.netWeight) }]));

  const shaped = rows.map((r) => {
    const dispatch = dispatchMap.get(r.id);
    const sale = dispatch?.saleId ? saleMap.get(dispatch.saleId) : undefined;
    return {
      id: r.id, gateEntryNo: r.gateEntryNo, vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—",
      // Prefer the actual driver captured at the gate (may differ from any planned driver) —
      // fall back to the linked Driver Master record if no freeform capture was made.
      driverId: r.driverId, driverName: r.driverName || (r.driverId ? (dMap.get(r.driverId) ?? null) : null),
      driverMobile: r.driverMobile, driverLicenseNo: r.driverLicenseNo,
      transportCompanyId: r.transportCompanyId, transportCompanyName: r.transportCompanyId ? (cMap.get(r.transportCompanyId) ?? "—") : null,
      dispatchPlanningId: r.dispatchPlanningId, dispatchExecutionId: r.dispatchExecutionId,
      dispatchType: r.dispatchType, referenceNo: r.referenceNo, customerName: r.customerName,
      vehicleType: r.vehicleType, transportMode: r.transportMode,
      arrivalTime: r.arrivalTime ? r.arrivalTime.toISOString() : null,
      securityOfficer: r.securityOfficer, remarks: r.remarks, status: r.status,
      loadDispatchId: dispatch?.id ?? null, loadDispatchStatus: dispatch?.status ?? null,
      dispatchDate: dispatch?.dispatchDate ?? null,
      totalQty: dispatch ? Number(dispatch.totalQty) : null,
      totalValue: dispatch ? (totalValueByDispatch.get(dispatch.id) ?? 0) : null,
      invoiceNo: sale?.invoiceNo ?? null, paymentStatus: sale?.paymentStatus ?? null,
      productName: (dispatch ? dispatchNamesMap.get(dispatch.id) : gateNamesMap.get(r.id))?.join(", ") || null,
      preLoadWeight: preMap.get(r.id) ?? null, postLoadWeight: postMap.get(r.id)?.gross ?? null, netWeight: postMap.get(r.id)?.net ?? null,
      saleType: sale?.paymentMode ?? null, saleOutstanding: sale ? Number(sale.total) - Number(sale.amountPaid) : null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ ok: true, rows: shaped, stats: { total, waiting, inside, completed, dcGenerated, invoicePosted } });
}

// POST /api/transport/gate-entry — create a gate entry (status starts "Waiting").
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleGateEntry" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = gateEntryInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid gate entry." }, { status: 422 });
  const input = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: input.vehicleId, tenantId: user.tenantId }, select: { id: true } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Selected vehicle was not found in your catalog." }, { status: 422 });

  // A gate entry may reference an approved Dispatch Planning; anything still in
  // Draft (not yet approved) or Cancelled cannot start the physical vehicle flow.
  if (input.dispatchPlanningId) {
    const plan = await prisma.dispatchPlanning.findFirst({ where: { id: input.dispatchPlanningId, tenantId: user.tenantId }, select: { id: true, status: true, planningNo: true } });
    if (!plan) return NextResponse.json({ ok: false, message: "Linked Dispatch Planning was not found." }, { status: 422 });
    if (plan.status === "Draft" || plan.status === "Cancelled") {
      return NextResponse.json({ ok: false, message: `Dispatch Planning ${plan.planningNo} is ${plan.status} — it must be Approved (or further along) before a gate entry can be raised.` }, { status: 422 });
    }
  }

  const scope = await getActiveScope(user);

  // Location auto-populates from the logged-in user's active branch — never
  // client-trusted. Reference Document details (customer/delivery address,
  // source/destination warehouse) are similarly re-resolved from the
  // authoritative Sales Order / Transfer Request record, ignoring whatever the
  // client may have echoed back, so the ERP "automatically loads these
  // details" as specified rather than trusting client input for them.
  let location: string | null = null;
  if (scope.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: scope.branchId, tenantId: user.tenantId }, select: { name: true } });
    location = branch?.name ?? null;
  }

  let referenceNo = input.referenceNo ?? null;
  let customerName: string | null = null;
  let deliveryAddress: string | null = input.deliveryAddress ?? null;
  if (input.referenceType === "Sales Order" && input.salesOrderId) {
    const so = await prisma.salesDocument.findFirst({ where: { id: input.salesOrderId, tenantId: user.tenantId, docType: "order" }, select: { docNo: true, customerName: true, deliveryAddress: true } });
    if (!so) return NextResponse.json({ ok: false, message: "Selected Sales Order was not found." }, { status: 422 });
    referenceNo = so.docNo;
    customerName = so.customerName;
    deliveryAddress = so.deliveryAddress;
  } else if (input.customerId) {
    // Direct Customer Dispatch — no source doc to derive from; the customer
    // NAME is still re-resolved from the Customer Master (not client-trusted),
    // but deliveryAddress is legitimately free text here.
    const cust = await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: user.tenantId }, select: { name: true } });
    if (!cust) return NextResponse.json({ ok: false, message: "Selected customer was not found." }, { status: 422 });
    customerName = cust.name;
  }

  // Gate Entry No is user-enterable — if given, it must be unique for this
  // tenant; if left blank, one is auto-generated (GATE-#####) as before.
  if (input.gateEntryNo) {
    const dupe = await prisma.vehicleGateEntry.findFirst({ where: { tenantId: user.tenantId, gateEntryNo: input.gateEntryNo, deletedAt: null }, select: { id: true } });
    if (dupe) return NextResponse.json({ ok: false, message: `Gate Entry No "${input.gateEntryNo}" is already in use.` }, { status: 409 });
  }

  let sourceWarehouse: string | null = null;
  let destinationWarehouse: string | null = null;
  if (input.dispatchType === "StockTransfer" && input.transferRequestId) {
    const str = await prisma.stockTransferRequest.findFirst({ where: { id: input.transferRequestId, tenantId: user.tenantId }, select: { requestNo: true, sourceWarehouse: true, destinationWarehouse: true } });
    if (!str) return NextResponse.json({ ok: false, message: "Selected Transfer Request was not found." }, { status: 422 });
    referenceNo = str.requestNo;
    sourceWarehouse = str.sourceWarehouse;
    destinationWarehouse = str.destinationWarehouse;
  }

  const dispatchCfg = await getDispatchConfig(user);
  const gateEntryPrefix = dispatchCfg.fields.gateEntryPrefix?.trim() || "GATE";

  const items = (input.items ?? []).filter((i) => i.qty > 0);
  const products = items.length
    ? await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) }, tenantId: user.tenantId }, select: { id: true, name: true, sku: true, baseUom: true } })
    : [];
  const productById = new Map(products.map((p) => [p.id, p]));
  if (items.length && products.length !== new Set(items.map((i) => i.productId)).size) {
    return NextResponse.json({ ok: false, message: "One or more items are not in your catalog." }, { status: 422 });
  }

  try {
    // maxWait/timeout: create + item createMany + movement-history create is
    // several sequential round trips against the remote RDS instance — the
    // 5s Prisma default was too tight here too (same P2028 pattern already
    // fixed for Opening Stock / Load & Dispatch elsewhere this session).
    const id = await prisma.$transaction(async (tx) => {
      const entry = await tx.vehicleGateEntry.create({
        data: {
          tenantId: user.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
          gateEntryNo: input.gateEntryNo || "TMP", vehicleId: input.vehicleId, driverId: input.driverId ?? undefined,
          transportCompanyId: input.transportCompanyId ?? undefined, dispatchPlanningId: input.dispatchPlanningId ?? undefined,
          dispatchExecutionId: input.dispatchExecutionId ?? undefined, dispatchType: input.dispatchType ?? undefined,
          referenceNo: referenceNo ?? undefined, arrivalTime: input.arrivalTime ? new Date(input.arrivalTime) : new Date(),
          securityOfficer: input.securityOfficer ?? undefined, remarks: input.remarks ?? undefined,
          gate: input.gate ?? undefined, location: location ?? undefined,
          referenceType: input.referenceType ?? undefined, salesOrderId: input.salesOrderId ?? undefined,
          customerName: customerName ?? undefined, deliveryAddress: deliveryAddress ?? undefined,
          transferRequestId: input.transferRequestId ?? undefined,
          sourceWarehouse: sourceWarehouse ?? undefined, destinationWarehouse: destinationWarehouse ?? undefined,
          transportMode: input.transportMode ?? undefined, vehicleType: input.vehicleType ?? undefined,
          trailerNumber: input.trailerNumber ?? undefined, containerNumber: input.containerNumber ?? undefined,
          driverName: input.driverName ?? undefined, driverMobile: input.driverMobile ?? undefined,
          driverLicenseNo: input.driverLicenseNo ?? undefined, helperName: input.helperName ?? undefined,
          helperMobile: input.helperMobile ?? undefined,
          vehicleCapacity: input.vehicleCapacity ?? undefined, expectedLoadWeight: input.expectedLoadWeight ?? undefined,
          gpsAvailable: input.gpsAvailable ?? false, sealNumber: input.sealNumber ?? undefined,
          purpose: input.purpose ?? undefined, expectedExitTime: input.expectedExitTime ? new Date(input.expectedExitTime) : undefined,
          loadingBayId: input.loadingBayId ?? undefined,
          createdBy: user.id,
        },
        select: { id: true },
      });
      const gateEntryNo = input.gateEntryNo || `${gateEntryPrefix}-${String(entry.id).padStart(5, "0")}`;
      if (!input.gateEntryNo) await tx.vehicleGateEntry.update({ where: { id: entry.id }, data: { gateEntryNo } });
      if (items.length) {
        await tx.vehicleGateEntryItem.createMany({
          data: items.map((i) => {
            const p = productById.get(i.productId);
            return { tenantId: user.tenantId, gateEntryId: entry.id, productId: i.productId, productName: i.productName || p?.name || "", sku: i.sku ?? p?.sku ?? undefined, uom: i.uom ?? p?.baseUom ?? undefined, qty: i.qty, remarks: i.remarks ?? undefined };
          }),
        });
      }
      await tx.vehicleMovementHistory.create({
        data: {
          tenantId: user.tenantId, businessId: scope.businessId ?? undefined, branchId: scope.branchId ?? undefined,
          vehicleId: input.vehicleId, dispatchExecutionId: input.dispatchExecutionId ?? undefined, gateEntryId: entry.id,
          eventType: "GateIn", eventAt: new Date(), actorUserId: user.id, actorName: user.fullName ?? null,
          remarks: `Gate entry ${gateEntryNo} recorded`,
        },
      });
      return entry.id;
    }, { maxWait: 10_000, timeout: 30_000 });
    await writeAudit(prisma, user, { action: "vehicle_gate_entry.create", entity: "VehicleGateEntry", entityId: id, summary: `Vehicle gate entry created for vehicle #${input.vehicleId}`, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Gate entry recorded.", id }, { status: 201 });
  } catch (err) {
    console.error("[transport/gate-entry] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the gate entry." }, { status: 500 });
  }
}
