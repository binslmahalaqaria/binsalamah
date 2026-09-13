import { collection, doc, getDocs, updateDoc, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { Staff, StaffRole } from "./types";

const COLLECTION = "staff";

function fromDoc(id: string, data: Record<string, unknown>): Staff {
  return {
    id,
    ...(data as Omit<Staff, "id" | "created_at">),
    created_at:
      data.created_at instanceof Timestamp
        ? data.created_at.toMillis()
        : Date.now(),
  };
}

export async function listStaff(): Promise<Staff[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy("created_at", "asc"))
  );
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function setStaffActive(
  id: string,
  active: boolean
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { active });
}

export async function setStaffRole(
  id: string,
  role: StaffRole
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { role });
}

/**
 * Creating a new staff account needs a Firebase Auth user to exist, which
 * the client SDK can't do for someone else without hijacking the current
 * session — so this one action goes through a small Next.js API route
 * that uses the Admin SDK server-side. See CLAUDE.md §1 "There is no
 * custom backend server" for why this is the one deliberate exception.
 */
export async function createStaffAccount(
  idToken: string,
  input: { name: string; email: string; password: string; role: StaffRole }
): Promise<{ uid: string }> {
  const res = await fetch("/api/staff", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}
