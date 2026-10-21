import { z } from "zod";

/**
 * Validation schemas. Keep in sync with CLAUDE.md §5 and TESTING.md.
 */

// Accepts 05XXXXXXXX or +9665XXXXXXXX / 9665XXXXXXXX Saudi mobile formats.
const saudiPhoneRegex = /^(?:\+?966|0)5\d{8}$/;

export const leadFormSchema = z.object({
  customer_name: z.string().trim().min(2, "Name is required"),
  phone: z
    .string()
    .trim()
    .regex(saudiPhoneRegex, "Enter a valid Saudi phone number"),
  message: z.string().trim().max(1000).optional(),
  related_offer_id: z.string().nullable().optional(),
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;

export const offerTypeEnum = z.enum([
  "apartment",
  "villa",
  "floor",
  "townhouse",
  "penthouse",
  "land",
  "other",
]);

export const offerUnitSchema = z.object({
  name: z.string().trim().min(1, "Unit name is required"),
  name_en: z.string().trim().nullable().optional(),
  area: z.number().positive("Unit area is required"),
  price: z.number().positive("Unit price is required"),
  rooms: z.number().int().positive().nullable().optional(),
  living_rooms: z.number().int().positive().nullable().optional(),
  bathrooms: z.number().int().positive().nullable().optional(),
  status: z.enum(["available", "reserved", "sold"]).default("available"),
});

export const offerFormSchema = z.object({
  title_ar: z.string().trim().min(1, "Arabic title is required"),
  title_en: z.string().trim().optional().default(""),
  type: offerTypeEnum,
  city_ar: z.string().trim().min(1),
  city_en: z.string().trim().optional().default(""),
  district_ar: z.string().trim().min(1),
  district_en: z.string().trim().optional().default(""),
  price_from: z.number().positive(),
  price_to: z.number().positive().nullable().optional(),
  area_from: z.number().positive(),
  area_to: z.number().positive().nullable().optional(),
  rooms: z.number().int().positive().nullable().optional(),
  bathrooms: z.number().int().positive().nullable().optional(),
  description_ar: z.string().trim().min(1, "Arabic description is required"),
  description_en: z.string().trim().optional().default(""),
  sold_percentage: z.number().min(0).max(100).nullable().optional(),
  featured: z.boolean().default(false),
  units: z.array(offerUnitSchema).optional().default([]),
  living_rooms: z.number().int().positive().nullable().optional(),
  developer: z.string().trim().nullable().optional(),
  developer_en: z.string().trim().nullable().optional(),
  stage: z.enum(["ready", "under_construction", "off_plan"]).nullable().optional(),
  handover: z.string().trim().nullable().optional(),
  handover_en: z.string().trim().nullable().optional(),
  warranties_text: z.string().trim().max(3000).nullable().optional(),
  warranties_text_en: z.string().trim().max(4000).nullable().optional(),
  features: z.array(z.string().trim().min(1)).optional().default([]),
  features_en: z.array(z.string().trim()).optional().default([]),
  map_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  brochure_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  video_url: z.string().trim().url().nullable().optional().or(z.literal("")),
});

/**
 * With units, the offer's summary fields follow them: price and area ranges,
 * the most rooms/bathrooms, and the sold % (sold units ÷ all units).
 */
export function deriveFromUnits<T extends OfferFormInput>(o: T): T {
  const u = o.units ?? [];
  if (!u.length) return o;
  const prices = u.map((x) => x.price), areas = u.map((x) => x.area);
  const max = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => !!x); return v.length ? Math.max(...v) : null; };
  const lo = (xs: number[]) => Math.min(...xs), hi = (xs: number[]) => Math.max(...xs);
  return {
    ...o,
    price_from: lo(prices), price_to: hi(prices) !== lo(prices) ? hi(prices) : null,
    area_from: lo(areas), area_to: hi(areas) !== lo(areas) ? hi(areas) : null,
    rooms: max(u.map((x) => x.rooms)) ?? o.rooms, bathrooms: max(u.map((x) => x.bathrooms)) ?? o.bathrooms,
    living_rooms: max(u.map((x) => x.living_rooms)) ?? o.living_rooms,
    sold_percentage: Math.round((u.filter((x) => x.status === "sold").length / u.length) * 100),
  };
}

export type OfferFormInput = z.infer<typeof offerFormSchema>;

/**
 * An offer may be published once it has at least one photo (the Arabic fields
 * are already required by the schema). English is optional — the public site
 * falls back to the Arabic text when an English field is empty (owner's call,
 * 2026-10-15). See CLAUDE.md §5.
 */
export function canPublishOffer(offer: OfferFormInput & { images?: unknown[] }) {
  return Boolean(offer.images && offer.images.length > 0);
}
