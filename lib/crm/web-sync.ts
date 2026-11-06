/**
 * Property ⇄ website listing, kept in step both ways (client 2026-11-05: «العقارات من الموقع والنظام مرتبطة،
 * إذا عدلت شيء يتعدل هناك»). A listing made with «اعرضه في الموقع» stores `property_id`.
 *   - Saving the property in the CRM (or a deal changing a unit's status) updates the listing's shared fields.
 *   - Saving the listing in the admin form updates the property's shared fields.
 * Shared: name, type, city, district, photos, rooms, bathrooms, living rooms, map / video / brochure links
 * (map and brochure in the listing's staff-only doc, see lib/offers.ts), features, units (name, area, price, rooms, status) and, without units, price and area. Each side writes the
 * other directly (never through the function that syncs), so there is no loop. Not shared: descriptions, the
 * ribbon, developer, warranties, English text (English of a changed Arabic field is cleared and re-translated
 * the next time the listing is saved).
 */
import { collection, doc, getDoc, getDocs, query, updateDoc, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { saveOfferLinks } from "@/lib/offers";
import { deriveFromUnits } from "@/lib/validators";
import type { Offer, OfferType, OfferUnit, UnitStatus } from "@/lib/types";
import { assertWritable } from "./preview";
import { unitsOf } from "./logic";
import { nowStamp } from "./util";
import type { Property, Unit } from "./types";

const TYPE: Record<string, OfferType> = { "فيلا": "villa", "فلل": "villa", "شقة": "apartment", "شقق": "apartment", "دور": "floor", "تاون هاوس": "townhouse", "بنتهاوس": "penthouse", "أرض": "land", "قصر": "palace", "مزرعة": "farm", "استراحة": "resthouse", "عمارة": "building" };
const TYPE_AR: Partial<Record<OfferType, string>> = { villa: "فيلا", apartment: "شقة", floor: "دور", townhouse: "تاون هاوس", penthouse: "بنتهاوس", land: "أرض", palace: "قصر", farm: "مزرعة", resthouse: "استراحة", building: "عمارة" };
const TO_WEB: Record<string, UnitStatus> = { "محجوز": "reserved", "مباع": "sold" };
const TO_CRM: Record<UnitStatus, string> = { available: "متاح", reserved: "محجوز", sold: "مباع" };
const webStatus = (s: string | null | undefined): UnitStatus => TO_WEB[s || ""] || "available";

const blank = (v: unknown) => v === null || v === undefined || v === "";
const same = (a: unknown, b: unknown) => (blank(a) && blank(b)) || JSON.stringify(a) === JSON.stringify(b);
const noPrefix = (s: string | null | undefined) => (s || "").replace(/^حي\s+/, "").trim();
const splitList = (s: string | null | undefined) => String(s || "").split(/[،,\n]/).map((x) => x.trim()).filter(Boolean);

/** Which unit of `list` stands for `name`: the same name, else (same number of units) the same position. */
function pick<T extends { name: string }>(list: T[], name: string, i: number, otherNames: string[]): T | undefined {
  return list.find((x) => x.name === name) ?? (list.length === otherNames.length && !otherNames.includes(list[i]?.name) ? list[i] : undefined);
}

/** What the listing should take from the property: only the fields that differ. */
export function offerPatch(p: Property, o: Offer): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const put = (k: string, v: unknown, en?: string) => {
    if (same((o as unknown as Record<string, unknown>)[k], v)) return;
    patch[k] = v ?? null;
    if (en) patch[en] = "";
  };
  if (p.title?.trim()) put("title_ar", p.title.trim(), "title_en");
  const t = TYPE[p.type || ""];
  if (t) put("type", t);
  if (p.city) put("city_ar", p.city, "city_en");
  if (p.district && noPrefix(p.district) !== o.district_ar) { patch.district_ar = noPrefix(p.district); patch.district_en = ""; }

  const urls = (p.images || []).filter(Boolean);
  if (urls.length && !same((o.images || []).map((x) => x.url), urls)) {
    patch.images = urls.map((url, order) => ({ ...(o.images || []).find((x) => x.url === url), url, order }));
    patch.cover_image = urls[0];
  }
  if (p.bedrooms != null) put("rooms", p.bedrooms);
  if (p.bathrooms != null) put("bathrooms", p.bathrooms);
  if (p.livingRooms != null) put("living_rooms", p.livingRooms);
  put("video_url", p.videoLink || "");
  const feats = splitList(p.features);
  if (!same(o.features || [], feats)) { patch.features = feats; patch.features_en = []; }

  const pu = unitsOf(p);
  if (pu.length) {
    const ou: OfferUnit[] = o.units || [];
    const names = pu.map((u) => u.name);
    const complete = pu.every((u) => (u.area || 0) > 0 && (u.price || 0) > 0 && u.name);
    let units: OfferUnit[];
    if (complete) {
      units = pu.map((u, i) => {
        const m = pick(ou, u.name, i, names);
        const { name_en, ...rest } = (m || {}) as OfferUnit;
        return {
          ...rest, ...(m && m.name === u.name && name_en ? { name_en } : {}),
          name: u.name, area: u.area || 0, price: u.price || 0, rooms: u.bedrooms ?? m?.rooms ?? null,
          living_rooms: m?.living_rooms ?? null, bathrooms: m?.bathrooms ?? null, status: webStatus(u.status),
        } as OfferUnit;
      });
    } else {
      // Half-filled units in the CRM: only the statuses of units that exist on both sides follow.
      units = ou.map((x) => { const c = pu.find((u) => u.name === x.name); return c ? { ...x, status: webStatus(c.status) } : x; });
    }
    if (units.length && !same(ou, units)) patch.units = units;
    if (units.length) {
      const d = deriveFromUnits({ ...o, ...patch, units } as never) as Offer;
      for (const k of ["price_from", "price_to", "area_from", "area_to", "rooms", "bathrooms", "living_rooms", "sold_percentage"] as const) {
        if (!same(o[k], d[k])) patch[k] = d[k] ?? null;
      }
    }
  } else {
    if ((p.price || 0) > 0) put("price_from", p.price);
    if ((p.area || 0) > 0) put("area_from", p.area);
    if (p.status === "مباع") put("sold_percentage", 100);
    else if (o.sold_percentage === 100 && !(o.units || []).length) patch.sold_percentage = null;
  }
  return patch;
}

/** What the property should take from the listing: only the fields that differ. */
export function propertyPatch(o: Offer, p: Property): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const put = (k: string, v: unknown) => { if (!same((p as unknown as Record<string, unknown>)[k], v)) patch[k] = v ?? null; };
  if (o.title_ar?.trim()) put("title", o.title_ar.trim());
  if (o.type && TYPE[p.type || ""] !== o.type && TYPE_AR[o.type]) patch.type = TYPE_AR[o.type];
  if (o.city_ar) put("city", o.city_ar);
  if (o.district_ar && noPrefix(p.district) !== o.district_ar) patch.district = (/^حي\s/.test(p.district || "") ? "حي " : "") + o.district_ar;
  const urls = (o.images || []).slice().sort((a, b) => a.order - b.order).map((x) => x.url).filter(Boolean);
  if (urls.length && !same(p.images || [], urls)) patch.images = urls;
  if (o.rooms != null) put("bedrooms", o.rooms);
  if (o.bathrooms != null) put("bathrooms", o.bathrooms);
  if (o.living_rooms != null) put("livingRooms", o.living_rooms);
  put("link", o.map_url || null);
  put("videoLink", o.video_url || null);
  put("pdfUrl", o.brochure_url || null);
  const feats = (o.features || []).map((x) => x.trim()).filter(Boolean);
  if (!same(splitList(p.features), feats)) patch.features = feats.length ? feats.join("، ") : null;

  const ou = (o.units || []).filter((x) => x.name?.trim());
  if (ou.length) {
    const pu = unitsOf(p);
    const names = ou.map((x) => x.name);
    const units: Unit[] = ou.map((x, i) => {
      const m = pick(pu, x.name, i, names);
      const keep = m && webStatus(m.status) === (x.status || "available");
      return { ...(m || {}), name: x.name, area: x.area || null, price: x.price || null, bedrooms: x.rooms ?? m?.bedrooms ?? null, status: keep ? m!.status : TO_CRM[x.status || "available"] };
    });
    if (!same(pu, units)) patch.units = units;
  } else {
    if ((o.price_from || 0) > 0) put("price", o.price_from);
    if ((o.area_from || 0) > 0) put("area", o.area_from);
  }
  return patch;
}

/** Property saved in the CRM → its website listings. Reads the property back so the whole record is compared. */
export async function pushPropertyToOffers(propertyId: string) {
  const ps = await getDoc(doc(db, "properties", propertyId));
  if (!ps.exists()) return;
  const p = { ...(ps.data() as Property), id: ps.id };
  const snap = await getDocs(query(collection(db, "offers"), where("property_id", "==", propertyId)));
  for (const d of snap.docs) {
    const patch = offerPatch(p, d.data() as Offer);
    if (Object.keys(patch).length) await updateDoc(d.ref, { ...patch, updated_at: serverTimestamp() });
    await saveOfferLinks(d.id, { map_url: p.link, brochure_url: p.pdfUrl });
  }
}

/** Listing saved in the admin form → its CRM property. `o` is the listing as just saved. */
export async function pushOfferToProperty(propertyId: string, o: Offer) {
  assertWritable();
  const ref = doc(db, "properties", propertyId);
  const ps = await getDoc(ref);
  if (!ps.exists()) return;
  const patch = propertyPatch(o, { ...(ps.data() as Property), id: ps.id });
  if (!Object.keys(patch).length) return;
  await updateDoc(ref, JSON.parse(JSON.stringify({ ...patch, updatedAt: nowStamp() })));
}
