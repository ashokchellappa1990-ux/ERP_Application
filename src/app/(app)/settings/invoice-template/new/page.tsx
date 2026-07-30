import { InvoiceTemplateProvider } from "@/components/settings/InvoiceTemplateFormContext";
import { InvoiceTemplateEditor } from "@/components/settings/InvoiceTemplateEditor";

export default function NewInvoiceTemplatePage() {
  return (
    <InvoiceTemplateProvider>
      <InvoiceTemplateEditor />
    </InvoiceTemplateProvider>
  );
}
