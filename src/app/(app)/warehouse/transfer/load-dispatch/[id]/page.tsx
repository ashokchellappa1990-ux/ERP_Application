import { Suspense } from "react";
import { LoadDispatchEditor } from "@/components/transport/LoadDispatchEditor";
export const dynamic = "force-dynamic";
export const metadata = { title: "Load & Dispatch" };
export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <LoadDispatchEditor id={Number(params.id)} />
    </Suspense>
  );
}
