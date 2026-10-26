/**
 * A CRM property → a website listing (offer). Used by the pre-filled form (components/admin/OfferFromProperty.tsx)
 * and by the one-click «تفعيل في الموقع» on the property card. The listing is a COPY: editing it afterwards
 * (description, photos, price shown…) never changes the CRM property.
 */
import { unitsOf } from "./logic";
import type { Property } from "./types";
import type { Offer, OfferType, UnitStatus } from "@/lib/types";
import { createOffer } from "@/lib/offers";
import { fillEnglish } from "@/lib/translate-offer";
import { canPublishOffer, deriveFromUnits, offerFormSchema } from "@/lib/validators";

const TYPE: Record<string, OfferType> = { "فيلا": "villa", "فلل": "villa", "شقة": "apartment", "شقق": "apartment", "دور": "floor", "تاون هاوس": "townhouse", "بنتهاوس": "penthouse", "أرض": "land" };
const UNIT_STATUS: Record<string, UnitStatus> = { "محجوز": "reserved", "مباع": "sold" };

export function toOffer(p: Property): Offer {
  const units = unitsOf(p).map((u) => ({
    name: u.name, area: u.area || 0, price: u.price || 0, rooms: u.bedrooms ?? null, living_rooms: null, bathrooms: null,
    status: UNIT_STATUS[u.status || ""] || ("available" as UnitStatus),
  }));
  const prices = units.map((u) => u.price).filter(Boolean);
  const areas = units.map((u) => u.area).filter(Boolean);
  return {
    id: "", property_id: p.id, slug: "", status: "draft", created_at: 0, updated_at: 0, created_by: "", updated_by: "",
    title_ar: p.title, title_en: "", type: TYPE[p.type || ""] || "other",
    city_ar: p.city || "الرياض", city_en: "", district_ar: (p.district || "").replace(/^حي\s+/, ""), district_en: "",
    price_from: prices.length ? Math.min(...prices) : p.price || 0, price_to: prices.length > 1 ? Math.max(...prices) : null,
    area_from: areas.length ? Math.min(...areas) : p.area || 0, area_to: areas.length > 1 ? Math.max(...areas) : null,
    rooms: p.bedrooms ?? null, bathrooms: p.bathrooms ?? null, living_rooms: p.livingRooms ?? null,
    description_ar: [p.features, p.notes].filter(Boolean).join("\n"), description_en: "",
    images: (p.images || []).map((url, order) => ({ url, order })), cover_image: p.images?.[0] || "",
    sold_percentage: null, featured: false, units,
    features: String(p.features || "").split(/[،,\n]/).map((x) => x.trim()).filter(Boolean),
    map_url: p.link || "", video_url: p.videoLink || "",
  } as Offer;
}


/** One-click: creates the website listing from the property and publishes it. Returns an error message, or null when done. */
export async function activateOnSite(p: Property, uid: string, idToken: string): Promise<string | null> {
  const o = toOffer(p);
  const images = (p.images || []).filter(Boolean).map((url, order) => ({ url, order }));
  if (!images.length) return "أضف صورة واحدة على الأقل للعقار قبل التفعيل في الموقع";
  const parsed = offerFormSchema.safeParse(deriveFromUnits({ ...o, description_ar: o.description_ar || p.title } as never));
  if (!parsed.success) {
    const miss = parsed.error.issues.map((i) => String(i.path[0])).filter(Boolean);
    const AR: Record<string, string> = { price_from: "السعر", area_from: "المساحة", district_ar: "الحي", title_ar: "الاسم", city_ar: "المدينة", type: "النوع", map_url: "رابط الموقع", video_url: "رابط الفيديو" };
    return "أكمل بيانات العقار أولاً: " + Array.from(new Set(miss.map((m) => AR[m] || m))).join("، ");
  }
  if (!canPublishOffer({ ...parsed.data, images })) return "أضف صورة واحدة على الأقل";
  const data = await fillEnglish(parsed.data, idToken);
  // Firestore refuses `undefined` (e.g. an English field the translation left out): drop those keys, deeply.
  const clean = <T,>(v: T): T => Array.isArray(v) ? (v.map(clean) as unknown as T)
    : v && typeof v === "object" ? (Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== undefined).map(([k, x]) => [k, clean(x)])) as T) : v;
  await createOffer(clean({ ...data, images, property_id: p.id }), "published", uid);
  return null;
}
