import { SalesReturnView } from "@/components/sales/SalesReturnView";

export default function Page({ params }: { params: { id: string } }) {
  return <SalesReturnView id={params.id} />;
}
