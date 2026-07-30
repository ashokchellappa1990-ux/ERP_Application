import { DiscountEditorPage } from "@/components/masters/DiscountEditorPage";

export const dynamic = "force-dynamic";

export default function EditDiscountPage({ params }: { params: { id: string } }) {
  return <DiscountEditorPage id={params.id} />;
}
