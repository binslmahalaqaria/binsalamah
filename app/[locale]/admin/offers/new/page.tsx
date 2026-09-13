import { OfferForm } from "@/components/admin/OfferForm";

export default function NewOfferPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">New Offer</h1>
      <OfferForm />
    </div>
  );
}
