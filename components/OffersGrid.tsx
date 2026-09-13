"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { OfferCard } from "@/components/OfferCard";
import type { Offer, OfferType } from "@/lib/types";

const TYPES: OfferType[] = ["apartment", "villa", "floor", "townhouse", "land", "other"];

export function OffersGrid({
  offers,
  whatsappNumber,
}: {
  offers: Offer[];
  whatsappNumber: string;
}) {
  const t = useTranslations("Offers");
  const locale = useLocale();
  const isArabic = locale === "ar";
  const [type, setType] = useState<string>("all");
  // Cities are keyed by city_ar (always present, canonical) but the
  // dropdown label follows the active locale.
  const [city, setCity] = useState<string>("all");

  const cities = useMemo(() => {
    const map = new Map<string, string>();
    offers.forEach((o) => map.set(o.city_ar, isArabic ? o.city_ar : o.city_en || o.city_ar));
    return Array.from(map.entries());
  }, [offers, isArabic]);

  const filtered = offers.filter((o) => {
    if (type !== "all" && o.type !== type) return false;
    if (city !== "all" && o.city_ar !== city) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-full border border-navy/20 bg-white px-4 py-2 text-sm text-navy"
        >
          <option value="all">{t("filterType")}: {t("filterAll")}</option>
          {TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {t(`types.${tp}`)}
            </option>
          ))}
        </select>

        {cities.length > 0 && (
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-full border border-navy/20 bg-white px-4 py-2 text-sm text-navy"
          >
            <option value="all">{t("allCities")}</option>
            {cities.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-navy/60">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((offer) => (
            <OfferCard key={offer.id} offer={offer} whatsappNumber={whatsappNumber} />
          ))}
        </div>
      )}
    </div>
  );
}
