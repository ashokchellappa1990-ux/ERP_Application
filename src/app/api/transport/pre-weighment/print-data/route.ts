import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { TokenSlipData } from "@/lib/print/tokenSlipHtml";

const PERM = "transport.pre-weighment";
const fmtDateTime = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).replace(",", "");

// GET /api/transport/pre-weighment/print-data?id=<weighmentId> | ?gateEntryId=<gateEntryId>
// Assembles the Gate Token (Pre Load Weight Slip) for one Pre-Loading
// Weighment — reachable either by the weighment's own id (the weighment
// list / post-submit "Preview & Print" hand-off) or by its gate entry id
// (Load & Dispatch view's "Print Token" button only knows the gate entry).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const gateEntryId = url.searchParams.get("gateEntryId");
  if (!id && !gateEntryId) return NextResponse.json({ ok: false, message: "id or gateEntryId is required." }, { status: 400 });

  const wt = id
    ? await prisma.preLoadingWeighment.findFirst({ where: { id: Number(id), tenantId: user.tenantId } })
    : await prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: Number(gateEntryId), tenantId: user.tenantId }, orderBy: { id: "desc" } });
  if (!wt) return NextResponse.json({ ok: false, message: "Pre-loading weighment not found." }, { status: 404 });

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const gateEntry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id: wt.gateEntryId, deletedAt: null } });
  if (!gateEntry) return NextResponse.json({ ok: false, message: "Linked gate entry not found." }, { status: 404 });

  const [vehicle, setup, tenant, dispatch] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: gateEntry.vehicleId }, select: { vehicleNo: true } }),
    prisma.companySetup.findFirst({ where: { tenantId: user.tenantId, NOT: { companyName: null } }, orderBy: { updatedAt: "desc" }, select: { companyName: true } }),
    prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
    prisma.loadDispatch.findFirst({ where: { vehicleGateEntryId: gateEntry.id, deletedAt: null }, orderBy: { id: "desc" }, select: { dispatchNo: true, paymentMode: true, items: { orderBy: { id: "asc" }, take: 1, select: { productName: true } } } }),
  ]);

  const tokenSlip: TokenSlipData = {
    business: { name: setup?.companyName || tenant?.name || "My Store" },
    tokenNo: wt.weighmentNo,
    productName: dispatch?.items[0]?.productName || "",
    refNo: gateEntry.referenceNo || dispatch?.dispatchNo || "",
    date: wt.weighDate || fmtDateTime(wt.createdAt),
    inTime: gateEntry.arrivalTime ? fmtDateTime(gateEntry.arrivalTime) : null,
    customerName: gateEntry.customerName || "",
    vehicleNumber: vehicle?.vehicleNo ?? null,
    emptyWeightKg: Number(wt.tareWeight),
    // No Sale/Load & Dispatch payment intent usually exists yet at gate-token
    // time — use it if one's already linked, otherwise leave a plain dash
    // rather than fabricating a payment mode nothing has actually decided.
    payment: dispatch?.paymentMode === "Full" ? "Paid" : (dispatch?.paymentMode || "—"),
    delivery: gateEntry.deliveryAddress || gateEntry.destinationWarehouse || null,
  };

  return NextResponse.json({ ok: true, tokenSlip });
}
