import { SupplierPaymentView } from "@/components/purchase/SupplierPaymentView";

export default function PaymentViewPage({ params }: { params: { id: string } }) {
  return <SupplierPaymentView id={Number(params.id)} />;
}
