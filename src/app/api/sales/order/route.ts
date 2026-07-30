import { listSalesDocs, createSalesDoc } from "@/lib/sales/salesDocApi";
export const GET = (req: Request) => listSalesDocs("order", req);
export const POST = (req: Request) => createSalesDoc("order", req);
