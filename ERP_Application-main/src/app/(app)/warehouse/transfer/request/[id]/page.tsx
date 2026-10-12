import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { getRequest } from "@/lib/warehouse/transfer";
import { StockTransferView } from "@/components/warehouse/transfer/StockTransferView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Transfer Request" };

export default async function Page({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await getRequest(await getActiveScope(user), Number(params.id));
  if (!data) notFound();
  return <StockTransferView data={data} />;
}
