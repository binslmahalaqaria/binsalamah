import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, SITE } from "@/lib/snap-server";

/**
 * TikTok lead ads → CRM (client 2026-11-12). Server-only, same pattern as Snap (lib/snap-server.ts): the owner's
 * TikTok developer app (App ID + Secret pasted by the owner), advertiser authorization (long-term access token),
 * and one LEAD webhook subscription per advertiser (all its Instant Forms). Secrets live in Firestore
 * `secrets/tiktok` (no rule → Admin SDK only).
 */
export const TT_API = "https://business-api.tiktok.com/open_api/v1.3";
export const TT_AUTH = "https://business-api.tiktok.com/portal/auth";
export const TT_REDIRECT = SITE + "/api/tiktok-oauth/callback";
export const TT_WEBHOOK = SITE + "/api/tiktok-leads";

export type TtSecrets = {
  appId?: string; secret?: string; accessToken?: string; state?: string | null; stateAt?: number;
  advertisers?: { id: string; subscriptionId?: string | null; error?: string | null }[];
  connectedAt?: number; syncedAt?: number; lastError?: string | null;
};

export const ttRef = () => db().collection("secrets").doc("tiktok");
export async function readTt(): Promise<TtSecrets> {
  const s = await ttRef().get();
  return (s.exists ? s.data() : {}) as TtSecrets;
}

async function tt<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(TT_API + path, { ...init, headers: { "Content-Type": "application/json", ...(init.token ? { "Access-Token": init.token } : {}), ...(init.headers || {}) } });
  const j = (await res.json().catch(() => ({}))) as { code?: number; message?: string; data?: T };
  if (!res.ok || (j.code !== undefined && j.code !== 0)) throw new Error(path.split("?")[0] + ": " + (j.message || res.status));
  return j.data as T;
}

/** Swaps the advertiser's one-time auth code (valid 10 minutes) for a long-term access token. */
export async function ttExchange(s: TtSecrets, authCode: string) {
  return tt<{ access_token: string; advertiser_ids?: string[] }>("/oauth2/access_token/", {
    method: "POST", body: JSON.stringify({ app_id: s.appId, secret: s.secret, auth_code: authCode }),
  });
}

/** Subscribes every authorized advertiser's Instant Form leads to /api/tiktok-leads (skips ones already subscribed). */
export async function ttSubscribe(advertiserIds: string[]) {
  const s = await readTt();
  const known = new Map((s.advertisers || []).map((a) => [a.id, a]));
  const out: NonNullable<TtSecrets["advertisers"]> = [];
  for (const id of advertiserIds) {
    const old = known.get(id);
    if (old?.subscriptionId) { out.push(old); continue; }
    try {
      const r = await tt<{ subscription_id?: string }>("/subscription/subscribe/", {
        method: "POST",
        body: JSON.stringify({
          app_id: s.appId, secret: s.secret, subscribe_entity: "LEAD", callback_url: TT_WEBHOOK,
          subscription_detail: { access_token: s.accessToken, advertiser_id: id, lead_source: "INSTANT_FORM" },
        }),
      });
      out.push({ id, subscriptionId: r?.subscription_id || null, error: r?.subscription_id ? null : "لم يُنشأ الاشتراك" });
    } catch (e) {
      out.push({ id, subscriptionId: null, error: String((e as Error).message || e).slice(0, 300) });
    }
  }
  await ttRef().set({ advertisers: out, syncedAt: Date.now(), lastError: null }, { merge: true });
  return out;
}

/** The advertisers this token can manage (to subscribe new ones later). */
export async function ttAdvertisers(s: TtSecrets) {
  const r = await tt<{ list?: { advertiser_id: string }[] }>("/oauth2/advertiser/get/?" + new URLSearchParams({ app_id: s.appId!, secret: s.secret! }), { token: s.accessToken });
  return (r?.list || []).map((x) => String(x.advertiser_id));
}

/**
 * X-Open-Signature: hex HMAC-SHA256 of the payload with the app secret. TikTok signs the unicode-escaped JSON, so
 * both the raw body and an escaped re-encoding of it are tried.
 */
export function ttSignatureOk(raw: string, sig: string | null, secret: string) {
  if (!sig) return false;
  const want = sig.trim().toLowerCase().replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/.test(want)) return false;
  const escaped = raw.replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  for (const body of new Set([raw, escaped])) {
    const got = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    if (timingSafeEqual(Buffer.from(got), Buffer.from(want))) return true;
  }
  return false;
}
