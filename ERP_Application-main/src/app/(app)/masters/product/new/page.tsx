import { ProductFormProvider } from "@/components/masters/ProductFormContext";
import { ProductEditor } from "@/components/masters/ProductEditor";

export default function NewProductPage() {
  return (
    <ProductFormProvider>
      <ProductEditor />
    </ProductFormProvider>
  );
}
