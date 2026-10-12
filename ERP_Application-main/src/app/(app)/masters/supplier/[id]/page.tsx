import { SupplierFormProvider } from "@/components/masters/SupplierFormContext";
import { SupplierEditor } from "@/components/masters/SupplierEditor";

export default function EditSupplierPage({ params }: { params: { id: string } }) {
  return (
    <SupplierFormProvider supplierId={params.id}>
      <SupplierEditor supplierId={params.id} />
    </SupplierFormProvider>
  );
}
