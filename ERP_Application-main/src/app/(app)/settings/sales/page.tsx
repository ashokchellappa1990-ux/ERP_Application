import { SalesSettingsProvider } from "@/components/settings/SalesSettingsFormContext";
import { SalesSettings } from "@/components/settings/SalesSettings";

export default function SalesSettingsPage() {
  return (
    <SalesSettingsProvider>
      <SalesSettings />
    </SalesSettingsProvider>
  );
}
