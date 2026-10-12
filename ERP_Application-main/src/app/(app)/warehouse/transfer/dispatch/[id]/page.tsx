import { DispatchView } from "@/components/warehouse/dispatch/DispatchView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Transfer Dispatch" };
export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { print?: string } }) {
  return <DispatchView id={Number(params.id)} autoPrint={searchParams.print === "1"} />;
}
