import { transitionSalesDoc } from "@/lib/sales/salesDocApi";
export const POST = (req: Request, { params }: { params: { id: string } }) => transitionSalesDoc("order", Number(params.id), req);
