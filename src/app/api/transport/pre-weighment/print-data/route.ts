import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
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

  // Lazily mint the public-page link token the first time this entry's
  // token slip is printed — reused on every reprint so the QR never changes
  // underneath an already-printed physical slip.
  //
  // This has to be race-safe: React StrictMode (dev) double-fires effects,
  // and a user can also just open the preview twice — two concurrent
  // requests could otherwise both see publicToken as null, each mint a
  // *different* random token, and only one write wins, leaving the other
  // request (and whatever it renders/prints) holding an orphaned token that
  // was never actually persisted. The conditional updateMany below only
  // writes when the column is still null; if it reports 0 rows affected,
  // someone else already won the race, so re-read and use THAT value
  // instead of the one generated locally.
  let publicToken = gateEntry.publicToken;
  if (!publicToken) {
    const candidate = randomBytes(48).toString("hex");
    const result = await prisma.vehicleGateEntry.updateMany({ where: { id: gateEntry.id, publicToken: null }, data: { publicToken: candidate } });
    if (result.count > 0) {
      publicToken = candidate;
    } else {
      const winner = await prisma.vehicleGateEntry.findUnique({ where: { id: gateEntry.id }, select: { publicToken: true } });
      publicToken = winner?.publicToken ?? candidate;
    }
  }

  const [vehicle, setup, tenant, dispatch, gateEntryItem] = await Promise.all([
    prisma.vehicleMaster.findFirst({ where: { id: gateEntry.vehicleId }, select: { vehicleNo: true } }),
    prisma.companySetup.findFirst({ where: { tenantId: user.tenantId, NOT: { companyName: null } }, orderBy: { updatedAt: "desc" }, select: { companyName: true } }),
    prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
    prisma.loadDispatch.findFirst({ where: { vehicleGateEntryId: gateEntry.id, deletedAt: null }, orderBy: { id: "desc" }, select: { dispatchNo: true, paymentMode: true, items: { orderBy: { id: "asc" }, take: 1, select: { productName: true } } } }),
    // Falls back to the gate entry's own Item Details (captured at the gate,
    // before any dispatch/invoice exists) when there's no linked dispatch yet.
    prisma.vehicleGateEntryItem.findFirst({ where: { gateEntryId: gateEntry.id }, orderBy: { id: "asc" }, select: { productName: true } }),
  ]);

  const tokenSlip: TokenSlipData = {
    business: { name: setup?.companyName || tenant?.name || "My Store" },
    tokenNo: wt.weighmentNo,
    gateEntryNo: gateEntry.gateEntryNo,
    publicToken,
    productName: dispatch?.items[0]?.productName || gateEntryItem?.productName || "",
    refNo: gateEntry.referenceNo || dispatch?.dispatchNo || "",
    // A plain parseable date (not the localized fmtDateTime string used for
    // inTime below) — tokenSlipHtml's fmtSlipDate() re-renders this as the
    // slip's own fixed DD-MMM-YYYY format.
    date: wt.weighDate || wt.createdAt.toISOString().slice(0, 10),
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
