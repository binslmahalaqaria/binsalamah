import { getTranslations } from "next-intl/server";
import { OffersGrid } from "@/components/OffersGrid";
import { listPublishedOffers } from "@/lib/offers";
import { getPublicContactInfo } from "@/lib/settings";

export default async function OffersPage() {
  const t = await getTranslations("Offers");
  const [offers, { whatsappNumber }] = await Promise.all([
    listPublishedOffers(),
    getPublicContactInfo(),
  ]);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="mb-8 font-heading text-2xl font-bold text-navy">{t("title")}</h1>
      <OffersGrid offers={offers} whatsappNumber={whatsappNumber} />
    </section>
  );
}
