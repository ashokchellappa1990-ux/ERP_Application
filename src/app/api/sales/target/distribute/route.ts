import { distributeHandler } from "@/lib/sales/target/api";
export async function POST(req: Request) { return distributeHandler(req); }
