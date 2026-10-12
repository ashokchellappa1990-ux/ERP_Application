import { B2bInvoiceView } from "@/components/sales/B2bInvoiceView";

export default function InvoiceViewPage({ params }: { params: { id: string } }) {
  return <B2bInvoiceView id={Number(params.id)} />;
}
