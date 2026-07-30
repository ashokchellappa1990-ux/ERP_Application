import { revisionActionHandler } from "@/lib/sales/target/api";
export async function POST(req: Request, { params }: { params: { rid: string } }) { return revisionActionHandler(req, Number(params.rid)); }
