"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { WhatsAppLink } from "@/components/WhatsAppButton";
import type { Offer } from "@/lib/types";

export function OfferCard({
  offer,
  whatsappNumber,
}: {
  offer: Offer;
  whatsappNumber: string;
}) {
  const t = useTranslations("Offers");
  const locale = useLocale();
  const isArabic = locale === "ar";

  const title = isArabic ? offer.title_ar : offer.title_en || offer.title_ar;
  const city = isArabic ? offer.city_ar : offer.city_en || offer.city_ar;
  const district = isArabic
    ? offer.district_ar
    : offer.district_en || offer.district_ar;
  const typeLabel = t(`types.${offer.type}`);
  const waMessage = isArabic
    ? `مرحبًا، أرغب بالاستفسار عن عرض "${offer.title_ar}".`
    : `Hello, I'd like to ask about the "${offer.title_en || offer.title_ar}" offer.`;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/offers/${offer.slug}`} className="relative block aspect-[4/3] bg-navy/5">
        {offer.cover_image ? (
          // Plain <img>, not next/image: offer photos are arbitrary
          // external URLs pasted by staff (no Storage upload yet, see
          // CLAUDE.md §12), so there's no fixed set of hosts to
          // allowlist in next.config.ts's image remotePatterns.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={offer.cover_image}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-navy/30">
            {typeLabel}
          </div>
        )}
        <span className="absolute start-3 top-3 rounded-full bg-navy px-3 py-1 text-xs font-semibold text-cream">
          {typeLabel}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/offers/${offer.slug}`}>
          <h3 className="font-heading text-lg font-bold text-navy">{title}</h3>
        </Link>
        <p className="text-sm text-navy/60">
          {city} — {district}
        </p>

        {typeof offer.sold_percentage === "number" && (
          <div className="flex items-center gap-2 text-xs text-navy/60">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy/10">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${Math.min(100, offer.sold_percentage)}%` }}
              />
            </div>
            <span>
              {t("sold")} {offer.sold_percentage}%
            </span>
          </div>
        )}

        <div className="mt-1 flex items-baseline justify-between text-navy">
          <span className="text-xs text-navy/60">{t("priceFrom")}</span>
          <span className="font-heading font-bold">
            {offer.price_from.toLocaleString()} {t("sar")}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-sm text-navy/70">
          <span className="text-xs text-navy/60">{t("areaFrom")}</span>
          <span>
            {offer.area_from} {t("sqm")}
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <WhatsAppLink
            whatsappNumber={whatsappNumber}
            message={waMessage}
            className="flex-1 rounded-full border border-navy px-3 py-2 text-center text-sm font-medium text-navy transition-colors hover:bg-navy hover:text-cream"
          >
            {t("contactUs")}
          </WhatsAppLink>
          <Link
            href={`/offers/${offer.slug}#interest`}
            className="flex-1 rounded-full bg-gold px-3 py-2 text-center text-sm font-medium text-navy transition-opacity hover:opacity-90"
          >
            {t("registerInterest")}
          </Link>
        </div>
      </div>
    </article>
  );
}
