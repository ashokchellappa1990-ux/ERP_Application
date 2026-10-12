import { CustomerFormProvider } from "@/components/masters/CustomerFormContext";
import { CustomerEditor } from "@/components/masters/CustomerEditor";

export default function NewCustomerPage() {
  return (
    <CustomerFormProvider>
      <CustomerEditor />
    </CustomerFormProvider>
  );
}
