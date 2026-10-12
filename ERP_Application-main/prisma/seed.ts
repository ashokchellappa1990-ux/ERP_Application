/**
 * Seed script — one verified admin user so the registration / login flow has a
 * known account to test against. Run with: npm run db:seed (after db:migrate).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

// Standalone script: load .env ourselves (Next.js isn't in the loop here).
try {
  process.loadEnvFile();
} catch {
  // env injected directly
}

const adapter = new PrismaMariaDb({
  host: process.env.DB_SERVER ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? "onepos",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);

  // A default tenant for the seeded admin (multi-tenant SaaS — every user belongs to a tenant).
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Rao Super Market", slug: "default", plan: "pro", status: "active" },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@onepos.cloud" },
    update: {},
    create: {
      tenantId: tenant.id,
      fullName: "Arjun Rao",
      countryCode: "+91",
      mobile: "9000000001",
      email: "admin@onepos.cloud",
      username: "arjun.admin",
      passwordHash,
      businessName: "Rao Super Market",
      businessType: "grocery",
      role: "owner",
      status: "active",
      emailVerified: true,
      mobileVerified: true,
      agreedToTerms: true,
      termsAcceptedAt: new Date(),
      registrationSource: "web",
    },
  });

  console.log(`Seeded admin user #${admin.id} (${admin.email}) — login password: Admin@123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
