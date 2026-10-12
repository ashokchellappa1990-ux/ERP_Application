import { Suspense } from "react";
import { Customer360Dashboard } from "@/components/crm/Customer360Dashboard";

export default function Customer360Page() {
  return <Suspense fallback={null}><Customer360Dashboard /></Suspense>;
}
