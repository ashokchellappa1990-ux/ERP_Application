import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { prepareSale, createSaleTx } from "@/lib/sales/createSale";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn, terminalListWhere } from "@/lib/pos/terminalGuard";
import { SaleCreateSchema, type SaleRow, type SaleListStats } from "@/lib/contracts/sale";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const PERM = "sales.pos";

// GET /api/sales — recent sales + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const seg = scopeWhere(await getActiveScope(user), { branch: true });
  const tw = await terminalListWhere(user, url.searchParams.get("terminalId"));
  const where: Prisma.SaleWhereInput = { ...seg, ...tw };
  if (q) where.OR = [{ invoiceNo: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }];
  if (from || to) where.saleDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const today = new Date().toISOString().slice(0, 10);
  const [rows, todayAgg, todayCount] = await Promise.all([
    prisma.sale.findMany({ where, orderBy: { id: "desc" }, take: 50 }),
    prisma.sale.aggregate({ where: { ...seg, saleDate: today, status: "Completed" }, _sum: { total: true } }),
    prisma.sale.count({ where: { ...seg, saleDate: today, status: "Completed" } }),
  ]);

  const shaped: SaleRow[] = rows.map((s) => ({
    id: s.id, invoiceNo: s.invoiceNo, saleDate: s.saleDate, customerName: s.customerName ?? "Walk-in", customerPhone: s.customerPhone ?? "",
    itemCount: s.itemCount, total: num(s.total), paymentMode: s.paymentMode ?? "", paymentStatus: s.paymentStatus, status: s.status, createdAt: s.createdAt.toISOString(),
  }));
  const stats: SaleListStats = { todaySales: num(todayAgg._sum.total), todayBills: todayCount };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/sales — create a completed POS sale (posts inventory OUT + payments).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Sale" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SaleCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });

  // Validate + compute the sale (catalog, tax method, line math, QR single-use).
  const prepared = await prepareSale(user, parsed.data);
  if ("error" in prepared) return NextResponse.json({ ok: false, message: prepared.error }, { status: 422 });

  // A sale happens at the active branch (transactions are single-branch).
  const seg = scopeData(await getActiveScope(user), { branch: true });
  // POS terminal / shift / session traceability + enforcement.
  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { feature: "allowB2c", label: "B2C sale" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx, "WEB_POS");
  try {
    const result = await prisma.$transaction((tx) => createSaleTx(tx, prepared, { user, seg, stamp }));
    await writeAudit(prisma, user, {
      action: "sale.create", entity: "Sale", entityId: result.id,
      summary: `Sale ${result.invoiceNo} — ${prepared.total.toFixed(2)} (${prepared.paymentStatus})`,
      meta: { invoiceNo: result.invoiceNo, total: prepared.total, amountPaid: prepared.amountPaid, paymentStatus: prepared.paymentStatus, paymentMode: prepared.paymentMode, itemCount: prepared.itemCount, customerId: prepared.customerId },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Sale completed.", id: result.id, invoiceNo: result.invoiceNo, changeDue: result.changeDue }, { status: 201 });
  } catch (err) {
    console.error("[sales] create error", err);
    return NextResponse.json({ ok: false, message: "Could not complete the sale." }, { status: 500 });
  }
}
