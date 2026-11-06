import {
  collection,
  doc,
  deleteField,
  getDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fbLimit,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Offer, OfferStatus } from "./types";
import { DISTRICTS, districtKey } from "./districts";
import type { OfferFormInput } from "./validators";

const COLLECTION = "offers";

/**
 * The map location and project file are given to a client only by the team
 * (client 2026-11-06), so they never sit on the offer: a published offer is
 * readable by anyone, and Firestore can't hide one field of a readable doc.
 * They live in offers/{id}/private/links, which only staff can read.
 */
export type OfferLinks = { map_url?: string | null; brochure_url?: string | null };
const linksRef = (id: string) => doc(db, COLLECTION, id, "private", "links");
const linksOf = (x: OfferLinks) => ({ map_url: x.map_url || "", brochure_url: x.brochure_url || "" });
const withoutLinks = <T extends object>(x: T) => {
  const rest = { ...x } as T & OfferLinks;
  delete rest.map_url;
  delete rest.brochure_url;
  return rest;
};

/** Saves a listing's staff-only links (used when its CRM property changes). */
export const saveOfferLinks = (id: string, links: OfferLinks) => setDoc(linksRef(id), linksOf(links), { merge: true });

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : Date.now();
}

function fromDoc(id: string, data: Record<string, unknown>): Offer {
  return {
    id,
    ...(data as Omit<Offer, "id" | "created_at" | "updated_at">),
    created_at: toMillis(data.created_at),
    updated_at: toMillis(data.updated_at),
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listOffers(): Promise<Offer[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy("updated_at", "desc"))
  );
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function getOffer(id: string): Promise<Offer | null> {
  const [snap, links] = await Promise.all([getDoc(doc(db, COLLECTION, id)), getDoc(linksRef(id))]);
  return snap.exists() ? { ...fromDoc(snap.id, snap.data()), ...links.data() } : null;
}

/**
 * Public-site reads. Must filter by `status == "published"` in the query
 * itself (not just in app code) — Firestore Security Rules only allow a
 * `list` query for unauthenticated users when the query is provably
 * constrained to documents the rules permit; see firestore.rules.
 */
export async function listPublishedOffers(max?: number): Promise<Offer[]> {
  const constraints = [
    where("status", "==", "published"),
    orderBy("updated_at", "desc"),
  ];
  const q = max
    ? query(collection(db, COLLECTION), ...constraints, fbLimit(max))
    : query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d.id, withoutLinks(d.data())));
}

export async function getPublishedOfferBySlug(slug: string): Promise<Offer | null> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where("status", "==", "published"),
      where("slug", "==", slug),
      fbLimit(1)
    )
  );
  return snap.empty ? null : fromDoc(snap.docs[0].id, withoutLinks(snap.docs[0].data()));
}

export async function createOffer(
  input: OfferFormInput & { images: { url: string; order: number }[]; property_id?: string | null },
  status: OfferStatus,
  staffUid: string
): Promise<string> {
  // Short Latin links (Arabic ones turn into long %D9… codes when shared): type + district (English name when
  // known, e.g. villa-al-malqa) + a unique suffix. The English title is used when the owner gives one.
  const en = DISTRICTS[districtKey(input.district_ar)]?.en;
  const base = input.title_en?.trim() ? slugify(input.title_en) : [input.type, en ? slugify(en) : ""].filter(Boolean).join("-");
  const slug = `${base.replace(/[^a-z0-9-]/g, "") || "offer"}-${Date.now().toString(36)}`;
  const ref = doc(collection(db, COLLECTION));
  const batch = writeBatch(db);
  batch.set(ref, {
    ...withoutLinks(input),
    slug,
    cover_image: input.images[0]?.url ?? null,
    status,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    created_by: staffUid,
    updated_by: staffUid,
  });
  batch.set(linksRef(ref.id), linksOf(input));
  await batch.commit();
  return ref.id;
}

export async function updateOffer(
  id: string,
  input: OfferFormInput & { images: { url: string; order: number }[] },
  status: OfferStatus,
  staffUid: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTION, id), {
    ...withoutLinks(input),
    map_url: deleteField(),
    brochure_url: deleteField(),
    cover_image: input.images[0]?.url ?? null,
    status,
    updated_at: serverTimestamp(),
    updated_by: staffUid,
  });
  batch.set(linksRef(id), linksOf(input), { merge: true });
  await batch.commit();
}

/** One-off: moves links still on public offers to the staff-only doc. Safe to repeat; run by the owner's CRM. */
export async function migrateOfferLinks(): Promise<number> {
  const old = (await getDocs(collection(db, COLLECTION))).docs.filter((d) => "map_url" in d.data() || "brochure_url" in d.data());
  for (let k = 0; k < old.length; k += 200) {
    const batch = writeBatch(db);
    for (const d of old.slice(k, k + 200)) {
      batch.set(linksRef(d.id), linksOf(d.data()), { merge: true });
      batch.update(d.ref, { map_url: deleteField(), brochure_url: deleteField() });
    }
    await batch.commit();
  }
  return old.length;
}

export async function setOfferStatus(
  id: string,
  status: OfferStatus,
  staffUid: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    status,
    updated_at: serverTimestamp(),
    updated_by: staffUid,
  });
}

export async function deleteOffer(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(linksRef(id));
  batch.delete(doc(db, COLLECTION, id));
  await batch.commit();
}
