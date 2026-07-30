import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { selectPrintCodes } from "@/lib/qr/print";
import { GrnPrintSchema, type GrnPrintResponse } from "@/lib/contracts/grn";

// POST /api/purchase/grn/[id]/qr/print — record a (partial) print run, return codes.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "purchase.grn");
  if (denied) return denied;

  const grnId = Number(params.id);
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = GrnPrintSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const lineId = body.lineId;
  const line = await prisma.goodsReceiptLine.findFirst({ where: { id: lineId, grnId, grn: { tenantId: user.tenantId } } });
  if (!line) return NextResponse.json({ ok: false, message: "Line not found." }, { status: 404 });
  const mappings = await prisma.qrCodeMapping.findMany({ where: { sourceType: "GRN", sourceId: lineId }, orderBy: { seq: "asc" } });
  if (line.qrStatus !== "Generated" || mappings.length === 0) {
    return NextResponse.json({ ok: false, message: "This line has no generated QR codes." }, { status: 422 });
  }

  const { codes, touched, count } = selectPrintCodes(mappings, line.qrMode, line.printedQty, body.count ?? 0);
  await prisma.$transaction([
    ...touched.map((t) => prisma.qrCodeMapping.update({ where: { id: t.id }, data: { printed: true, printedCount: { increment: t.by } } })),
    prisma.goodsReceiptLine.update({ where: { id: lineId }, data: { printedQty: { increment: count } } }),
  ]);

  const res: GrnPrintResponse = {
    ok: true,
    message: `Printing ${codes.length} label(s).`,
    codes,
    line: { name: line.productName, sku: line.sku ?? "", mrp: line.mrp != null ? Number(line.mrp) : null },
  };
  return NextResponse.json(res);
}
