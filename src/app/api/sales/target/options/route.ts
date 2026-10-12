import { optionsHandler } from "@/lib/sales/target/api";
export async function GET(req: Request) { return optionsHandler(req); }
