import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fbLimit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Offer, OfferStatus } from "./types";
import type { OfferFormInput } from "./validators";

const COLLECTION = "offers";

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
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
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
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
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
  return snap.empty ? null : fromDoc(snap.docs[0].id, snap.docs[0].data());
}

export async function createOffer(
  input: OfferFormInput & { images: { url: string; order: number }[] },
  status: OfferStatus,
  staffUid: string
): Promise<string> {
  const base = input.title_en || input.title_ar;
  const slug = `${slugify(base)}-${Date.now().toString(36)}`;
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    slug,
    cover_image: input.images[0]?.url ?? null,
    status,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    created_by: staffUid,
    updated_by: staffUid,
  });
  return ref.id;
}

export async function updateOffer(
  id: string,
  input: OfferFormInput & { images: { url: string; order: number }[] },
  status: OfferStatus,
  staffUid: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...input,
    cover_image: input.images[0]?.url ?? null,
    status,
    updated_at: serverTimestamp(),
    updated_by: staffUid,
  });
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
  await deleteDoc(doc(db, COLLECTION, id));
}
