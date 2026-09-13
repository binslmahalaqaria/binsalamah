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
  "land",
  "other",
]);

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
});

export type OfferFormInput = z.infer<typeof offerFormSchema>;

/**
 * An offer may only move to `published` once every bilingual field required
 * for the public site is filled in. See CLAUDE.md §5.
 */
export function canPublishOffer(offer: OfferFormInput & { images?: unknown[] }) {
  return Boolean(
    offer.title_en?.trim() &&
      offer.city_en?.trim() &&
      offer.district_en?.trim() &&
      offer.description_en?.trim() &&
      offer.images &&
      offer.images.length > 0
  );
}
