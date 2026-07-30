import { listSalesDocs, createSalesDoc } from "@/lib/sales/salesDocApi";
export const GET = (req: Request) => listSalesDocs("quotation", req);
export const POST = (req: Request) => createSalesDoc("quotation", req);
