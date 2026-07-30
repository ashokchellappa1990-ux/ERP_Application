import { getAdvanceConfig, putAdvanceConfig } from "@/lib/advance/api";
export const GET = () => getAdvanceConfig();
export const PUT = (r: Request) => putAdvanceConfig(r);
