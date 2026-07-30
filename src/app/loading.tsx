import { AppLoader } from "@/components/ui/AppLoader";

// Top-level loader (pre-auth screens & initial load).
export default function RootLoading() {
  return <AppLoader fullScreen />;
}
