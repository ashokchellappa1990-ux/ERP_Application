import { patchAdvanceType } from "@/lib/advance/api";
export const PATCH = (r: Request, { params }: { params: { id: string } }) => patchAdvanceType(Number(params.id), r);
