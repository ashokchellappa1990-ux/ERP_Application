import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { buildEditorData } from "@/lib/finance/budgetApi";

const PERM = "finance.budget";

// GET /api/finance/budget/plan?fy=&scope=&branchId= — editor data for a NEW plan
// (auto-loads tracked heads + monitoring + previous-year reference).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const data = await buildEditorData(user, {
    fy: url.searchParams.get("fy") ?? undefined,
    scope: url.searchParams.get("scope") === "branch" ? "branch" : "company",
    branchId: Number(url.searchParams.get("branchId")) || null,
  });
  return NextResponse.json({ ok: true, ...data });
}
