import { SupplierFormProvider } from "@/components/masters/SupplierFormContext";
import { SupplierEditor } from "@/components/masters/SupplierEditor";

export default function NewSupplierPage() {
  return (
    <SupplierFormProvider>
      <SupplierEditor />
    </SupplierFormProvider>
  );
}
