import { getTranslations } from "next-intl/server";
import { OfferForm } from "@/components/admin/OfferForm";

export default async function NewOfferPage() {
  const t = await getTranslations("AdminOfferForm");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-bold text-navy">{t("newTitle")}</h1>
      <OfferForm />
    </div>
  );
}
