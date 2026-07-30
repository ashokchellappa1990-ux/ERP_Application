import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { registerSchema, zodFieldErrors } from "@/lib/validation/registerSchema";
import { logActivity } from "@/lib/auth/activity";
import { ensureRolesForTenant } from "@/lib/auth/rbac";

const slugify = (s: string) =>
  ((s || "shop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "shop");
const DAY = 24 * 60 * 60 * 1000;

// POST /api/auth/register — validate, check duplicates, hash, create user, issue OTP.
export async function POST(req: Request) {
  // 1. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  // 2. Validate (server-side mirror of the UI rules)
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Please correct the highlighted fields.", errors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const data = parsed.data;

  // 3. Duplicate checks — return field-level errors
  const existing = await prisma.user.findMany({
    where: { OR: [{ email: data.email }, { mobile: data.mobile }, { username: data.username }] },
    select: { email: true, mobile: true, username: true },
  });
  if (existing.length) {
    const errors: Record<string, string> = {};
    if (existing.some((u) => u.email === data.email)) errors.email = "An account with this email already exists.";
    if (existing.some((u) => u.mobile === data.mobile)) errors.mobile = "This mobile number is already registered.";
    if (existing.some((u) => u.username === data.username)) errors.username = "This username is already taken.";
    return NextResponse.json({ ok: false, message: "Account already exists.", errors }, { status: 409 });
  }

  // 4. Hash password
  const passwordHash = await bcrypt.hash(data.password, 10);

  // 5. Create the tenant (the new business) + its owner user. Each sign-up is a
  //    separate tenant whose data is fully isolated from every other shop.
  try {
    const user = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.businessName,
          slug: `${slugify(data.businessName)}-${randomBytes(3).toString("hex")}`,
          plan: "trial",
          status: "active",
          trialEndsAt: new Date(Date.now() + 14 * DAY),
          modulePharmacy: data.businessType === "pharmacy",
        },
        select: { id: true },
      });
      // Seed the default Business (#1) + its Main Branch so the tenant always has a
      // valid data-segregation scope. Business Setup later finalizes its details.
      const business = await tx.business.create({
        data: { tenantId: tenant.id, name: data.businessName, isDefault: true, status: "active" },
        select: { id: true },
      });
      const branch = await tx.branch.create({
        data: { tenantId: tenant.id, businessId: business.id, name: "Main Branch", code: "MAIN", type: "Head Office", isDefault: true, status: "active" },
        select: { id: true },
      });
      return tx.user.create({
        data: {
          tenantId: tenant.id,
          businessId: business.id, // owner's home business
          branchId: branch.id, // owner's home branch
          fullName: data.fullName,
          countryCode: data.countryCode,
          mobile: data.mobile,
          email: data.email,
          username: data.username,
          passwordHash,
          businessName: data.businessName,
          businessType: data.businessType,
          role: "owner",
          status: "active",
          registrationSource: "web",
          agreedToTerms: true,
          termsAcceptedAt: new Date(),
        },
        select: { id: true, email: true, mobile: true, tenantId: true },
      });
    });

    // Seed the tenant's predefined roles + permissions and put the owner on the
    // Business Owner role (best-effort — never blocks sign-up).
    try {
      const ownerRoleId = await ensureRolesForTenant(user.tenantId);
      if (ownerRoleId) await prisma.user.update({ where: { id: user.id }, data: { roleId: ownerRoleId } });
    } catch (e) { console.error("[register] rbac seed", e); }

    await logActivity({ userId: user.id, email: user.email, action: "register", status: "success" });

    return NextResponse.json(
      {
        ok: true,
        userId: user.id,
        message: "Account created. You can sign in now.",
        redirect: "/login",
      },
      { status: 201 },
    );
  } catch (err) {
    // Unique-constraint race fallback (P2002)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { ok: false, message: "Account already exists.", errors: { form: "Email, mobile or username already in use." } },
        { status: 409 },
      );
    }
    console.error("[register] error", err);
    return NextResponse.json({ ok: false, message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
