import { PurchaseReturnView } from "@/components/purchase/PurchaseReturnView";

export default function PurchaseReturnDetailPage({ params }: { params: { id: string } }) {
  return <PurchaseReturnView id={Number(params.id)} />;
}
