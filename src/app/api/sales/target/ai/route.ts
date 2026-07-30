import { aiHandler } from "@/lib/sales/target/api";
export async function GET(req: Request) { return aiHandler(req); }
