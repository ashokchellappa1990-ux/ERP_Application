import { settlementStatus } from "@/lib/advance/api";
export const POST = (r: Request, { params }: { params: { id: string } }) => settlementStatus(Number(params.id), r);
