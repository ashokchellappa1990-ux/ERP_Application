import { achievementHandler } from "@/lib/sales/target/api";
export async function GET(req: Request, { params }: { params: { id: string } }) { return achievementHandler(req, Number(params.id)); }
