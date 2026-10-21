import type { OfferFormInput } from "./validators";

/**
 * Before an offer is saved, fill every English field that is still empty from its Arabic text
 * (via app/api/translate-offer). English the owner typed is never overwritten. If the translation
 * call fails the offer is saved as it is, and the site falls back to Arabic for those fields.
 */
export async function fillEnglish(o: OfferFormInput, idToken: string): Promise<OfferFormInput> {
  const ask: Record<string, string | string[]> = {};
  const blank = (v: string | null | undefined) => !v || !v.trim();
  if (blank(o.title_en)) ask.title = o.title_ar;
  if (blank(o.city_en)) ask.city = o.city_ar;
  if (blank(o.district_en)) ask.district = o.district_ar;
  if (blank(o.description_en)) ask.description = o.description_ar;
  if (o.developer && blank(o.developer_en)) ask.developer = o.developer;
  if (o.handover && blank(o.handover_en)) ask.handover = o.handover;
  if (o.warranties_text && blank(o.warranties_text_en)) ask.warranties = o.warranties_text;
  const features = o.features ?? [];
  if (features.length && (o.features_en ?? []).length !== features.length) ask.features = features;
  const units = o.units ?? [];
  if (units.some((u) => blank(u.name_en))) ask.units = units.map((u) => u.name);
  if (!Object.keys(ask).length) return o;

  try {
    const res = await fetch("/api/translate-offer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
      body: JSON.stringify(ask),
    });
    if (!res.ok) return o;
    const f = ((await res.json()) as { fields?: Record<string, string | string[]> }).fields ?? {};
    const str = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
    const arr = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : undefined);
    const unitNames = arr("units");
    return {
      ...o,
      title_en: str("title") ?? o.title_en,
      city_en: str("city") ?? o.city_en,
      district_en: str("district") ?? o.district_en,
      description_en: str("description") ?? o.description_en,
      developer_en: str("developer") ?? o.developer_en,
      handover_en: str("handover") ?? o.handover_en,
      warranties_text_en: str("warranties") ?? o.warranties_text_en,
      features_en: arr("features") ?? o.features_en,
      units: unitNames ? units.map((u, i) => (blank(u.name_en) ? { ...u, name_en: unitNames[i] } : u)) : units,
    };
  } catch {
    return o;
  }
}
