import { collection, doc, getDocs, updateDoc, setDoc, serverTimestamp, query, orderBy, Timestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, inMemoryPersistence, sendPasswordResetEmail, setPersistence, signOut, updateProfile } from "firebase/auth";
import app, { auth, db } from "./firebase";
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
 * Creates a staff member's login (Firebase Auth) and their `staff` doc from
 * the owner's browser — no service-account key needed. The client SDK signs in
 * as whoever it creates, so the new user is created on a separate, throwaway
 * Firebase app instance with in-memory persistence: the owner's own session is
 * never touched. The `staff` doc is then written with the owner's session,
 * which Security Rules allow only for an active admin (CLAUDE.md §6).
 * Replaces the call to `/api/staff`, which needed the key on the server.
 */
export async function createStaffAccount(input: {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
}): Promise<{ uid: string }> {
  const side = getApps().find((a) => a.name === "staff-create") || initializeApp(app.options, "staff-create");
  const sideAuth = getAuth(side);
  await setPersistence(sideAuth, inMemoryPersistence);
  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(sideAuth, input.email, input.password);
    uid = cred.user.uid;
    await updateProfile(cred.user, { displayName: input.name }).catch(() => {});
  } catch (err) {
    const code = (err as { code?: string }).code || "";
    throw new Error(
      code === "auth/email-already-in-use" ? "هذا البريد مسجّل مسبقاً بحساب آخر."
      : code === "auth/invalid-email" ? "صيغة البريد الإلكتروني غير صحيحة."
      : code === "auth/weak-password" ? "كلمة المرور ضعيفة، يجب ألا تقل عن 6 أحرف."
      : "تعذّر إنشاء الحساب (" + (code || "unknown") + ")."
    );
  } finally {
    await signOut(sideAuth).catch(() => {});
  }
  await setDoc(doc(db, COLLECTION, uid), {
    name: input.name,
    email: input.email,
    role: input.role,
    active: true,
    created_at: serverTimestamp(),
  });
  return { uid };
}

/**
 * Emails the staff member a Firebase link to choose a new password (passwords are never
 * readable, so this is how a forgotten one is replaced). The email is in Arabic.
 * Used by the owner on the staff page and by anyone on the login page.
 */
export async function sendResetLink(email: string): Promise<"sent" | "no_user" | "bad_email" | "error"> {
  try {
    auth.languageCode = "ar";
    await sendPasswordResetEmail(auth, email.trim());
    return "sent";
  } catch (err) {
    const code = (err as { code?: string }).code || "";
    return code === "auth/user-not-found" ? "no_user" : code === "auth/invalid-email" ? "bad_email" : "error";
  }
}
