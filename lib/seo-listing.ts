/**
 * Search data for property pages and district pages (client 2026-11-08: «أي عميل يدور على عقارنا نطلع له فوق»).
 * Titles name the type, district and city the way people search («فلل للبيع في حي الملقا، الرياض»), and each page
 * carries schema.org RealEstateListing / ItemList / BreadcrumbList data for Google.
 */
import type { Offer, OfferType } from "./types";
import { NAME_AR, NAME_EN, SITE_URL, offerUrl } from "./seo";

const TYPE_AR: Record<OfferType, [string, string]> = {
  villa: ["فيلا", "فلل"], apartment: ["شقة", "شقق"], floor: ["دور", "أدوار"], townhouse: ["تاون هاوس", "تاون هاوس"], penthouse: ["بنتهاوس", "بنتهاوس"],
  land: ["أرض", "أراضي"], building: ["عمارة", "عمائر"], palace: ["قصر", "قصور"], farm: ["مزرعة", "مزارع"], resthouse: ["استراحة", "استراحات"], other: ["عقار", "عقارات"],
};
const TYPE_EN: Record<OfferType, [string, string]> = {
  villa: ["Villa", "Villas"], apartment: ["Apartment", "Apartments"], floor: ["Floor", "Floors"], townhouse: ["Townhouse", "Townhouses"], penthouse: ["Penthouse", "Penthouses"],
  land: ["Land", "Land plots"], building: ["Building", "Buildings"], palace: ["Palace", "Palaces"], farm: ["Farm", "Farms"], resthouse: ["Rest house", "Rest houses"], other: ["Property", "Properties"],
};
export const typeWord = (t: OfferType, ar: boolean, plural = false) => (ar ? TYPE_AR : TYPE_EN)[t]?.[plural ? 1 : 0] || (ar ? "عقار" : "Property");

/** Link to the page of a district's listings. */
export const districtPath = (district: string) => "/area/" + encodeURIComponent(district.trim());
const num = (n: number) => n.toLocaleString("en-US");

/** «فيلا للبيع في حي الصحافة، الرياض». */
export function listingHeadline(o: Offer, ar: boolean) {
  const d = ar ? o.district_ar : o.district_en || o.district_ar;
  const c = ar ? o.city_ar : o.city_en || o.city_ar;
  return ar ? `${typeWord(o.type, true)} للبيع في حي ${d}، ${c}` : `${typeWord(o.type, false)} for sale in ${d}, ${c}`;
}

/** A description built from the facts when the listing has none (or to lead it). */
export function listingSummary(o: Offer, ar: boolean) {
  const parts = [listingHeadline(o, ar)];
  if (o.area_from) parts.push(ar ? `المساحة ${o.area_to ? "من " + num(o.area_from) + " إلى " + num(o.area_to) : num(o.area_from)} م²` : `area ${num(o.area_from)}${o.area_to ? "–" + num(o.area_to) : ""} m²`);
  if (o.rooms) parts.push(ar ? `${o.rooms} غرف` : `${o.rooms} bedrooms`);
  if (o.price_from) parts.push(ar ? `السعر يبدأ من ${num(o.price_from)} ريال` : `from SAR ${num(o.price_from)}`);
  parts.push(ar ? `من ${NAME_AR}` : `from ${NAME_EN}`);
  return parts.join(ar ? "، " : ", ") + ".";
}

/** schema.org data for one property page. */
export function listingJsonLd(o: Offer, locale: string) {
  const ar = locale === "ar";
  const url = offerUrl(o.slug, locale);
  const images = [...(o.images || [])].sort((a, b) => a.order - b.order).map((i) => i.url).filter(Boolean);
  const d = ar ? o.district_ar : o.district_en || o.district_ar;
  const soldOut = (o.sold_percentage ?? 0) >= 100;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateListing",
        "@id": url + "#listing",
        name: ar ? o.title_ar : o.title_en || o.title_ar,
        headline: listingHeadline(o, ar),
        description: ((ar ? o.description_ar : o.description_en || o.description_ar) || listingSummary(o, ar)).slice(0, 500),
        url,
        inLanguage: locale,
        image: images.length ? images.slice(0, 8) : undefined,
        datePosted: o.created_at ? new Date(o.created_at).toISOString() : undefined,
        dateModified: o.updated_at ? new Date(o.updated_at).toISOString() : undefined,
        provider: { "@id": SITE_URL + "/#organization" },
        contentLocation: {
          "@type": "Place",
          name: d,
          address: { "@type": "PostalAddress", addressLocality: ar ? o.city_ar : o.city_en || o.city_ar, addressRegion: d, addressCountry: "SA" },
        },
        ...(o.price_from ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "SAR",
            ...(o.price_to && o.price_to !== o.price_from
              ? { priceSpecification: { "@type": "PriceSpecification", minPrice: o.price_from, maxPrice: o.price_to, priceCurrency: "SAR" } }
              : { price: o.price_from }),
            availability: soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
            url,
            seller: { "@id": SITE_URL + "/#organization" },
          },
        } : {}),
        ...(o.area_from ? { floorSize: { "@type": "QuantitativeValue", value: o.area_from, unitCode: "MTK" } } : {}),
        ...(o.rooms ? { numberOfRooms: o.rooms } : {}),
      },
      breadcrumb(locale, [
        [ar ? "العقارات" : "Properties", `${SITE_URL}/${locale}/offers`],
        ...(o.district_ar ? [[ar ? "حي " + d : d, `${SITE_URL}/${locale}${districtPath(o.district_ar)}`] as [string, string]] : []),
        [ar ? o.title_ar : o.title_en || o.title_ar, url],
      ]),
    ],
  };
}

/** schema.org data for a district page: the list of its properties. */
export function districtJsonLd(district: string, offers: Offer[], locale: string) {
  const ar = locale === "ar";
  const url = `${SITE_URL}/${locale}${districtPath(district)}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        "@id": url + "#list",
        name: ar ? `عقارات للبيع في حي ${district}، الرياض` : `Properties for sale in ${district}, Riyadh`,
        numberOfItems: offers.length,
        itemListElement: offers.map((o, i) => ({ "@type": "ListItem", position: i + 1, url: offerUrl(o.slug, locale), name: ar ? o.title_ar : o.title_en || o.title_ar })),
      },
      breadcrumb(locale, [[ar ? "العقارات" : "Properties", `${SITE_URL}/${locale}/offers`], [ar ? "حي " + district : district, url]]),
    ],
  };
}

function breadcrumb(locale: string, items: [string, string][]) {
  const all: [string, string][] = [[locale === "ar" ? "الرئيسية" : "Home", `${SITE_URL}/${locale}`], ...items];
  return { "@type": "BreadcrumbList", itemListElement: all.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })) };
}

/** Districts that have at least one published listing, with their counts (for links and the sitemap). */
export function districtsOf(offers: Offer[]) {
  const m = new Map<string, number>();
  for (const o of offers) if (o.district_ar?.trim() && (o.sold_percentage ?? 0) < 100) m.set(o.district_ar.trim(), (m.get(o.district_ar.trim()) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"));
}
