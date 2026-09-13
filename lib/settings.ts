import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { CompanySettings } from "./types";

const DOC_PATH = ["settings", "company"] as const;

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const snap = await getDoc(doc(db, ...DOC_PATH));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    whatsapp_number: data.whatsapp_number ?? "",
    contact_email: data.contact_email ?? null,
    contact_phone: data.contact_phone ?? null,
    updated_at:
      data.updated_at instanceof Timestamp
        ? data.updated_at.toMillis()
        : Date.now(),
    updated_by: data.updated_by ?? "",
  };
}

/**
 * Public-site contact info, with a graceful fallback chain: live
 * `settings/company` doc (editable from the CRM with no redeploy) →
 * `NEXT_PUBLIC_WHATSAPP_NUMBER` env var → empty string. Never throws, so a
 * transient Firestore error never breaks page rendering.
 */
export async function getPublicContactInfo(): Promise<{
  whatsappNumber: string;
  contactEmail: string | null;
  contactPhone: string | null;
}> {
  try {
    const settings = await getCompanySettings();
    if (settings?.whatsapp_number) {
      return {
        whatsappNumber: settings.whatsapp_number,
        contactEmail: settings.contact_email,
        contactPhone: settings.contact_phone,
      };
    }
  } catch {
    // fall through to env var
  }
  return {
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
    contactEmail: null,
    contactPhone: null,
  };
}

export async function updateCompanySettings(
  input: {
    whatsapp_number: string;
    contact_email: string | null;
    contact_phone: string | null;
  },
  staffUid: string
): Promise<void> {
  await setDoc(doc(db, ...DOC_PATH), {
    ...input,
    updated_at: serverTimestamp(),
    updated_by: staffUid,
  });
}
