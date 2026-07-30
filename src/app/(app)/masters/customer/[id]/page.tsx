import { CustomerFormProvider } from "@/components/masters/CustomerFormContext";
import { CustomerEditor } from "@/components/masters/CustomerEditor";

export default function EditCustomerPage({ params }: { params: { id: string } }) {
  return (
    <CustomerFormProvider customerId={params.id}>
      <CustomerEditor customerId={params.id} />
    </CustomerFormProvider>
  );
}
