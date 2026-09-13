import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Lead, LeadNote, LeadSource, LeadStatus } from "./types";

const COLLECTION = "leads";

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : Date.now();
}

function fromDoc(id: string, data: Record<string, unknown>): Lead {
  const notes = ((data.notes as Record<string, unknown>[]) ?? []).map(
    (n) => ({
      text: n.text as string,
      by: n.by as string,
      at: toMillis(n.at),
    })
  );
  return {
    id,
    ...(data as Omit<Lead, "id" | "created_at" | "updated_at" | "notes">),
    notes,
    created_at: toMillis(data.created_at),
    updated_at: toMillis(data.updated_at),
  };
}

export async function listLeads(): Promise<Lead[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy("created_at", "desc"))
  );
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function getLead(id: string): Promise<Lead | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

export async function createManualLead(input: {
  customer_name: string;
  phone: string;
  message?: string;
  source: LeadSource;
  related_offer_id?: string | null;
}): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    customer_name: input.customer_name,
    phone: input.phone,
    email: null,
    source: input.source,
    related_offer_id: input.related_offer_id ?? null,
    message: input.message ?? null,
    status: "new" satisfies LeadStatus,
    assigned_to: null,
    notes: [],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Used by the public "Register interest" / contact forms — no auth.
 * Matches the constrained shape `firestore.rules` allows for public
 * writes: source website_interest/other, status new, unassigned, no notes.
 */
export async function createPublicLead(input: {
  customer_name: string;
  phone: string;
  message?: string;
  related_offer_id?: string | null;
}): Promise<string> {
  return createManualLead({ ...input, source: "website_interest" });
}

export async function setLeadStatus(
  id: string,
  status: LeadStatus
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    status,
    updated_at: serverTimestamp(),
  });
}

export async function assignLead(
  id: string,
  staffUid: string | null
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    assigned_to: staffUid,
    updated_at: serverTimestamp(),
  });
}

export async function addLeadNote(
  id: string,
  note: Omit<LeadNote, "at">
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    notes: arrayUnion({ ...note, at: Timestamp.now() }),
    updated_at: serverTimestamp(),
  });
}
