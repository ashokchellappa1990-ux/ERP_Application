import { getSalesDoc, patchSalesDoc, deleteSalesDoc } from "@/lib/sales/salesDocApi";
export const GET = (_req: Request, { params }: { params: { id: string } }) => getSalesDoc("order", Number(params.id));
export const PATCH = (req: Request, { params }: { params: { id: string } }) => patchSalesDoc("order", Number(params.id), req);
export const DELETE = (req: Request, { params }: { params: { id: string } }) => deleteSalesDoc("order", Number(params.id), req);
