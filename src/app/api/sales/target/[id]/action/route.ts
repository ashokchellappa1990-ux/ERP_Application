import { actionHandler } from "@/lib/sales/target/api";
export async function POST(req: Request, { params }: { params: { id: string } }) { return actionHandler(req, Number(params.id)); }
