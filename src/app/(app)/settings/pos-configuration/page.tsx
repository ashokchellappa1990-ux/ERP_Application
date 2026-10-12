import { redirect } from "next/navigation";

// POS Configuration was merged into General Settings (tabbed). Keep the old URL
// working by redirecting to the combined screen.
export default function PosConfigurationPage() {
  redirect("/settings/general");
}
