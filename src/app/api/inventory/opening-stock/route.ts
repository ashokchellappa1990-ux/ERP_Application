import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { buildDocPayload, recomputeProductStock, autoPostNonQrLines } from "@/lib/inventory/openingStock";
import { validateBatchTracking } from "@/lib/grn/grnPayload";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn, terminalListWhere } from "@/lib/pos/terminalGuard";
import type { OpeningStockRow, OpeningStockListStats, OpeningStockStatus } from "@/lib/contracts/openingStock";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const PERM = "masters.opening-stock";

// GET /api/inventory/opening-stock — list documents + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const tw = await terminalListWhere(user, url.searchParams.get("terminalId"));
  const where: Prisma.OpeningStockWhereInput = { ...sw, ...tw };
  if (q) where.OR = [{ docNo: { contains: q } }, { warehouse: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, draft, submitted, agg] = await Promise.all([
    prisma.openingStock.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.openingStock.count({ where: sw }),
    prisma.openingStock.count({ where: { ...sw, status: "Draft" } }),
    prisma.openingStock.count({ where: { ...sw, status: "Submitted" } }),
    prisma.openingStock.aggregate({ where: sw, _sum: { totalValue: true, totalQty: true } }),
  ]);

  const shaped: OpeningStockRow[] = rows.map((d) => ({
    id: d.id, docNo: d.docNo, asOnDate: d.asOnDate, warehouse: d.warehouse ?? "",
    status: d.status as OpeningStockStatus, lineCount: d.lineCount, totalQty: num(d.totalQty), totalValue: num(d.totalValue),
    createdAt: d.createdAt.toISOString(),
  }));
  const stats: OpeningStockListStats = {
    total, draft, submitted,
    totalValue: num(agg._sum.totalValue), totalQty: num(agg._sum.totalQty),
  };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/inventory/opening-stock — create a document (Draft or Submitted).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "OpeningStock" });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const built = buildDocPayload(body);
  if ("error" in built) return NextResponse.json({ ok: false, message: built.error }, { status: 422 });
  const { header, lines, submit, productIds } = built;

  // All referenced products must belong to this tenant.
  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId }, select: { id: true, invBatch: true, invMfg: true, invExpiry: true } });
  if (prods.length !== productIds.length) return NextResponse.json({ ok: false, message: "One or more products are not in your catalog." }, { status: 422 });
  // Batch-tracked products must carry batch / mfg / expiry on every opening line.
  const trackErr = validateBatchTracking(lines, new Map(prods.map((p) => [p.id, { invBatch: p.invBatch, invMfg: p.invMfg, invExpiry: p.invExpiry }])));
  if (trackErr) return NextResponse.json({ ok: false, message: trackErr }, { status: 422 });

  const seg = await resolveWriteScope(user, (body as { scopeBranchId?: number | "all" }).scopeBranchId); // chosen branch
  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { label: "opening stock" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx);
  try {
    // maxWait/timeout: submitting posts a ledger movement + lot per line
    // sequentially against a remote RDS instance — the 5s Prisma default was
    // intermittently too tight and failed with P2028 (expired transaction).
    const docId = await prisma.$transaction(async (tx) => {
      const doc = await tx.openingStock.create({
        data: { ...header, tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined, docNo: "TMP", createdBy: user.id, ...stamp, lines: { create: lines } },
        select: { id: true },
      });
      const docNo = `OPN-${String(doc.id).padStart(5, "0")}`;
      await tx.openingStock.update({ where: { id: doc.id }, data: { docNo } });
      if (submit) {
        await recomputeProductStock(tx, productIds);
        await autoPostNonQrLines(tx, { tenantId: user.tenantId, userId: user.id, docId: doc.id, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, warehouse: header.warehouse, asOnDate: header.asOnDate, docNo });
      }
      return doc.id;
    }, { maxWait: 10_000, timeout: 30_000 });
    await writeAudit(prisma, user, {
      action: submit ? "opening_stock.submit" : "opening_stock.create", entity: "OpeningStock", entityId: docId,
      summary: `${submit ? "Submitted" : "Drafted"} opening stock — ${header.totalQty} qty, ${header.totalValue.toFixed(2)}`,
      meta: { submitted: submit, lineCount: lines.length, totalQty: header.totalQty, totalValue: header.totalValue },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: submit ? "Opening stock submitted." : "Draft saved.", id: docId }, { status: 201 });
  } catch (err) {
    console.error("[opening-stock] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save opening stock." }, { status: 500 });
  }
}
