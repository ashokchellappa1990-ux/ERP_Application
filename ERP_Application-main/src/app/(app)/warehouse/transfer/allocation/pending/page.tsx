import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
// Pending Allocation is now a tab inside Stock Allocation.
export default function Page() { redirect("/warehouse/transfer/allocation?tab=pending"); }
