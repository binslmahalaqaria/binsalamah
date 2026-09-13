import "server-only";
import {
  getApps,
  initializeApp,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app";

/**
 * Firebase Admin SDK init — server-only, used by API routes that need
 * privileged operations the client SDK can't do (currently just staff
 * account creation, see lib/staff-client.ts). Never import this from a
 * client component.
 *
 * Supports two credential sources:
 * - FIREBASE_SERVICE_ACCOUNT_KEY: the service account JSON as a string
 *   (set this in Vercel — there's no local file on serverless).
 * - GOOGLE_APPLICATION_CREDENTIALS: a local file path (used in dev, same
 *   as scripts/seed-admin.ts).
 */
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const inlineKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (inlineKey) {
    return initializeApp({ credential: cert(JSON.parse(inlineKey)) });
  }

  // Falls back to GOOGLE_APPLICATION_CREDENTIALS (a file path) when no
  // inline key is provided.
  return initializeApp({ credential: applicationDefault() });
}

export const adminApp = getAdminApp();
