import { configHandler } from "@/lib/sales/target/api";
export async function GET(req: Request) { return configHandler(req); }
export async function PUT(req: Request) { return configHandler(req); }
