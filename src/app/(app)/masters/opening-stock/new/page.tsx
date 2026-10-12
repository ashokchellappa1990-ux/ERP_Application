import { OpeningStockFormProvider } from "@/components/masters/OpeningStockFormContext";
import { OpeningStockEditor } from "@/components/masters/OpeningStockEditor";

export default function NewOpeningStockPage() {
  return (
    <OpeningStockFormProvider>
      <OpeningStockEditor />
    </OpeningStockFormProvider>
  );
}
