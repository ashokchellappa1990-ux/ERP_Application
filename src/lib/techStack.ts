/**
 * Technology stack & versions — shown on the login screen for user & stakeholder
 * reference. Single source of truth; update here when dependencies change
 * (values are build-time constants, mirrored from package.json / the runtime).
 */
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";

/** The product name default — the single source is lib/brand.ts. The LIVE name
 *  comes from Website CMS identity via useBrand(); this is only a build-time fallback. */
export const APP_NAME = DEFAULT_PRODUCT_NAME;
export const APP_EDITION = "Enterprise Retail ERP + POS";
export const APP_VERSION = "0.1.0";

export interface TechItem {
  name: string;
  version: string;
}

export interface TechGroup {
  label: string;
  items: TechItem[];
}

export const TECH_STACK: TechGroup[] = [
  {
    label: "Frontend",
    items: [
      { name: "Next.js", version: "14.2.35" },
      { name: "React", version: "18.3.1" },
      { name: "TypeScript", version: "5.5.3" },
      { name: "Tailwind CSS", version: "3.4.6" },
    ],
  },
  {
    label: "Backend / API",
    items: [
      { name: "Node.js", version: "24.14.0" },
      { name: "Next.js Route Handlers", version: "14.2.35" },
      { name: "Prisma ORM", version: "7.8.0" },
      { name: "Zod", version: "4.4.3" },
      { name: "bcryptjs", version: "3.0.3" },
    ],
  },
  {
    label: "Database",
    items: [
      { name: "MySQL", version: "8.0.45" },
      { name: "MariaDB Driver", version: "3.5.3" },
    ],
  },
];
