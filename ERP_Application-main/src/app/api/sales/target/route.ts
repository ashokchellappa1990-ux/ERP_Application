import { listHandler, createHandler } from "@/lib/sales/target/api";
export async function GET(req: Request) { return listHandler(req); }
export async function POST(req: Request) { return createHandler(req); }
