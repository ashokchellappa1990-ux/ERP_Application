import { SalesCancellationView } from "@/components/sales/SalesCancellationView";

export default function SalesCancellationDetailPage({ params }: { params: { id: string } }) {
  return <SalesCancellationView id={Number(params.id)} />;
}
