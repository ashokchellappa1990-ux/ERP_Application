import { NextResponse } from "next/server";
import { platformAuth, isResponse } from "@/lib/platform/apiGuard";
import * as svc from "@/lib/platform/service";
import { REPORT_TYPES, type ReportType } from "@/lib/platform/contracts";

const SECTION_PERM: Record<string, string> = {
  dashboard: "dashboard", tenants: "tenants", tenant: "tenants", plans: "plans", "trial-plans": "trial-plans",
  subscriptions: "subscriptions", subhistory: "subscriptions", workspaces: "workspaces", archives: "workspaces",
  license: "licenses", usage: "usage", invoices: "billing", payments: "payments", notifications: "notifications", audit: "audit", report: "reports", settings: "settings",
};

// GET /api/platform/[section]
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const perm = SECTION_PERM[params.section];
  if (!perm) return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
  const auth = await platformAuth(perm);
  if (isResponse(auth)) return auth;

  const url = new URL(req.url);
  const tenantId = Number(url.searchParams.get("tenantId")) || 0;
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";

  try {
    switch (params.section) {
      case "dashboard": return NextResponse.json({ ok: true, data: await svc.getDashboard() });
      case "tenants": return NextResponse.json({ ok: true, rows: await svc.listTenants({ q, status }) });
      case "tenant": return NextResponse.json({ ok: true, data: await svc.getTenant(tenantId) });
      case "plans": return NextResponse.json({ ok: true, rows: await svc.listPlans() });
      case "trial-plans": return NextResponse.json({ ok: true, rows: await svc.listTrialConfigs() });
      case "subscriptions": return NextResponse.json({ ok: true, rows: await svc.listSubscriptions({ status }) });
      case "subhistory": return NextResponse.json({ ok: true, rows: await svc.subscriptionHistory(Number(url.searchParams.get("subscriptionId")) || 0) });
      case "workspaces": return NextResponse.json({ ok: true, rows: await svc.listWorkspaces(tenantId) });
      case "archives": return NextResponse.json({ ok: true, rows: await svc.listArchives(tenantId || undefined) });
      case "license": return NextResponse.json({ ok: true, data: await svc.getLicense(tenantId) });
      case "usage": return NextResponse.json({ ok: true, rows: tenantId ? [{ tenantId, tenantName: "", ...(await svc.getUsage(tenantId)) }] : await svc.listUsageAll() });
      case "invoices": return NextResponse.json({ ok: true, rows: await svc.listInvoices({ tenantId: tenantId || undefined, status }) });
      case "payments": return NextResponse.json({ ok: true, rows: await svc.listPayments({ tenantId: tenantId || undefined }) });
      case "notifications": return NextResponse.json({ ok: true, rows: await svc.listNotifications() });
      case "audit": return NextResponse.json({ ok: true, rows: await svc.listAudit() });
      case "settings": return NextResponse.json({ ok: true, config: await svc.getSettings() });
      case "report": { const rt = (url.searchParams.get("report") ?? "tenants") as ReportType; if (!REPORT_TYPES.includes(rt)) return NextResponse.json({ ok: false, message: "Unknown report." }, { status: 400 }); return NextResponse.json({ ok: true, data: await svc.getReport(rt) }); }
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error(`[platform] ${params.section} error`, err);
    return NextResponse.json({ ok: false, message: "Could not load this section." }, { status: 500 });
  }
}
