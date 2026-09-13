"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import type { Staff } from "./types";

/**
 * CRM auth context. Wraps /[locale]/admin routes.
 * - `user` is the raw Firebase Auth user (null if signed out).
 * - `staff` is the matching `staff/{uid}` Firestore doc (role, active flag).
 * - `loading` is true until the initial auth state resolves.
 * - `configError` is true when Firebase hasn't been connected yet (see
 *   .env.local.example / CLAUDE.md §11) — surfaced instead of an uncaught
 *   Firebase exception.
 *
 * Full login UI/UX polish happens in Phase 2 — this is the Phase 0
 * foundation the login page and admin layout guard build on.
 */
interface AuthContextValue {
  user: User | null;
  staff: Staff | null;
  loading: boolean;
  configError: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  staff: null,
  loading: true,
  configError: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        if (!firebaseUser) {
          setStaff(null);
          setLoading(false);
        }
      },
      () => {
        // e.g. invalid-api-key while Firebase isn't connected yet.
        setConfigError(true);
        setLoading(false);
      }
    );
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribeStaff = onSnapshot(
      doc(db, "staff", user.uid),
      (snap) => {
        setStaff(snap.exists() ? ({ id: snap.id, ...snap.data() } as Staff) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribeStaff;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, staff, loading, configError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
