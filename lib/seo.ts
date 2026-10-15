/**
 * Search & sharing basics for the public site: the canonical domain, the
 * company's names (so a search for «بن سلمه العقارية» finds it), and the
 * schema.org card Google reads (RealEstateAgent).
 */
export const SITE_URL = "https://www.binslmahre.com";
export const NAME_AR = "بن سلمه العقارية";
export const NAME_EN = "Bin Slmah Real Estate";
/** Spellings people actually type. */
export const ALT_NAMES = ["بن سلمة العقارية", "بن سلمه للعقار", "بن سلمه", "Bin Salamah Real Estate", "Binslmah", "binslmahre"];
export const DESC_AR = "بن سلمه العقارية — شركة تسويق ووساطة عقارية في الرياض. فلل وشقق وأدوار وتاون هاوس للبيع في شمال الرياض وجميع الأحياء، مع مستشار مخصص من أول تواصل حتى إتمام الصفقة.";
export const DESC_EN = "Bin Slmah Real Estate — real estate marketing and brokerage in Riyadh. Villas, apartments, floors and townhouses for sale, with a dedicated advisor from the first call to the closing.";
export const KEYWORDS = ["بن سلمه العقارية", "بن سلمة العقارية", "عقارات الرياض", "فلل للبيع الرياض", "شقق للبيع الرياض", "أدوار للبيع الرياض", "تاون هاوس الرياض", "شمال الرياض", "مكتب عقار النرجس", "Bin Slmah Real Estate", "Riyadh real estate"];
export const ADDRESS = { street: "طريق عثمان بن عفان", district: "حي النرجس", city: "الرياض", country: "SA" };

export function organizationJsonLd(phone?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": SITE_URL + "/#organization",
    name: NAME_AR,
    alternateName: [NAME_EN, ...ALT_NAMES],
    url: SITE_URL,
    logo: SITE_URL + "/brand/logo-full-dark.png",
    image: SITE_URL + "/og.jpg",
    description: DESC_AR,
    ...(phone ? { telephone: "+" + phone.replace(/\D/g, "") } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: ADDRESS.street + "، " + ADDRESS.district,
      addressLocality: ADDRESS.city,
      addressCountry: ADDRESS.country,
    },
    areaServed: { "@type": "City", name: "Riyadh" },
    knowsLanguage: ["ar", "en"],
  };
}

/** Full public link of a property. */
export const offerUrl = (slug: string, locale = "ar") => `${SITE_URL}/${locale}/offers/${encodeURIComponent(slug)}`;

/** Short link for messages: binslmahre.com/p/<slug tail> (served by app/[locale]/(public)/p/[code]). */
export const shortOfferUrl = (slug: string) => "binslmahre.com/p/" + (slug.split("-").pop() || slug);

/**
 * The WhatsApp enquiry a visitor sends: three short lines — greeting, what
 * (property, or unit + price), and the short link.
 */
export function enquiryMessage(o: { title: string; district?: string; slug: string }, unit?: { name: string; price: number }, ar = true) {
  const what = unit
    ? `${unit.name} — ${o.title} (${unit.price.toLocaleString("en-US")} ${ar ? "ريال" : "SAR"})`
    : o.title + (o.district ? " — " + o.district : "");
  return [ar ? "السلام عليكم، أستفسر عن:" : "Hello, I'm interested in:", what, shortOfferUrl(o.slug)].join("\n");
}
