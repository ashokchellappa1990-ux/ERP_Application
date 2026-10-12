import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { selectPrintCodes } from "@/lib/qr/print";
import { OpeningStockPrintSchema, type OpeningStockPrintResponse } from "@/lib/contracts/openingStock";

// POST /api/inventory/opening-stock/[id]/qr/print — record a (partial) print run
// and return the exact codes to print. Body: { lineId, count }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const docId = Number(params.id);
  const denied = await requirePermission(user, "masters.opening-stock", { req, entity: "OpeningStock", entityId: docId });
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }
  const parsed = OpeningStockPrintSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const lineId = body.lineId;
  const line = await prisma.openingStockLine.findFirst({
    where: { id: lineId, openingStockId: docId, document: { tenantId: user.tenantId } },
    include: { document: { select: { docNo: true, businessId: true, branchId: true } } },
  });
  if (!line) return NextResponse.json({ ok: false, message: "Line not found." }, { status: 404 });
  const mappings = await prisma.qrCodeMapping.findMany({ where: { sourceType: "OPENING", sourceId: lineId }, orderBy: { seq: "asc" } });
  if (line.qrStatus !== "Generated" || mappings.length === 0) {
    return NextResponse.json({ ok: false, message: "Generate the QR codes for this line first." }, { status: 422 });
  }

  const { codes, touched, count } = selectPrintCodes(mappings, line.qrMode, line.printedQty, body.count ?? 0);
  await prisma.$transaction([
    ...touched.map((t) => prisma.qrCodeMapping.update({ where: { id: t.id }, data: { printed: true, printedCount: { increment: t.by } } })),
    prisma.openingStockLine.update({ where: { id: lineId }, data: { printedQty: { increment: count } } }),
  ]);
  await writeAudit(prisma, user, {
    action: "opening_stock.qr_print", entity: "OpeningStock", entityId: docId,
    summary: `Printed ${codes.length} QR label(s) for ${line.productName}`,
    meta: { lineId, count, sku: line.sku, docNo: line.document.docNo },
    businessId: line.document.businessId, branchId: line.document.branchId, ip: requestMeta(req).ip,
  });

  const res: OpeningStockPrintResponse = {
    ok: true,
    message: `Printing ${codes.length} label(s).`,
    codes,
    line: { name: line.productName, sku: line.sku ?? "", mrp: line.mrp != null ? Number(line.mrp) : null },
  };
  return NextResponse.json(res);
}
