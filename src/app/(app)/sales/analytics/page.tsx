import { redirect } from "next/navigation";

/** Retired: the mock Sales Analytics page is now the Analytics tab of the Sales Command Center. */
export default function SalesAnalyticsPage() {
  redirect("/sales?tab=analytics");
}
