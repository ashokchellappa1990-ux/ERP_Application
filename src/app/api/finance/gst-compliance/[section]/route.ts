import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { bizWhere, getGstHeader, currentPeriod, num } from "@/lib/finance/gst/core";
import { getDashboard, buildItc, buildGstr1, buildGstr3b } from "@/lib/finance/gst/engine";
import { getReport } from "@/lib/finance/gst/reports";
import * as store from "@/lib/finance/gst/store";

const PERM = "finance.gst-compliance";

// GET /api/finance/gst-compliance/[section]?period=YYYY-MM[&id=&key=]
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const url = new URL(req.url);
  const period = (url.searchParams.get("period") || currentPeriod()).slice(0, 7);
  const id = Number(url.searchParams.get("id"));

  try {
    switch (params.section) {
      case "header":
        return NextResponse.json({ ok: true, data: await getGstHeader(scope, period) });
      case "dashboard": {
        const [header, dash] = await Promise.all([getGstHeader(scope, period), getDashboard(scope, period)]);
        dash.kpis.returnDueDate = header.returnDueDate;
        return NextResponse.json({ ok: true, data: { header, ...dash } });
      }
      case "verify":
        return NextResponse.json({ ok: true, data: await store.verificationSummary(scope, period) });
      case "itc":
        return NextResponse.json({ ok: true, data: await buildItc(scope, period) });
      case "recon": {
        const [importRows, recRows] = await Promise.all([
          prisma.gstGstr2bImport.findMany({ where: { ...bizWhere(scope), period }, orderBy: { id: "desc" }, take: 500 }),
          prisma.gstReconciliation.findMany({ where: { ...bizWhere(scope), period }, orderBy: { id: "asc" }, take: 500 }),
        ]);
        const data = {
          imported: importRows.length,
          matched: recRows.filter((r) => r.status === "Matched").length,
          partially: recRows.filter((r) => r.status === "PartiallyMatched").length,
          mismatch: recRows.filter((r) => r.status === "Mismatch").length,
          missingInErp: recRows.filter((r) => r.status === "MissingInErp").length,
          missingInPortal: recRows.filter((r) => r.status === "SupplierNotFiled").length,
          rows: recRows.map((r) => ({ id: r.id, supplierGstin: r.supplierGstin ?? "", supplierName: r.supplierName ?? "", invoiceNo: r.invoiceNo ?? "", invoiceDate: r.invoiceDate ?? "", erpTaxable: num(r.erpTaxable), erpGst: num(r.erpGst), portalTaxable: num(r.portalTaxable), portalGst: num(r.portalGst), taxDifference: num(r.taxDifference), gstDifference: num(r.gstDifference), status: r.status, issue: r.issue ?? "", action: r.action })),
          importRows: importRows.map((r) => ({ id: r.id, supplierGstin: r.supplierGstin ?? "", supplierName: r.supplierName ?? "", invoiceNo: r.invoiceNo ?? "", invoiceDate: r.invoiceDate ?? "", invoiceValue: num(r.invoiceValue), gstAmount: num(r.gstAmount), eligibleItc: num(r.eligibleItc), itcStatus: r.itcStatus, matchStatus: r.matchStatus })),
        };
        return NextResponse.json({ ok: true, data });
      }
      case "gstr1": {
        const [preview, saved] = await Promise.all([buildGstr1(scope, period), store.listReturns(scope, period)]);
        return NextResponse.json({ ok: true, data: { preview, saved: saved.filter((r) => r.returnType === "GSTR-1") } });
      }
      case "gstr3b": {
        const [preview, saved] = await Promise.all([buildGstr3b(scope, period), store.listReturns(scope, period)]);
        return NextResponse.json({ ok: true, data: { preview, saved: saved.filter((r) => r.returnType === "GSTR-3B") } });
      }
      case "returns":
        return NextResponse.json({ ok: true, data: await store.listReturns(scope, period) });
      case "return": {
        const d = await store.getReturnDetail(scope, id);
        if (!d) return NextResponse.json({ ok: false, message: "Return not found." }, { status: 404 });
        return NextResponse.json({ ok: true, data: d });
      }
      case "json-exports":
        return NextResponse.json({ ok: true, data: await store.listJsonExports(scope, period) });
      case "filing":
        return NextResponse.json({ ok: true, data: await store.listFiling(scope) });
      case "closing":
      case "periods":
        return NextResponse.json({ ok: true, data: await store.listPeriods(scope, period) });
      case "report":
        return NextResponse.json({ ok: true, data: await getReport(scope, period, url.searchParams.get("key") || "monthly-gst-summary") });
      case "audit":
        return NextResponse.json({ ok: true, data: await store.listAudit(scope, period) });
      default:
        return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error(`[gst-compliance] ${params.section} error`, err);
    return NextResponse.json({ ok: false, message: "Could not load this section." }, { status: 500 });
  }
}
