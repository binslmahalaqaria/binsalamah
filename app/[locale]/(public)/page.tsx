import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OfferCard } from "@/components/OfferCard";
import { listPublishedOffers } from "@/lib/offers";
import { getPublicContactInfo } from "@/lib/settings";

export default async function HomePage() {
  const t = await getTranslations("Home");
  const [offers, { whatsappNumber }] = await Promise.all([
    listPublishedOffers(3),
    getPublicContactInfo(),
  ]);

  const whyItems = [
    { title: t("why1Title"), body: t("why1Body") },
    { title: t("why2Title"), body: t("why2Body") },
    { title: t("why3Title"), body: t("why3Body") },
  ];

  return (
    <>
      <section className="bg-navy px-6 py-24 text-center text-cream">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
          <h1 className="font-heading text-4xl font-black sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="text-lg text-cream/80">{t("heroSubtitle")}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/offers"
              className="rounded-full bg-gold px-6 py-3 font-medium text-navy transition-opacity hover:opacity-90"
            >
              {t("browseOffers")}
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-cream/40 px-6 py-3 font-medium text-cream transition-colors hover:bg-cream/10"
            >
              {t("contactUs")}
            </Link>
          </div>
        </div>
      </section>

      {offers.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-heading text-2xl font-bold text-navy">
              {t("featuredTitle")}
            </h2>
            <Link href="/offers" className="text-sm font-medium text-gold hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} whatsappNumber={whatsappNumber} />
            ))}
          </div>
        </section>
      )}

      <section className="bg-cream px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center font-heading text-2xl font-bold text-navy">
            {t("whyTitle")}
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {whyItems.map((item) => (
              <div key={item.title} className="text-center">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gold" />
                <h3 className="mb-2 font-heading font-bold text-navy">{item.title}</h3>
                <p className="text-sm text-navy/70">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
