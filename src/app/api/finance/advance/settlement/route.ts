import { listSettlements, createSettlement } from "@/lib/advance/api";
export const GET = (r: Request) => listSettlements(r);
export const POST = (r: Request) => createSettlement(r);
