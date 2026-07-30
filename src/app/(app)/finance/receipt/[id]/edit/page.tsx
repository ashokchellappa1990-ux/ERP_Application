import { ReceiptFormPage } from "@/components/finance/ReceiptFormPage";

export default function EditReceiptPage({ params }: { params: { id: string } }) {
  return <ReceiptFormPage id={Number(params.id)} />;
}
