import { InvoiceTemplateProvider } from "@/components/settings/InvoiceTemplateFormContext";
import { InvoiceTemplateEditor } from "@/components/settings/InvoiceTemplateEditor";

export default function EditInvoiceTemplatePage({ params }: { params: { id: string } }) {
  return (
    <InvoiceTemplateProvider templateId={params.id}>
      <InvoiceTemplateEditor templateId={params.id} />
    </InvoiceTemplateProvider>
  );
}
