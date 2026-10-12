import { listAdvances, createAdvance } from "@/lib/advance/api";
export const GET = (req: Request) => listAdvances(req);
export const POST = (req: Request) => createAdvance(req);
