import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { CashEntryCreateSchema, FUND_TRANSFER_LABELS } from "@/lib/contracts/cashManagement";
import { createCashEntry, listCashEntries, listBanks, cashKpis } from "@/lib/finance/cash";

const PERM = "finance.cash";

// GET /api/finance/cash?kind=&q=&period=YYYY-MM — list + banks + KPIs.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const sc = { tenantId: scope.tenantId, businessId: scope.businessId ?? null };
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "All";
  const q = (url.searchParams.get("q") ?? "").trim();
  const period = (url.searchParams.get("period") || new Date().toISOString().slice(0, 7)).slice(0, 7);

  const [rows, banks, kpis] = await Promise.all([listCashEntries(sc, { kind, q }), listBanks(sc), cashKpis(sc, period)]);
  return NextResponse.json({ ok: true, rows, banks, kpis });
}

// POST /api/finance/cash — create a fund transfer or miscellaneous receipt + post GL.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "CashEntry" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = CashEntryCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const input = parsed.data;

  if (input.kind === "FUND_TRANSFER" && !input.bankName && !input.bankId) {
    return NextResponse.json({ ok: false, message: "Select the bank for this transfer." }, { status: 422 });
  }
  if (input.kind === "MISC_RECEIPT" && input.receivedIn === "Bank" && !input.bankName && !input.bankId) {
    return NextResponse.json({ ok: false, message: "Select the bank the money was received into." }, { status: 422 });
  }

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName ?? null };

  try {
    const res = await prisma.$transaction((tx) => createCashEntry(tx, ctx, input));
    await writeAudit(prisma, user, {
      action: input.kind === "FUND_TRANSFER" ? "cash.fund_transfer" : "cash.misc_receipt",
      entity: "CashEntry", entityId: res.id,
      summary: input.kind === "FUND_TRANSFER" ? `${FUND_TRANSFER_LABELS[input.transferType]} ${res.docNo} — ${input.amount}` : `Misc receipt ${res.docNo} from ${input.payer} — ${input.amount}`,
      meta: { ...input }, businessId: ctx.businessId, branchId: ctx.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: input.kind === "FUND_TRANSFER" ? "Fund transfer recorded." : "Receipt recorded.", id: res.id, docNo: res.docNo }, { status: 201 });
  } catch (err) {
    console.error("[finance/cash] create error", err);
    return NextResponse.json({ ok: false, message: "Could not record the entry." }, { status: 500 });
  }
}
