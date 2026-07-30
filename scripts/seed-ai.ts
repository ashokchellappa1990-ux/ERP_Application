import { seedAiFoundation } from "../src/lib/ai/seed";
import { prisma } from "../src/lib/db/prisma";
seedAiFoundation().then((r) => { console.log("Seeded AI foundation:", r); return prisma.$disconnect(); }).catch((e) => { console.error(e); process.exit(1); });
