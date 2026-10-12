import { performanceHandler } from "@/lib/sales/target/api";
export async function GET(req: Request) { return performanceHandler(req); }
