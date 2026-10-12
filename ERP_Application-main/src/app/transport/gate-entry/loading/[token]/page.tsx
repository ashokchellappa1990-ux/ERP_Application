import { PublicLoadingScreen } from "@/components/transport/PublicLoadingScreen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vehicle Loading" };

// Public, no-login page reached by scanning the QR on a printed Pre Load
// Weight Slip — deliberately outside the (app) route group, so it renders
// with no sidebar/session chrome for whoever scans it at the loading bay.
export default function Page({ params }: { params: { token: string } }) {
  return <PublicLoadingScreen token={params.token} />;
}
