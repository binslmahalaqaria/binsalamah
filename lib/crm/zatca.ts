/**
 * Browser side of the ZATCA (Phase 2) link: calls the server routes with the
 * signed-in user's ID token. The signing key never leaves the server.
 */
import { auth } from "@/lib/firebase";

async function call<T>(path: string, body: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("سجّل الدخول من جديد");
  const r = await fetch(path, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: "رد غير متوقع من الخادم" }));
  if (!r.ok) throw new Error(j.error || "خطأ " + r.status);
  return j as T;
}

export type ZatcaEnv = "sandbox" | "simulation" | "production";
export const ZATCA_ENV_LABEL: Record<ZatcaEnv, string> = { sandbox: "تجريبي (بوابة المطورين)", simulation: "المحاكاة", production: "الإنتاج (الفعلي)" };

export const zatcaOnboard = (env: ZatcaEnv, otp: string) =>
  call<{ env: ZatcaEnv; checks: { name: string; ok: boolean; info: string }[] }>("/api/zatca/onboard", { env, otp });

export const zatcaSubmit = (id: string) =>
  call<{ ok?: boolean; already?: boolean; status?: string; errors?: string[]; warnings?: string[] }>("/api/zatca/submit", { id });
