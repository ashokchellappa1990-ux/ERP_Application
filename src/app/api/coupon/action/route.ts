import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import {
  CouponConfigSchema, CampaignSchema, RuleSchema, GenerateSchema, IssueSchema, ValidateSchema, RedeemSchema, PrintSchema, TemplateSaveSchema, RenderPrintSchema,
} from "@/lib/contracts/coupon";
import * as svc from "@/lib/coupon/service";
import { couponAllowed } from "@/lib/coupon/guard";

// POST /api/coupon/action — body { action, ...payload }
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await couponAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for the coupon module." }, { status: 403 });

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
      case "saveConfig": { const p = CouponConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveConfig(s, p.data) }); }
      case "saveCampaign": { const p = CampaignSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const id = body.id ? await (svc.updateCampaign(ctx, Number(body.id), p.data), Number(body.id)) : await svc.createCampaign(ctx, p.data); return NextResponse.json({ ok: true, message: "Campaign saved.", id }); }
      case "saveRule": { const p = RuleSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const id = await svc.saveRule(ctx, Number(body.campaignId), body.ruleId ? Number(body.ruleId) : null, p.data); return NextResponse.json({ ok: true, message: "Rule saved.", id }); }
      case "deleteRule": { await svc.deleteRule(ctx, Number(body.ruleId)); return NextResponse.json({ ok: true, message: "Rule deleted." }); }
      case "generate": { const p = GenerateSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.generateCoupons(ctx, p.data); return NextResponse.json({ ok: true, message: `${r.count} coupons generated (${r.firstNo}…${r.lastNo}).`, ...r }); }
      case "issue": { const p = IssueSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.issueCoupon(ctx, p.data); return NextResponse.json({ ok: true, message: "Coupon issued." }); }
      case "validate": { const p = ValidateSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, data: await svc.validateCoupon(s, p.data) }); }
      case "redeem": { const p = RedeemSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.redeemCoupon(ctx, p.data); return NextResponse.json({ ok: true, message: `Coupon ${r.couponNo} redeemed — discount ₹${r.discountAmount}.`, ...r }); }
      case "print": { const p = PrintSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.recordPrint(ctx, p.data.couponIds ?? [], { batchId: p.data.batchId, templateId: p.data.templateId, format: p.data.format, perPage: p.data.perPage, reprint: p.data.reprint }); return NextResponse.json({ ok: true, message: "Print recorded." }); }
      case "saveTemplate": { const p = TemplateSaveSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const id = await svc.saveTemplate(ctx, p.data); return NextResponse.json({ ok: true, message: "Template saved.", id }); }
      case "deleteTemplate": { await svc.deleteTemplate(ctx, Number(body.id)); return NextResponse.json({ ok: true, message: "Template deleted." }); }
      case "renderPrint": { const p = RenderPrintSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.renderPrint(ctx, p.data.couponIds, p.data.templateId, p.data.perPage ?? 4); return NextResponse.json({ ok: true, html: r.html, count: r.count }); }
      default: return fail("Unknown action.");
    }
  } catch (err) {
    console.error(`[coupon] action ${action} error`, err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 422 });
  }
}
