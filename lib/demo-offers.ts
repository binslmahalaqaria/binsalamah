import type { Offer } from "./types";

/**
 * Sample offers for reviewing the public design locally (`/?demo=1`,
 * `/offers?demo=1`). Never used in production builds — see `withDemo`.
 */
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=70`;
const base = { city_ar: "الرياض", city_en: "Riyadh", images: [], description_en: "", status: "published" as const, created_at: 0, updated_at: 0, created_by: "", updated_by: "" };

const DEMO: Offer[] = [
  { ...base, id: "d1", units: [{ name: "فيلا A", area: 300, price: 3900000, rooms: 5, living_rooms: 3, bathrooms: 6, status: "sold" as const }, { name: "فيلا B", area: 320, price: 4050000, rooms: 5, living_rooms: 3, bathrooms: 6, status: "available" as const }, { name: "فيلا C", area: 340, price: 4200000, rooms: 5, living_rooms: 3, bathrooms: 6, status: "reserved" as const }, { name: "فيلا D", area: 360, price: 4350000, rooms: 6, living_rooms: 3, bathrooms: 7, status: "available" as const }], slug: "demo-1", title_ar: "فلل الملقا ريزيدنس", title_en: "Malqa Residence Villas", type: "villa", district_ar: "الملقا", district_en: "Al Malqa", price_from: 3_900_000, price_to: 4_350_000, area_from: 300, area_to: 360, rooms: 5, bathrooms: 6, cover_image: img("photo-1613490493576-7fde63acd811"), description_ar: "فلل عصرية بتصميم معماري فاخر في قلب حي الملقا، قريبة من طريق الملك فهد والخدمات.", sold_percentage: 25, featured: true },
  { ...base, id: "d2", developer: "شركة النخبة للتطوير العقاري", stage: "ready" as const, handover: "فوري", warranties_text: "ضمان الهيكل الإنشائي 10 سنوات من المطوّر\nضمان العزل المائي والحراري 10 سنوات\nضمان السباكة والكهرباء 5 سنوات\nضمان الأجهزة الذكية والمصاعد سنتان\nصيانة مجانية لمدة سنة من تاريخ الاستلام", features: ["مدخل مستقل", "سطح خاص", "نظام منزل ذكي", "مواقف مظللة", "غرفة سائق", "تكييف مركزي"], map_url: "https://maps.google.com/?q=24.860,46.660", units: [{ name: "دور أرضي", area: 300, price: 1580000, rooms: 4, living_rooms: 2, bathrooms: 4, status: "available" as const }, { name: "دور أول", area: 190, price: 1150000, rooms: 4, living_rooms: 2, bathrooms: 4, status: "sold" as const }, { name: "دور أول (شمالي)", area: 195, price: 1190000, rooms: 4, living_rooms: 2, bathrooms: 4, status: "sold" as const }, { name: "ملحق علوي", area: 210, price: 1250000, rooms: 3, living_rooms: 2, bathrooms: 3, status: "available" as const }], slug: "demo-2", title_ar: "أدوار النرجس 12", title_en: "Narjis Floors 12", type: "floor", district_ar: "النرجس", district_en: "An Narjis", price_from: 1_150_000, price_to: 1_580_000, area_from: 190, area_to: 300, rooms: 4, bathrooms: 4, cover_image: img("photo-1600596542815-ffad4c1539a9"), description_ar: "أدوار أرضية وعلوية بمداخل مستقلة وسطح خاص.", sold_percentage: 50, featured: true },
  { ...base, id: "d3", slug: "demo-3", title_ar: "تاون هاوس حطين", title_en: "Hittin Townhouses", type: "townhouse", district_ar: "حطين", district_en: "Hittin", price_from: 2_690_000, price_to: 2_990_000, area_from: 269, area_to: 346, rooms: 5, bathrooms: 5, cover_image: img("photo-1600585154340-be6161a56a0c"), description_ar: "تاون هاوس بثلاثة أدوار وحديقة خاصة.", sold_percentage: 14, featured: true },
  { ...base, id: "d4", slug: "demo-4", title_ar: "شقق الياسمين بارك", title_en: "Yasmin Park Apartments", type: "apartment", district_ar: "الياسمين", district_en: "Al Yasmin", price_from: 710_000, price_to: 1_327_000, area_from: 75, area_to: 176, rooms: 3, bathrooms: 3, cover_image: img("photo-1600607687939-ce8a6c25118c"), description_ar: "شقق ذكية بمساحات متنوعة ومواقف خاصة.", sold_percentage: 10, featured: false },
  { ...base, id: "d5", slug: "demo-5", title_ar: "فلل العارض الحديثة", title_en: "Arid Modern Villas", type: "villa", district_ar: "العارض", district_en: "Al Arid", price_from: 1_960_000, price_to: 2_310_000, area_from: 299, area_to: 312, rooms: 6, bathrooms: 5, cover_image: img("photo-1605276374104-dee2a0ed3cd6"), description_ar: "فلل دوبلكس بتشطيبات عالية.", sold_percentage: 100, featured: false },
  { ...base, id: "d6", units: [{ name: "دور أرضي", area: 303, price: 2300000, rooms: 5, living_rooms: 3, bathrooms: 4, status: "available" as const }, { name: "دور أول", area: 265, price: 1790000, rooms: 5, living_rooms: 3, bathrooms: 4, status: "available" as const }, { name: "دور أول (غربي)", area: 270, price: 1850000, rooms: 5, living_rooms: 3, bathrooms: 4, status: "sold" as const }], slug: "demo-6", title_ar: "أدوار الملقا 7", title_en: "Malqa Floors 7", type: "floor", district_ar: "الملقا", district_en: "Al Malqa", price_from: 1_790_000, price_to: 2_300_000, area_from: 265, area_to: 303, rooms: 5, bathrooms: 4, cover_image: img("photo-1600566753190-17f0baa2a6c3"), description_ar: "أدوار واسعة قريبة من المدارس والحدائق.", sold_percentage: 33, featured: false },
];

export const withDemo = (offers: Offer[], demo: unknown) =>
  process.env.NODE_ENV !== "production" && demo === "1" ? [...offers, ...DEMO] : offers;

/** A sample offer by slug for the local design review (never in production). */
export const demoOffer = (slug: string) => {
  if (process.env.NODE_ENV === "production") return null;
  const o = DEMO.find((x) => x.slug === slug);
  // Give the sample a gallery: its own photo first, then the other samples' photos.
  return o ? { ...o, images: [o, ...DEMO.filter((x) => x !== o)].map((x, order) => ({ url: x.cover_image || "", order })) } : null;
};
