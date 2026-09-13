import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";

/**
 * Firebase client SDK initialization. See CLAUDE.md §11 for the required
 * environment variables. This file is safe to import from client components.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// True once real values are filled into .env.local (see .env.local.example
// and CLAUDE.md §11). Used to fail gracefully instead of throwing uncaught
// Firebase errors while the project hasn't been connected yet.
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
// getAuth() validates the API key format synchronously and throws if it's
// missing/malformed — guard it so the app doesn't hard-crash before
// .env.local is filled in (see isFirebaseConfigured above).
export const auth = isFirebaseConfigured
  ? getAuth(app)
  : (null as unknown as Auth);
export const storage = getStorage(app);
export default app;
