import { AllocationGate } from "@/components/warehouse/allocation/AllocationGate";
import { StockAllocationTabs } from "@/components/warehouse/allocation/StockAllocationTabs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Allocation · Oasys Orbit" };

type Tab = "allocations" | "pending" | "history";
export default function Page({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = (["allocations", "pending", "history"].includes(searchParams.tab ?? "") ? searchParams.tab : "allocations") as Tab;
  return <AllocationGate><StockAllocationTabs initialTab={tab} /></AllocationGate>;
}
