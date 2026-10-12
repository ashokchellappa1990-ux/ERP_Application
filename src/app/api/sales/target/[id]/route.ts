import { getHandler, updateHandler, deleteHandler } from "@/lib/sales/target/api";
export async function GET(req: Request, { params }: { params: { id: string } }) { return getHandler(req, Number(params.id)); }
export async function PUT(req: Request, { params }: { params: { id: string } }) { return updateHandler(req, Number(params.id)); }
export async function DELETE(req: Request, { params }: { params: { id: string } }) { return deleteHandler(req, Number(params.id)); }
