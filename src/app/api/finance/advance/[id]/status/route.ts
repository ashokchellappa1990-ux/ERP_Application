import { advanceStatus } from "@/lib/advance/api";
export const POST = (r: Request, { params }: { params: { id: string } }) => advanceStatus(Number(params.id), r);
