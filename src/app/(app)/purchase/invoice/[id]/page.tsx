import { PurchaseInvoiceView } from "@/components/purchase/PurchaseInvoiceView";

export default function Page({ params }: { params: { id: string } }) {
  return <PurchaseInvoiceView id={params.id} />;
}
