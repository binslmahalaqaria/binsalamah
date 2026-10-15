import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Server routes that call Claude (assistant, WhatsApp reply suggestions) accept
 * only active staff. The caller's Firebase ID token is verified with jose and
 * their own staff doc is read over Firestore REST with that same token (staff
 * may read their own doc), so no service-account key is needed.
 */
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const firebaseJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export async function activeStaffUid(idToken: string): Promise<string | null> {
  const { payload } = await jwtVerify(idToken, firebaseJwks, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  if (!payload.sub) return null;
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/staff/${payload.sub}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
  if (!res.ok) return null;
  const doc = await res.json();
  return doc?.fields?.active?.booleanValue === true ? payload.sub : null;
}
