import { convertQuotationToOrder } from "@/lib/sales/salesDocApi";
export const POST = (req: Request, { params }: { params: { id: string } }) => convertQuotationToOrder(Number(params.id), req);
