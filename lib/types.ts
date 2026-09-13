/**
 * Shared TypeScript types mirroring the Firestore data model in CLAUDE.md §5.
 * Keep this file in sync with CLAUDE.md whenever the schema changes.
 */

export type OfferType =
  | "apartment"
  | "villa"
  | "floor"
  | "townhouse"
  | "land"
  | "other";

export type OfferStatus = "draft" | "published" | "archived";

export interface OfferImage {
  url: string;
  // Set only for images uploaded to Firebase Storage. Currently unused —
  // images are pasted as external URLs until Storage's Blaze plan is
  // enabled (see CLAUDE.md §12) — kept optional so real uploads can slot
  // in later without a schema change.
  storage_path?: string;
  order: number;
}

export interface Offer {
  id: string;
  title_ar: string;
  title_en: string;
  slug: string;
  type: OfferType;
  city_ar: string;
  city_en: string;
  district_ar: string;
  district_en: string;
  price_from: number;
  price_to: number | null;
  area_from: number;
  area_to: number | null;
  rooms: number | null;
  bathrooms: number | null;
  images: OfferImage[];
  cover_image: string | null;
  description_ar: string;
  description_en: string;
  sold_percentage: number | null;
  status: OfferStatus;
  featured: boolean;
  created_at: number; // epoch millis (server timestamp resolved on read)
  updated_at: number;
  created_by: string;
  updated_by: string;
}

export type LeadSource =
  | "website_interest"
  | "whatsapp"
  | "phone_call"
  | "manual"
  | "other";

export type LeadStatus =
  | "new"
  | "contacted"
  | "interested"
  | "not_interested"
  | "closed_won"
  | "closed_lost";

export interface LeadNote {
  text: string;
  by: string; // staff uid
  at: number; // epoch millis
}

export interface Lead {
  id: string;
  customer_name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  related_offer_id: string | null;
  message: string | null;
  status: LeadStatus;
  assigned_to: string | null;
  notes: LeadNote[];
  created_at: number;
  updated_at: number;
}

export type StaffRole = "admin" | "sales";

export interface Staff {
  id: string; // Firebase Auth uid
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  created_at: number;
}

export interface CompanySettings {
  whatsapp_number: string;
  contact_email: string | null;
  contact_phone: string | null;
  updated_at: number;
  updated_by: string;
}
