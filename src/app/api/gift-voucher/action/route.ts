import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { GvConfigSchema, GenerateSchema, SaleSchema, ActivateSchema, AdjustSchema, RedeemSchema, CloseSchema, ReissueSchema, ExtendSchema } from "@/lib/contracts/giftVoucher";
import * as svc from "@/lib/giftVoucher/service";
import { giftVoucherAllowed } from "@/lib/giftVoucher/guard";

// POST /api/gift-voucher/action — body { action, ...payload }
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await giftVoucherAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for the gift voucher module." }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const seg = scopeData(scope, { branch: true });
  const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName ?? null };
  const action = String(body.action ?? "");
  const fail = (m: string) => NextResponse.json({ ok: false, message: m }, { status: 422 });

  try {
    switch (action) {
      case "saveConfig": { const p = GvConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveConfig(ctx, p.data) }); }
      case "generate": { const p = GenerateSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.generate(ctx, p.data); return NextResponse.json({ ok: true, message: `${r.count} voucher(s) generated (${r.firstNo}${r.count > 1 ? `…${r.lastNo}` : ""}).`, ...r }); }
      case "sell": { const p = SaleSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.sellVoucher(ctx, p.data); return NextResponse.json({ ok: true, message: `Voucher ${r.voucherNo} sold — ₹${r.net}.`, ...r }); }
      case "activate": { const p = ActivateSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.activate(ctx, p.data.voucherId, p.data.method); return NextResponse.json({ ok: true, message: "Voucher activated." }); }
      case "adjust": { const p = AdjustSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.adjustBalance(ctx, p.data.voucherId, p.data.adjType || "Adjust", p.data.amount, p.data.reason); return NextResponse.json({ ok: true, message: "Balance adjusted." }); }
      case "redeem": { const p = RedeemSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.redeemVoucher(ctx, p.data); return NextResponse.json({ ok: true, message: `Redeemed ₹${r.amount}. Balance ₹${r.balanceAfter}.`, ...r }); }
      case "close": { const p = CloseSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.closeVoucher(ctx, p.data.voucherId, p.data.reason, p.data.note); return NextResponse.json({ ok: true, message: "Voucher closed." }); }
      case "reissue": { const p = ReissueSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.reissue(ctx, p.data.voucherId, p.data.reason); return NextResponse.json({ ok: true, message: `Reissued as ${r.voucherNo} (balance ₹${r.balance}).`, ...r }); }
      case "extend": { const p = ExtendSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.extendExpiry(ctx, p.data.voucherId, p.data.expiryDate); return NextResponse.json({ ok: true, message: "Expiry extended." }); }
      case "renderPrint": { const ids = Array.isArray(body.voucherIds) ? (body.voucherIds as unknown[]).map(Number).filter((n) => n > 0) : []; if (!ids.length) return fail("Select vouchers to print."); const r = await svc.renderPrint(ctx, ids, body.templateId ? Number(body.templateId) : undefined, Number(body.perPage) || 4); return NextResponse.json({ ok: true, html: r.html, count: r.count }); }
      case "runExpiry": { const n = await svc.runExpiry(ctx); return NextResponse.json({ ok: true, message: `${n} voucher(s) expired.` }); }
      default: return fail("Unknown action.");
    }
  } catch (err) {
    console.error(`[gift-voucher] action ${action} error`, err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 422 });
  }
}
