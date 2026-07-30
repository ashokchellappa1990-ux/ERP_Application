import { listAdvanceTypes, createAdvanceType } from "@/lib/advance/api";
export const GET = () => listAdvanceTypes();
export const POST = (r: Request) => createAdvanceType(r);
