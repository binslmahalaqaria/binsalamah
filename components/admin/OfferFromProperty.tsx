"use client";

/**
 * New website offer, optionally started from a CRM property (`?from=<propertyId>`):
 * name, type, district, price, area, rooms, photos, features and units are copied
 * into the form, so a property is entered once and only reviewed before publishing.
 */
import { useSearchParams } from "next/navigation";
import { useCrm } from "@/lib/crm/store";
import { unitsOf } from "@/lib/crm/logic";
import type { Property } from "@/lib/crm/types";
import type { Offer, OfferType, UnitStatus } from "@/lib/types";
import { OfferForm } from "./OfferForm";

const TYPE: Record<string, OfferType> = { "فيلا": "villa", "فلل": "villa", "شقة": "apartment", "شقق": "apartment", "دور": "floor", "تاون هاوس": "townhouse", "بنتهاوس": "penthouse", "أرض": "land" };
const UNIT_STATUS: Record<string, UnitStatus> = { "محجوز": "reserved", "مباع": "sold" };

function toOffer(p: Property): Offer {
  const units = unitsOf(p).map((u) => ({
    name: u.name, area: u.area || 0, price: u.price || 0, rooms: u.bedrooms ?? null, living_rooms: null, bathrooms: null,
    status: UNIT_STATUS[u.status || ""] || ("available" as UnitStatus),
  }));
  const prices = units.map((u) => u.price).filter(Boolean);
  const areas = units.map((u) => u.area).filter(Boolean);
  return {
    id: "", slug: "", status: "draft", created_at: 0, updated_at: 0, created_by: "", updated_by: "",
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

export function OfferFromProperty() {
  const id = useSearchParams().get("from");
  const { data, loaded } = useCrm();
  if (!id) return <OfferForm />;
  if (!loaded) return <p className="text-sm text-navy/50">جارٍ تحميل بيانات العقار…</p>;
  const p = data.props.find((x) => x.id === id);
  if (!p) return <OfferForm />;
  return (
    <>
      <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm text-navy">
        نُقلت بيانات «{p.title}» من العقارات. راجعها وأضف الوصف والصور إن لزم، ثم احفظ وانشر.
      </p>
      <OfferForm key={id} prefill={toOffer(p)} />
    </>
  );
}
