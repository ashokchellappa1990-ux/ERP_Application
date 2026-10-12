import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { giftVoucherAllowed } from "@/lib/giftVoucher/guard";
import * as svc from "@/lib/giftVoucher/service";
import { REPORT_TYPES, type ReportType } from "@/lib/contracts/giftVoucher";

// GET /api/gift-voucher/[section]
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await giftVoucherAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for the gift voucher module." }, { status: 403 });

  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const url = new URL(req.url);

  try {
    switch (params.section) {
      case "config": return NextResponse.json({ ok: true, config: await svc.getConfig(s), accounts: await svc.listAccounts(s) });
      case "templates": return NextResponse.json({ ok: true, rows: await svc.listTemplates(s) });
      case "vouchers": return NextResponse.json({ ok: true, rows: await svc.listVouchers(s, { status: url.searchParams.get("status") ?? "All", type: url.searchParams.get("type") ?? "All", q: (url.searchParams.get("q") ?? "").trim() }) });
      case "detail": return NextResponse.json({ ok: true, data: await svc.getVoucher(s, Number(url.searchParams.get("id")) || 0) });
      case "sales": return NextResponse.json({ ok: true, rows: await svc.listSales(s, { q: (url.searchParams.get("q") ?? "").trim() }) });
      case "saleDetail": return NextResponse.json({ ok: true, data: await svc.getSale(s, Number(url.searchParams.get("id")) || 0) });
      case "sellable": return NextResponse.json({ ok: true, rows: await svc.listSellable(s) });
      case "validate": return NextResponse.json({ ok: true, data: await svc.validateVoucher(s, url.searchParams.get("voucherNo") ?? "", Number(url.searchParams.get("customerId")) || undefined) });
      case "dashboard": return NextResponse.json({ ok: true, data: await svc.getDashboard(s) });
      case "audit": return NextResponse.json({ ok: true, rows: await svc.listAudit(s) });
      case "report": { const rt = (url.searchParams.get("report") ?? "register") as ReportType; if (!REPORT_TYPES.includes(rt)) return NextResponse.json({ ok: false, message: "Unknown report." }, { status: 400 }); return NextResponse.json({ ok: true, data: await svc.getReport(s, rt) }); }
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error(`[gift-voucher] ${params.section} error`, err);
    return NextResponse.json({ ok: false, message: "Could not load this section." }, { status: 500 });
  }
}
