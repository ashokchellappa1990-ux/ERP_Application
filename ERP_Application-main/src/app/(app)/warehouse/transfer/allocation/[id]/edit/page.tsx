import { AllocationGate } from "@/components/warehouse/allocation/AllocationGate";
import { StockAllocationEditor } from "@/components/warehouse/allocation/StockAllocationEditor";
export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Allocation" };
export default function Page({ params }: { params: { id: string } }) {
  return <AllocationGate><StockAllocationEditor id={Number(params.id)} /></AllocationGate>;
}
