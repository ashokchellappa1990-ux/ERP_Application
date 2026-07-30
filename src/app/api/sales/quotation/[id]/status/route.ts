import { transitionSalesDoc } from "@/lib/sales/salesDocApi";
export const POST = (req: Request, { params }: { params: { id: string } }) => transitionSalesDoc("quotation", Number(params.id), req);
