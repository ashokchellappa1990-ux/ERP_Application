import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { postJournal } from "@/lib/accounting/post";
import type { JournalRow, JournalStats } from "@/lib/contracts/finance";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const PERM = "finance.journal";

const JournalLineSchema = z.object({
  code: z.string().min(1),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  narration: z.string().optional(),
});
const JournalCreateSchema = z.object({
  date: z.string().optional(),
  narration: z.string().optional(),
  refNo: z.string().optional(),
  costCenterId: z.coerce.number().int().nullish(),
  profitCenterId: z.coerce.number().int().nullish(),
  department: z.string().optional(),
  project: z.string().optional(),
  lines: z.array(JournalLineSchema).default([]),
});

// GET /api/finance/journal — list double-entry vouchers (newest first) with lines.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const type = (url.searchParams.get("type") ?? "All").trim();
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();

  const where: Prisma.JournalEntryWhereInput = scopeWhere(await getActiveScope(user), { branch: true });
  if (type !== "All") where.voucherType = type;
  if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (q) where.OR = [{ voucherNo: { contains: q } }, { refNo: { contains: q } }, { narration: { contains: q } }];

  const [entries, agg] = await Promise.all([
    prisma.journalEntry.findMany({
      where, orderBy: [{ date: "desc" }, { id: "desc" }], take: 200,
      include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    }),
    prisma.journalEntry.aggregate({ where: { tenantId: user.tenantId, status: "Posted" }, _sum: { totalDebit: true } }),
  ]);

  const rows: JournalRow[] = entries.map((e) => ({
    id: e.id, voucherNo: e.voucherNo, voucherType: e.voucherType, date: e.date, narration: e.narration ?? "",
    refNo: e.refNo ?? "", sourceType: e.sourceType ?? "", status: e.status,
    totalDebit: num(e.totalDebit), totalCredit: num(e.totalCredit),
    lines: e.lines.map((l) => ({ code: l.account.code, account: l.account.name, debit: num(l.debit), credit: num(l.credit), narration: l.narration ?? "" })),
  }));
  const stats: JournalStats = { vouchers: entries.length, totalPosted: num(agg._sum.totalDebit) };
  return NextResponse.json({ ok: true, rows, stats });
}

// POST /api/finance/journal — enter & post a MANUAL journal voucher (double-entry).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "JournalEntry" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = JournalCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  // One side per line; keep only lines that carry an amount.
  const lines = b.lines
    .map((l) => ({ code: l.code.trim(), debit: r2(l.debit), credit: r2(l.credit), narration: l.narration?.trim() || null }))
    .filter((l) => l.code && (l.debit > 0 || l.credit > 0));
  if (lines.length < 2) return NextResponse.json({ ok: false, message: "Add at least two account lines with amounts." }, { status: 422 });
  for (const l of lines) {
    if (l.debit > 0 && l.credit > 0) return NextResponse.json({ ok: false, message: `Line ${l.code}: enter either a debit or a credit, not both.` }, { status: 422 });
  }
  const totalDebit = r2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = r2(lines.reduce((s, l) => s + l.credit, 0));
  if (totalDebit <= 0) return NextResponse.json({ ok: false, message: "The voucher has no amounts." }, { status: 422 });
  if (Math.abs(totalDebit - totalCredit) > 0.01) return NextResponse.json({ ok: false, message: `Voucher is not balanced — debit ${totalDebit} ≠ credit ${totalCredit}.` }, { status: 422 });

  // Every code must be a real ledger account for this tenant.
  const codes = [...new Set(lines.map((l) => l.code))];
  const accounts = await prisma.ledgerAccount.findMany({ where: { tenantId: user.tenantId, code: { in: codes } }, select: { code: true } });
  const known = new Set(accounts.map((a) => a.code));
  const missing = codes.filter((c) => !known.has(c));
  if (missing.length) return NextResponse.json({ ok: false, message: `Unknown account(s): ${missing.join(", ")}.` }, { status: 422 });

  const scope = await getActiveScope(user);
  const bScope = scope.businessId != null ? { businessId: scope.businessId } : {};
  const costCenterId = b.costCenterId ? (await prisma.costCentre.findFirst({ where: { id: Number(b.costCenterId), tenantId: user.tenantId, status: "Active", ...bScope }, select: { id: true } }))?.id ?? null : null;
  const profitCenterId = b.profitCenterId ? (await prisma.profitCentre.findFirst({ where: { id: Number(b.profitCenterId), tenantId: user.tenantId, status: "Active", ...bScope }, select: { id: true } }))?.id ?? null : null;

  const date = (b.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  try {
    const id = await prisma.$transaction((tx) => postJournal(tx, {
      tenantId: user.tenantId, businessId: scope.businessId, branchId: scope.branchId, voucherType: "JOURNAL", prefix: "JV", date,
      narration: b.narration?.trim() || "Manual journal voucher", sourceType: "MANUAL", sourceId: null, refNo: b.refNo?.trim() || null,
      createdBy: user.id, costCenterId, profitCenterId, department: b.department?.trim() || null, project: b.project?.trim() || null,
      lines: lines.map((l) => ({ code: l.code, debit: l.debit, credit: l.credit, narration: l.narration ?? undefined })),
    }));
    if (!id) return NextResponse.json({ ok: false, message: "Nothing to post." }, { status: 422 });
    const voucherNo = `JV-${String(id).padStart(6, "0")}`;
    await writeAudit(prisma, user, {
      action: "journal.create", entity: "JournalEntry", entityId: id, summary: `Manual journal ${voucherNo} — ${totalDebit.toFixed(2)}`,
      meta: { voucherNo, totalDebit, lineCount: lines.length, refNo: b.refNo ?? null }, businessId: scope.businessId, branchId: scope.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id, voucherNo, message: `Journal voucher ${voucherNo} posted.` }, { status: 201 });
  } catch (err) {
    console.error("[journal] post error", err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Could not post the voucher." }, { status: 500 });
  }
}
