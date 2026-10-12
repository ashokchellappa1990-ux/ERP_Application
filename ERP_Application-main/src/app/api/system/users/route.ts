import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getUserPermissions } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { setUserTerminals } from "@/lib/pos/userTerminals";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function canManage(user: { role?: string | null; roleId?: number | null }) {
  return (await getUserPermissions(user)).includes("organization.user-roles");
}

// GET /api/system/users — user accounts in the tenant (with role + scope).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "organization.user-roles");
  if (denied) return denied;
  if (!(await canManage(user))) return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

  const [users, roles, businesses, branches, terminals] = await Promise.all([
    prisma.user.findMany({ where: { tenantId: user.tenantId }, orderBy: { id: "asc" }, include: { roleRef: { select: { name: true } }, terminalMaps: { select: { terminalId: true } } } }),
    prisma.role.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ isSystem: "desc" }, { id: "asc" }], select: { id: true, name: true } }),
    prisma.business.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true } }),
    prisma.branch.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true, businessId: true } }),
    prisma.posTerminal.findMany({ where: { tenantId: user.tenantId, status: "active" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, branchId: true } }),
  ]);

  return NextResponse.json({
    ok: true,
    users: users.map((u) => ({
      id: u.id, fullName: u.fullName, username: u.username, email: u.email, mobile: u.mobile,
      role: u.roleRef?.name ?? u.role, roleId: u.roleId, businessId: u.businessId, branchId: u.branchId, status: u.status,
      terminalIds: u.terminalMaps.map((m) => m.terminalId),
    })),
    roles, businesses, branches, terminals,
  });
}

// POST /api/system/users — create a user with a password set here (no OTP flow).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "organization.user-roles", { req, entity: "User" });
  if (denied) return denied;
  if (!(await canManage(user))) return NextResponse.json({ ok: false, message: "Not allowed." }, { status: 403 });

  let b: { fullName?: string; username?: string; email?: string; mobile?: string; password?: string; roleId?: number; businessId?: number; branchId?: number; status?: string; terminalIds?: number[] };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const errors: Record<string, string> = {};
  const fullName = (b.fullName ?? "").trim();
  const username = (b.username ?? "").trim().toLowerCase();
  const email = (b.email ?? "").trim().toLowerCase();
  const mobile = (b.mobile ?? "").trim();
  const password = b.password ?? "";
  if (!fullName) errors.fullName = "Full name is required.";
  if (!username) errors.username = "Username is required.";
  if (!email || !EMAIL_RE.test(email)) errors.email = "Valid email is required.";
  if (!mobile) errors.mobile = "Mobile number is required.";
  if (!password || password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (!b.roleId) errors.roleId = "Select a role.";
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, message: "Please correct the highlighted fields.", errors }, { status: 422 });

  // Role + business/branch must belong to this tenant.
  const role = await prisma.role.findFirst({ where: { id: Number(b.roleId), tenantId: user.tenantId }, select: { id: true, slug: true } });
  if (!role) return NextResponse.json({ ok: false, message: "Invalid role." }, { status: 422 });
  const businessId = b.businessId ? (await prisma.business.findFirst({ where: { id: Number(b.businessId), tenantId: user.tenantId }, select: { id: true } }))?.id ?? null : null;
  const branchId = b.branchId ? (await prisma.branch.findFirst({ where: { id: Number(b.branchId), tenantId: user.tenantId }, select: { id: true } }))?.id ?? null : null;

  const dup = await prisma.user.findFirst({ where: { OR: [{ email }, { mobile }, { username }] }, select: { email: true, mobile: true, username: true } });
  if (dup) {
    const e: Record<string, string> = {};
    if (dup.email === email) e.email = "Email already in use.";
    if (dup.mobile === mobile) e.mobile = "Mobile already in use.";
    if (dup.username === username) e.username = "Username already taken.";
    return NextResponse.json({ ok: false, message: "User already exists.", errors: e }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const created = await prisma.user.create({
      data: {
        tenantId: user.tenantId, businessId, branchId, roleId: role.id,
        fullName, username, email, mobile, passwordHash,
        businessName: user.businessName, businessType: user.businessType,
        role: role.slug, status: b.status === "inactive" ? "inactive" : "active",
        emailVerified: true, mobileVerified: true, agreedToTerms: true, termsAcceptedAt: new Date(),
        registrationSource: "admin",
      },
      select: { id: true },
    });
    if (Array.isArray(b.terminalIds)) await setUserTerminals(prisma, { tenantId: user.tenantId, userId: created.id, terminalIds: b.terminalIds, businessId, branchId, createdBy: user.id });
    await writeAudit(prisma, user, {
      action: "user.create", entity: "User", entityId: created.id,
      summary: `Created user ${fullName} (${username}) as ${role.slug}`,
      meta: { fullName, username, email, mobile, roleId: role.id, role: role.slug, businessId, branchId, status: b.status === "inactive" ? "inactive" : "active" },
      businessId, branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "User created.", id: created.id }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "Email, mobile or username already in use." }, { status: 409 });
    }
    console.error("[system/users] create error", err);
    return NextResponse.json({ ok: false, message: "Could not create the user." }, { status: 500 });
  }
}
