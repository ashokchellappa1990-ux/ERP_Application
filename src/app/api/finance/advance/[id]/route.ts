import { getAdvance, patchAdvance, deleteAdvance } from "@/lib/advance/api";
export const GET = (_r: Request, { params }: { params: { id: string } }) => getAdvance(Number(params.id));
export const PATCH = (r: Request, { params }: { params: { id: string } }) => patchAdvance(Number(params.id), r);
export const DELETE = (r: Request, { params }: { params: { id: string } }) => deleteAdvance(Number(params.id), r);
