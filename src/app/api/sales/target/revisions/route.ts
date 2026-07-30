import { revisionsHandler } from "@/lib/sales/target/api";
/** All revisions across targets (for the Target Revision screen). */
export async function GET(req: Request) { return revisionsHandler(req); }
