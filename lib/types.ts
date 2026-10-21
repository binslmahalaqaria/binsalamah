/**
 * Shared TypeScript types mirroring the Firestore data model in CLAUDE.md §5.
 * Keep this file in sync with CLAUDE.md whenever the schema changes.
 */

export type OfferType =
  | "apartment"
  | "villa"
  | "floor"
  | "townhouse"
  | "penthouse"
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

export type UnitStatus = "available" | "reserved" | "sold";

/** One sellable unit inside an offer (e.g. «دور أرضي», «شقة 3»), with its own price and area. */
export interface OfferUnit {
  name: string;
  /** English name (filled automatically on save when empty). */
  name_en?: string | null;
  area: number;
  price: number;
  rooms?: number | null;
  living_rooms?: number | null;
  bathrooms?: number | null;
  status: UnitStatus;
}

/** A warranty on the project, e.g. «الهيكل الإنشائي» for 10 years. */
export interface OfferWarranty { item: string; years: number }

export type ProjectStage = "ready" | "under_construction" | "off_plan";

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
  /** Units for sale in this offer. When present, the price/area ranges and sold % are derived from them. */
  units?: OfferUnit[];
  living_rooms?: number | null;
  /** Project details shown on the property page. */
  developer?: string | null;
  developer_en?: string | null;
  stage?: ProjectStage | null;
  handover?: string | null;
  handover_en?: string | null;
  /** Warranties written freely by the owner, one per line. */
  warranties_text?: string | null;
  warranties_text_en?: string | null;
  /** Older structured warranties (still shown if present). */
  warranties?: OfferWarranty[];
  features?: string[];
  /** English features, same order as `features` (filled automatically on save). */
  features_en?: string[];
  map_url?: string | null;
  brochure_url?: string | null;
  video_url?: string | null;
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

// admin: full access incl. HR/payroll/settings. manager: sees and assigns
// the whole team's clients/requests and sets goals. sales: own work only.
export type StaffRole = "admin" | "manager" | "sales";

export interface Staff {
  id: string; // Firebase Auth uid
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  created_at: number;
  // Self-editable profile fields (see firestore.rules `staff`).
  phone?: string | null;
  lastSeen?: string | null;
  chatSeen?: string | null;
  /** Per-employee permissions set by the owner (sales role only; see PERMS in lib/crm/logic.ts). */
  perms?: Partial<Record<string, boolean>> | null;
  /** May check in/out from anywhere (field work) even when the attendance location rule is on. */
  anyLocation?: boolean;
}

export interface CompanySettings {
  whatsapp_number: string;
  contact_email: string | null;
  contact_phone: string | null;
  updated_at: number;
  updated_by: string;
}
