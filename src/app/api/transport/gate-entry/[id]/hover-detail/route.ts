import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "transport.gate-entry";

// GET /api/transport/gate-entry/[id]/hover-detail — the handful of fields only
// shown in the list's hover popover / accordion (product name(s), pre/post
// weighment) for ONE gate entry. Split out of the main list route (which used
// to fetch this for every row on every page load, whether or not anyone ever
// hovered it) so the list itself does 4 fewer queries per load — this data is
// now fetched lazily, only for the row the user actually hovers/expands.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const id = Number(params.id);
  const entry = await prisma.vehicleGateEntry.findFirst({ where: { ...sw, id, deletedAt: null }, select: { id: true, entryType: true, grnId: true } });
  if (!entry) return NextResponse.json({ ok: false, message: "Gate entry not found." }, { status: 404 });

  if (entry.entryType === "RawMaterial") {
    const grn = entry.grnId
      ? await prisma.goodsReceiptNote.findFirst({ where: { id: entry.grnId }, select: { tareWeight: true, grossWeight: true, netWeight: true, purchaseInvoiceId: true } })
      : null;
    const pi = grn?.purchaseInvoiceId
      ? await prisma.purchaseInvoice.findFirst({ where: { id: grn.purchaseInvoiceId }, select: { supplierInvoiceNo: true, supplierInvoiceDate: true, poNo: true, supplierRef: true } })
      : null;
    const items = await prisma.vehicleGateEntryItem.findMany({ where: { gateEntryId: id }, select: { productName: true } });
    return NextResponse.json({
      ok: true,
      data: {
        productName: items.map((i) => i.productName).join(", ") || null,
        preLoadWeight: null, postLoadWeight: null,
        grossWeight: grn?.grossWeight != null ? Number(grn.grossWeight) : null,
        tareWeight: grn?.tareWeight != null ? Number(grn.tareWeight) : null,
        netWeight: grn?.netWeight != null ? Number(grn.netWeight) : null,
        invoiceNo: pi?.supplierInvoiceNo ?? null, invoiceDate: pi?.supplierInvoiceDate ?? null,
        poNo: pi?.poNo ?? null, docRefNo: pi?.supplierRef ?? null,
      },
    });
  }

  const dispatch = await prisma.loadDispatch.findFirst({ where: { vehicleGateEntryId: id, deletedAt: null }, orderBy: { id: "desc" }, select: { id: true } });

  const [names, preWt, postWt] = await Promise.all([
    dispatch
      ? prisma.loadDispatchItem.findMany({ where: { loadDispatchId: dispatch.id, deletedAt: null }, select: { productName: true } })
      : prisma.vehicleGateEntryItem.findMany({ where: { gateEntryId: id }, select: { productName: true } }),
    prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: id }, orderBy: { id: "desc" }, select: { tareWeight: true } }),
    prisma.postLoadingWeighment.findFirst({ where: { gateEntryId: id }, select: { grossWeight: true, netWeight: true } }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      productName: names.map((n) => n.productName).join(", ") || null,
      preLoadWeight: preWt ? Number(preWt.tareWeight) : null,
      postLoadWeight: postWt ? Number(postWt.grossWeight) : null,
      netWeight: postWt ? Number(postWt.netWeight) : null,
      grossWeight: null, tareWeight: null, invoiceNo: null, invoiceDate: null, poNo: null, docRefNo: null,
    },
  });
}
