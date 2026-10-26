/**
 * Public website mode — switched live by the owner from the CRM (الإعدادات ← أدوات ← «حالة الموقع»), stored in
 * Firestore `settings/site` { open: boolean }. Closed («انتظرونا قريباً») unless `open === true`; if the read fails the
 * site stays closed. While closed every public page shows only the coming-soon page with the property request form
 * (components/site/ComingSoon.tsx); the CRM (/admin) is unaffected.
 */
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function isSiteOpen(): Promise<boolean> {
  try {
    const s = await getDoc(doc(db, "settings", "site"));
    return s.exists() && s.data().open === true;
  } catch {
    return false;
  }
}
