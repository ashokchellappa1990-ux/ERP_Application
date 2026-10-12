import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { getAllowedScope, getActiveScope, ACTIVE_BUSINESS_COOKIE, ACTIVE_BRANCHES_COOKIE } from "@/lib/auth/scope";

// GET /api/system/scope — the businesses + branches this user may select (hierarchy
// constrained) plus their current active selection. Powers the scope selector.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const [allowed, active] = await Promise.all([getAllowedScope(user), getActiveScope(user)]);
  return NextResponse.json({
    ok: true,
    businesses: allowed.businesses,
    branches: allowed.branches,
    lockBusiness: allowed.lockBusiness,
    lockBranch: allowed.lockBranch,
    active: { businessId: active.businessId, branchIds: active.branchIds }, // branchIds null = All
  });
}

// POST /api/system/scope — set the active business + selected branches (or "all").
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  let b: { businessId?: number; branchIds?: number[] | "all" };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const allowed = await getAllowedScope(user);
  if (allowed.lockBranch) return NextResponse.json({ ok: false, message: "Your scope is fixed to your assigned branch." }, { status: 403 });

  const business = allowed.businesses.find((x) => x.id === Number(b.businessId)) ?? allowed.businesses[0];
  if (!business) return NextResponse.json({ ok: false, message: "No business available." }, { status: 404 });

  const allowedBranchIds = allowed.branches.filter((x) => x.businessId === business.id).map((x) => x.id);
  let branchValue = "all";
  if (Array.isArray(b.branchIds)) {
    const sel = b.branchIds.map(Number).filter((n) => allowedBranchIds.includes(n));
    branchValue = sel.length && sel.length < allowedBranchIds.length ? sel.join(",") : "all";
  }

  const jar = cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };
  jar.set(ACTIVE_BUSINESS_COOKIE, String(business.id), opts);
  jar.set(ACTIVE_BRANCHES_COOKIE, branchValue, opts);

  return NextResponse.json({ ok: true, message: "Scope updated.", businessId: business.id, branchIds: branchValue === "all" ? null : branchValue.split(",").map(Number) });
}
