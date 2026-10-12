import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { DiscountSchema, DiscountConfigSchema, SimulateSchema } from "@/lib/contracts/discount";
import { discountAllowed } from "@/lib/discount/guard";
import * as svc from "@/lib/discount/service";

// POST /api/discount/action — body { action, ...payload }
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await discountAllowed(user))) return NextResponse.json({ ok: false, message: "No permission." }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }

  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const seg = scopeData(scope, { branch: true });
  const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName ?? null };
  const action = String(body.action ?? "");
  const fail = (m: string) => NextResponse.json({ ok: false, message: m }, { status: 422 });

  try {
    switch (action) {
      case "saveConfig": {
        const p = DiscountConfigSchema.safeParse(body);
        if (!p.success) return fail(p.error.issues[0].message);
        return NextResponse.json({ ok: true, message: "Configuration saved.", config: await svc.saveConfig(s, p.data) });
      }
      case "save": {
        const p = DiscountSchema.safeParse(body);
        if (!p.success) return fail(p.error.issues[0].message);
        if (body.id) { await svc.updateDiscount(ctx, Number(body.id), p.data); return NextResponse.json({ ok: true, message: "Discount updated.", id: Number(body.id) }); }
        const id = await svc.createDiscount(ctx, p.data);
        return NextResponse.json({ ok: true, message: "Discount created.", id });
      }
      case "setStatus": {
        const id = Number(body.id); const status = String(body.status ?? "");
        if (!id || !status) return fail("Missing id/status.");
        await svc.setStatus(ctx, id, status);
        return NextResponse.json({ ok: true, message: `Status changed to ${status}.` });
      }
      case "approve": {
        const id = Number(body.id);
        if (!id) return fail("Missing id.");
        await svc.approveDiscount(ctx, id, body.approved !== false, body.note ? String(body.note) : undefined);
        return NextResponse.json({ ok: true, message: body.approved !== false ? "Discount approved & activated." : "Discount rejected." });
      }
      case "delete": {
        const id = Number(body.id);
        if (!id) return fail("Missing id.");
        await svc.deleteDiscount(ctx, id);
        return NextResponse.json({ ok: true, message: "Discount deleted." });
      }
      case "simulate": {
        const p = SimulateSchema.safeParse(body);
        if (!p.success) return fail(p.error.issues[0].message);
        return NextResponse.json({ ok: true, result: await svc.simulate(s, p.data) });
      }
      case "preview": {
        const lines = Array.isArray(body.lines) ? (body.lines as unknown[]).map((l) => { const o = l as Record<string, unknown>; return { productId: Number(o.productId) || 0, qty: Number(o.qty) || 0, amount: Number(o.amount) || 0, taxable: o.taxable != null ? Number(o.taxable) : undefined, category: o.category ? String(o.category) : undefined, brand: o.brand ? String(o.brand) : undefined }; }) : [];
        const result = await svc.previewForCart(s, { channel: String(body.channel ?? "POS"), customerId: body.customerId ? Number(body.customerId) : null, customerGroup: body.customerGroup ? String(body.customerGroup) : undefined, membershipLevel: body.membershipLevel ? String(body.membershipLevel) : undefined, paymentMode: body.paymentMode ? String(body.paymentMode) : undefined, billAmount: Number(body.billAmount) || 0, billTaxable: body.billTaxable != null ? Number(body.billTaxable) : undefined, flags: body.flags as Record<string, boolean> | undefined, lines });
        return NextResponse.json({ ok: true, result });
      }
      default: return fail("Unknown action.");
    }
  } catch (err) {
    console.error(`[discount] action ${action} error`, err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Failed." }, { status: 422 });
  }
}
