import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ReceiptCreateSchema } from "@/lib/contracts/receipt";
import { listReceipts, createReceipt, listCategories, listAccounts, getConfig } from "@/lib/finance/receipt";

const PERM = "finance.receipt";

// GET /api/finance/receipts?status=&q= — register + meta (config/categories/accounts).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const url = new URL(req.url);
  const [rows, config, categories, accounts] = await Promise.all([
    listReceipts(s, { status: url.searchParams.get("status") ?? "All", q: (url.searchParams.get("q") ?? "").trim() }),
    getConfig(s), listCategories(s, false), listAccounts(s),
  ]);
  return NextResponse.json({ ok: true, rows, meta: { config, categories, accounts } });
}

// POST /api/finance/receipts — create a draft receipt.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ReceiptTransaction" });
  if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ReceiptCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName ?? null };
  try {
    const res = await createReceipt(ctx, parsed.data);
    await writeAudit(prisma, user, { action: "receipt.create", entity: "ReceiptTransaction", entityId: res.id, summary: `Receipt ${res.voucherNo} — ${parsed.data.amount}`, meta: { categoryId: parsed.data.categoryId, amount: parsed.data.amount, mode: parsed.data.mode }, businessId: ctx.businessId, branchId: ctx.branchId, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Receipt created.", id: res.id, voucherNo: res.voucherNo }, { status: 201 });
  } catch (e) {
    console.error("[receipt] create error", e);
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Could not create the receipt." }, { status: 422 });
  }
}
