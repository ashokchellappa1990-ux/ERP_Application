import { LoyaltyProgramEditor } from "@/components/loyalty/LoyaltyProgramEditor";

export default function EditLoyaltyProgramPage({ params }: { params: { id: string } }) {
  return <LoyaltyProgramEditor id={Number(params.id)} />;
}
