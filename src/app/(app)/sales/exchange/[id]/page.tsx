import { SalesExchangeView } from "@/components/sales/SalesExchangeView";

export default function Page({ params }: { params: { id: string } }) {
  return <SalesExchangeView id={params.id} />;
}
