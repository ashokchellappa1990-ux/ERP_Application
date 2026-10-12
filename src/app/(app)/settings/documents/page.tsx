import { Suspense } from "react";
import { DocumentSettings } from "@/components/settings/DocumentSettings";

export default function DocumentSettingsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentSettings />
    </Suspense>
  );
}
