import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import {
  PromoConfigSchema, PromoCampaignSchema, RuleSchema, PromoGenerateSchema, DistributionSchema, CampaignSendSchema, ValidateSchema, RedeemSchema,
} from "@/lib/contracts/promo";
import * as svc from "@/lib/promo/service";
import { promoAllowed } from "@/lib/promo/guard";

// POST /api/promo/action — body { action, ...payload }
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await promoAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for the promo module." }, { status: 403 });

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
      case "saveConfig": { const p = PromoConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveConfig(s, p.data) }); }
      case "saveCampaign": { const p = PromoCampaignSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const id = body.id ? await (svc.updateCampaign(ctx, Number(body.id), p.data), Number(body.id)) : await svc.createCampaign(ctx, p.data); return NextResponse.json({ ok: true, message: "Campaign saved.", id }); }
      case "saveRule": { const p = RuleSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const id = await svc.saveRule(ctx, Number(body.campaignId), body.ruleId ? Number(body.ruleId) : null, p.data); return NextResponse.json({ ok: true, message: "Rule saved.", id }); }
      case "deleteRule": { await svc.deleteRule(ctx, Number(body.ruleId)); return NextResponse.json({ ok: true, message: "Rule deleted." }); }
      case "generate": { const p = PromoGenerateSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.generateCodes(ctx, p.data); return NextResponse.json({ ok: true, message: `${r.count} promo code(s) generated (${r.firstCode}${r.count > 1 ? `…${r.lastCode}` : ""}).`, ...r }); }
      case "distribute": { const p = DistributionSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.distribute(ctx, p.data); return NextResponse.json({ ok: true, message: `Distributed ${r.count} time(s).`, ...r }); }
      case "sendMessage": { const p = CampaignSendSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.sendCampaignMessage(ctx, p.data); return NextResponse.json({ ok: true, message: `Message queued to ${r.recipientCount} customer(s) via ${p.data.channel}.`, ...r }); }
      case "validate": { const p = ValidateSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, data: await svc.validatePromo(s, p.data) }); }
      case "redeem": { const p = RedeemSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.redeemPromo(ctx, p.data); return NextResponse.json({ ok: true, message: `Promo ${r.promoCode} redeemed — discount ₹${r.discountAmount}.`, ...r }); }
      default: return fail("Unknown action.");
    }
  } catch (err) {
    console.error(`[promo] action ${action} error`, err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 422 });
  }
}
