import { listRefunds, createRefund } from "@/lib/advance/api";
export const GET = (r: Request) => listRefunds(r);
export const POST = (r: Request) => createRefund(r);
