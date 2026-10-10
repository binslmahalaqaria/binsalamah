import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getPublishedOfferBySlug } from "@/lib/offers";
import { getPublicContactInfo } from "@/lib/settings";
import { WhatsAppLink } from "@/components/WhatsAppButton";
import { RegisterInterestForm } from "@/components/RegisterInterestForm";

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [offer, locale, t, { whatsappNumber }] = await Promise.all([
    getPublishedOfferBySlug(slug),
    getLocale(),
    getTranslations("Offers"),
    getPublicContactInfo(),
  ]);

  if (!offer) notFound();

  const isArabic = locale === "ar";
  const title = isArabic ? offer.title_ar : offer.title_en || offer.title_ar;
  const city = isArabic ? offer.city_ar : offer.city_en || offer.city_ar;
  const district = isArabic
    ? offer.district_ar
    : offer.district_en || offer.district_ar;
  const description = isArabic
    ? offer.description_ar
    : offer.description_en || offer.description_ar;
  const waMessage = isArabic
    ? `مرحبًا، أرغب بالاستفسار عن عرض "${offer.title_ar}".`
    : `Hello, I'd like to ask about the "${offer.title_en || offer.title_ar}" offer.`;

  return (
    <section className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 py-16 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-navy/5">
          {offer.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offer.images[0].url}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        {offer.images.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {offer.images.slice(1, 5).map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={img.url}
                alt={`${title} ${i + 2}`}
                className="aspect-square rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <span className="w-fit rounded-full bg-navy px-3 py-1 text-xs font-semibold text-cream">
          {t(`types.${offer.type}`)}
        </span>
        <h1 className="font-heading text-3xl font-bold text-navy">{title}</h1>
        <p className="text-navy/60">
          {city} — {district}
        </p>

        <div className="flex flex-wrap gap-6 rounded-2xl bg-navy/5 p-4 text-sm">
          <div>
            <div className="text-navy/50">{t("priceFrom")}</div>
            <div className="font-heading font-bold text-navy">
              {offer.price_from.toLocaleString("en-US")} {t("sar")}
            </div>
          </div>
          <div>
            <div className="text-navy/50">{t("areaFrom")}</div>
            <div className="font-heading font-bold text-navy">
              {offer.area_from} {t("sqm")}
            </div>
          </div>
          {offer.rooms && (
            <div>
              <div className="text-navy/50">{isArabic ? "الغرف" : "Rooms"}</div>
              <div className="font-heading font-bold text-navy">{offer.rooms}</div>
            </div>
          )}
          {offer.bathrooms && (
            <div>
              <div className="text-navy/50">{isArabic ? "الحمامات" : "Bathrooms"}</div>
              <div className="font-heading font-bold text-navy">{offer.bathrooms}</div>
            </div>
          )}
        </div>

        {description && (
          <div>
            <h2 className="mb-1 font-heading font-bold text-navy">
              {locale === "ar" ? "الوصف" : "Description"}
            </h2>
            <p className="whitespace-pre-line text-navy/80">{description}</p>
          </div>
        )}

        <WhatsAppLink
          whatsappNumber={whatsappNumber}
          message={waMessage}
          className="w-fit rounded-full border border-navy px-5 py-2.5 font-medium text-navy transition-colors hover:bg-navy hover:text-cream"
        >
          {t("contactUs")}
        </WhatsAppLink>

        <RegisterInterestForm offerId={offer.id} />
      </div>
    </section>
  );
}
