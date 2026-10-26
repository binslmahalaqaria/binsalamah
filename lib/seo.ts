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

/**
 * Google's search result shows the "site name" from WebSite structured data
 * (name + alternateName), not the domain, and the favicon (app/icon.png) beside it.
 */
export function organizationJsonLd(phone?: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": SITE_URL + "/#website",
        name: NAME_AR,
        alternateName: [NAME_EN, "بن سلمه"],
        url: SITE_URL + "/",
        inLanguage: ["ar", "en"],
        publisher: { "@id": SITE_URL + "/#organization" },
      },
      organization(phone),
    ],
  };
}

function organization(phone?: string) {
  return {
    "@type": "RealEstateAgent",
    "@id": SITE_URL + "/#organization",
    name: NAME_AR,
    alternateName: [NAME_EN, ...ALT_NAMES],
    url: SITE_URL,
    logo: SITE_URL + "/brand/logo-full-dark.png",
    sameAs: SOCIAL.map((x) => x.url),
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

/** Company social accounts (client 2026-10-21), shown in the footer and given to Google as sameAs. */
export const SOCIAL = [
  { id: "instagram", label: "Instagram", handle: "binslmahre", url: "https://www.instagram.com/binslmahre" },
  { id: "x", label: "X", handle: "binslmahre", url: "https://x.com/binslmahre" },
  { id: "tiktok", label: "TikTok", handle: "binslmahre", url: "https://www.tiktok.com/@binslmahre" },
  { id: "youtube", label: "YouTube", handle: "binslmahRE", url: "https://www.youtube.com/@binslmahRE" },
] as const;

/** Full public link of a property. */
export const offerUrl = (slug: string, locale = "ar") => `${SITE_URL}/${locale}/offers/${encodeURIComponent(slug)}`;

/** Short link for messages: binslmahre.com/p/<slug tail> (served by app/[locale]/(public)/p/[code]). */
export const shortOfferUrl = (slug: string) => "binslmahre.com/p/" + (slug.split("-").pop() || slug);

/** What an enquiry is about: the property, and optionally one of its units. */
export interface EnquiryOffer {
  title: string; slug: string; district?: string; city?: string; type?: string;
  priceFrom?: number | null; priceTo?: number | null; areaFrom?: number | null; areaTo?: number | null; rooms?: number | null;
}
export interface EnquiryUnit { name: string; price: number; area?: number | null; rooms?: number | null; bathrooms?: number | null }

/**
 * The WhatsApp enquiry a visitor sends (client 2026-10-20: formal, clear, every detail):
 * greeting, the property's details as a short list (or the unit's), the short link, a closing line.
 */
export function enquiryMessage(o: EnquiryOffer, unit?: EnquiryUnit, ar = true) {
  const n = (v: number) => v.toLocaleString("en-US");
  // Words instead of a dash so the order survives right-to-left chat bubbles.
  const range = (a?: number | null, b?: number | null) =>
    a ? (b && b !== a ? (ar ? "من " + n(a) + " إلى " + n(b) : n(a) + " to " + n(b)) : n(a)) : "";
  const cur = ar ? "ريال" : "SAR";
  const m2 = ar ? "م²" : "m²";
  const place = [o.district && (ar && !/^حي\s/.test(o.district) ? "حي " + o.district : o.district), o.city].filter(Boolean).join(ar ? "، " : ", ");
  const row = (label: string, value: string | number | null | undefined) => (value ? "▪️ " + label + ": " + value : "");
  const L = ar
    ? { hi: "السلام عليكم ورحمة الله وبركاته،", intro: unit ? "أرغب بالاستفسار عن الوحدة التالية:" : "أرغب بالاستفسار عن العقار التالي:",
        project: "المشروع", prop: "العقار", unit: "الوحدة", type: "النوع", where: "الموقع", area: "المساحة", rooms: "الغرف", baths: "دورات المياه", price: "السعر",
        link: "رابط العقار", end: "أرجو تزويدي بالتفاصيل الكاملة وطريقة الحجز، وشكراً لكم." }
    : { hi: "Hello,", intro: unit ? "I would like to enquire about the following unit:" : "I would like to enquire about the following property:",
        project: "Project", prop: "Property", unit: "Unit", type: "Type", where: "Location", area: "Area", rooms: "Bedrooms", baths: "Bathrooms", price: "Price",
        link: "Link", end: "Please share the full details and how to reserve. Thank you." };
  const rows = unit
    ? [row(L.project, o.title), row(L.unit, unit.name), row(L.type, o.type), row(L.where, place),
       row(L.area, unit.area ? n(unit.area) + " " + m2 : ""), row(L.rooms, unit.rooms), row(L.baths, unit.bathrooms), row(L.price, n(unit.price) + " " + cur)]
    : [row(L.prop, o.title), row(L.type, o.type), row(L.where, place),
       row(L.area, range(o.areaFrom, o.areaTo) && range(o.areaFrom, o.areaTo) + " " + m2), row(L.rooms, o.rooms),
       row(L.price, range(o.priceFrom, o.priceTo) && range(o.priceFrom, o.priceTo) + " " + cur)];
  return [L.hi, L.intro, "", ...rows.filter(Boolean), "", "🔗 " + L.link + ": " + shortOfferUrl(o.slug), "", L.end].join("\n");
}

/** The message from the site-wide WhatsApp button: a short template the visitor completes. */
export function generalEnquiry(ar = true) {
  return (ar
    ? ["السلام عليكم ورحمة الله وبركاته،", "أتواصل معكم عبر موقع بن سلمه العقارية، وأرغب بالاستفسار عن عقار.", "", "▪️ نوع العقار: ", "▪️ الحي المفضل: ", "▪️ الميزانية التقريبية: ", "", "وشكراً لكم."]
    : ["Hello,", "I am contacting you through the Bin Slmah Real Estate website about a property.", "", "▪️ Property type: ", "▪️ Preferred district: ", "▪️ Approximate budget: ", "", "Thank you."]
  ).join("\n");
}
