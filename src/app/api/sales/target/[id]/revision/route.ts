import { revisionsHandler, createRevisionHandler } from "@/lib/sales/target/api";
export async function GET(req: Request, { params }: { params: { id: string } }) { return revisionsHandler(req, Number(params.id)); }
export async function POST(req: Request, { params }: { params: { id: string } }) { return createRevisionHandler(req, Number(params.id)); }
