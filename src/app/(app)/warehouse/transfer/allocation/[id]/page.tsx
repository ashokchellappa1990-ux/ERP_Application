import { StockAllocationView } from "@/components/warehouse/allocation/StockAllocationView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Allocation" };
export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { print?: string } }) {
  return <StockAllocationView id={Number(params.id)} autoPrint={searchParams.print === "1"} />;
}
