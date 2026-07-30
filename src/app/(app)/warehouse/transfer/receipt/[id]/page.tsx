import { ReceiptView } from "@/components/warehouse/receipt/ReceiptView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Transfer Receipt" };
export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { print?: string } }) {
  return <ReceiptView id={Number(params.id)} autoPrint={searchParams.print === "1"} />;
}
