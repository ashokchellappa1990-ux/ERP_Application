import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import {
  GeneralConfigSchema, LevelSchema, QualificationSchema, BenefitSchema, FeeSchema, ValiditySchema, UpgradeSchema, DowngradeSchema,
  RenewalSchema, CustomerConfigSchema, FinanceConfigSchema, NotificationConfigSchema, CardConfigSchema, ApprovalConfigSchema,
} from "@/lib/contracts/membership";
import * as svc from "@/lib/membership/service";
import { membershipAllowed } from "@/lib/membership/guard";

// POST /api/membership/action — body { action, ...payload }
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await membershipAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for the membership module." }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName ?? null };
  const action = String(body.action ?? "");
  const levelId = Number(body.levelId) || 0;
  const fail = (m: string) => NextResponse.json({ ok: false, message: m }, { status: 422 });

  try {
    switch (action) {
      case "saveGeneral": { const p = GeneralConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveGeneral(ctx, p.data) }); }
      case "saveLevel": { const p = LevelSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const id = body.id ? await (svc.updateLevel(ctx, Number(body.id), p.data), Number(body.id)) : await svc.createLevel(ctx, p.data); return NextResponse.json({ ok: true, message: "Level saved.", id }); }
      case "deleteLevel": { await svc.deleteLevel(ctx, Number(body.id)); return NextResponse.json({ ok: true, message: "Level deleted." }); }
      case "saveQualification": { const p = QualificationSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const id = await svc.saveQualification(ctx, levelId, body.ruleId ? Number(body.ruleId) : null, p.data); return NextResponse.json({ ok: true, message: "Rule saved.", id }); }
      case "deleteQualification": { await svc.deleteQualification(ctx, Number(body.ruleId)); return NextResponse.json({ ok: true, message: "Rule deleted." }); }
      case "saveBenefit": { const p = BenefitSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.saveBenefit(ctx, levelId, p.data); return NextResponse.json({ ok: true, message: "Benefits saved." }); }
      case "saveFee": { const p = FeeSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.saveFee(ctx, levelId, p.data); return NextResponse.json({ ok: true, message: "Fees saved." }); }
      case "saveValidity": { const p = ValiditySchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.saveValidity(ctx, levelId, p.data); return NextResponse.json({ ok: true, message: "Validity saved." }); }
      case "saveUpgrade": { const p = UpgradeSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.saveUpgrade(ctx, levelId, p.data); return NextResponse.json({ ok: true, message: "Upgrade rule saved." }); }
      case "saveDowngrade": { const p = DowngradeSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.saveDowngrade(ctx, levelId, p.data); return NextResponse.json({ ok: true, message: "Downgrade rule saved." }); }
      case "saveRenewal": { const p = RenewalSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveRenewal(ctx, p.data) }); }
      case "saveCustomer": { const p = CustomerConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveCustomerConfig(ctx, p.data) }); }
      case "saveFinance": { const p = FinanceConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveFinance(ctx, p.data) }); }
      case "saveNotification": { const p = NotificationConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveNotification(ctx, p.data) }); }
      case "saveCard": { const p = CardConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveCard(ctx, p.data) }); }
      case "saveApproval": { const p = ApprovalConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveApproval(ctx, p.data) }); }
      default: return fail("Unknown action.");
    }
  } catch (err) {
    console.error(`[membership] action ${action} error`, err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 422 });
  }
}
