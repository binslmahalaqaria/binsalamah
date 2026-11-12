import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getFirestore } from "firebase-admin/firestore";
import { adminApp } from "@/lib/firebase-admin";

/**
 * Snapchat lead ads → CRM (client 2026-11-12). Server-only helpers shared by app/api/snap-oauth and
 * app/api/snap-leads. Everything secret lives in Firestore `secrets/snap`, which has no rule at all, so no browser
 * can read or write it — only these routes, through the Admin SDK: the OAuth app's clientId/clientSecret (pasted by
 * the owner), the refresh token, the webhook HMAC secret, and which forms are linked.
 */
export const SNAP_API = "https://adsapi.snapchat.com/v1";
export const SNAP_TOKEN = "https://accounts.snapchat.com/login/oauth2/access_token";
export const SNAP_AUTH = "https://accounts.snapchat.com/login/oauth2/authorize";
export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.binslmahre.com";
export const REDIRECT = SITE + "/api/snap-oauth/callback";
export const WEBHOOK = SITE + "/api/snap-leads";

export type SnapSecrets = {
  clientId?: string; clientSecret?: string; refreshToken?: string; hmacSecret?: string; state?: string; stateAt?: number;
  forms?: { id: string; name: string; adAccountId: string; integrationId?: string | null; error?: string | null }[];
  connectedAt?: number; syncedAt?: number; lastError?: string | null;
};

export const db = () => getFirestore(adminApp);
export const secretsRef = () => db().collection("secrets").doc("snap");
export async function readSecrets(): Promise<SnapSecrets> {
  const s = await secretsRef().get();
  return (s.exists ? s.data() : {}) as SnapSecrets;
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

/** The caller must be the active owner (role admin): their Firebase ID token in `Authorization: Bearer`. */
export async function requireOwner(authz: string | null) {
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: "https://securetoken.google.com/" + PROJECT_ID, audience: PROJECT_ID });
    const s = await db().collection("staff").doc(String(payload.sub)).get();
    return s.exists && s.data()?.role === "admin" && !!s.data()?.active;
  } catch { return false; }
}

async function tokenCall(params: Record<string, string>) {
  const res = await fetch(SNAP_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error("token: " + (j.error_description || j.error || res.status));
  return j as { access_token: string; refresh_token?: string };
}

export async function exchangeCode(s: SnapSecrets, code: string) {
  return tokenCall({ grant_type: "authorization_code", client_id: s.clientId!, client_secret: s.clientSecret!, code, redirect_uri: REDIRECT });
}

export async function accessToken(s: SnapSecrets) {
  const t = await tokenCall({ grant_type: "refresh_token", client_id: s.clientId!, client_secret: s.clientSecret!, refresh_token: s.refreshToken! });
  if (t.refresh_token && t.refresh_token !== s.refreshToken) await secretsRef().set({ refreshToken: t.refresh_token }, { merge: true });
  return t.access_token;
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(SNAP_API + path, { ...init, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(init?.headers || {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(path.split("?")[0] + ": " + (j.debug_message || j.display_message || j.request_status || res.status));
  return j as T;
}

/**
 * Webhook integrations from any Snap reply, camelCase (as in the docs) or snake_case, wrapped or not:
 * finds every object carrying an integration id and returns its id, URL and HMAC secret.
 */
function integrations(v: unknown): { id: string; url?: string; hmac?: string }[] {
  const out: { id: string; url?: string; hmac?: string }[] = [];
  let anyHmac: string | undefined;
  const walk = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    const h = (o.hmacSecret ?? o.hmac_secret) as string | undefined;
    if (typeof h === "string" && h) anyHmac = h;
    // Snap's real reply (2026-11-12): partner_integrations[] { integration_id, partner_type, generic_webhook_handler_info: { webhook_url } }.
    const info = (o.generic_webhook_handler_info ?? o.genericWebhookHandlerInfo) as Record<string, unknown> | undefined;
    const id = o.integrationId ?? o.integration_id ?? (o.partnerType || o.partner_type || o.webhookUrl || o.webhook_url ? o.id : undefined);
    if (typeof id === "string" && id) out.push({ id, url: String(o.webhookUrl ?? o.webhook_url ?? info?.webhook_url ?? info?.webhookUrl ?? ""), hmac: h });
    Object.values(o).forEach(walk);
  };
  walk(v);
  // The secret may sit beside the integration rather than inside it.
  if (anyHmac) for (const x of out) x.hmac ||= anyHmac;
  return out;
}

/**
 * Every lead form in every ad account the connected user can see gets a webhook to /api/snap-leads (one per form;
 * forms already linked are skipped). Saves the HMAC secret Snap returns and the list of forms.
 */
export async function linkForms(token: string) {
  const s = await readSecrets();
  const known = new Map((s.forms || []).map((f) => [f.id, f]));
  const orgs = await api<{ organizations?: { organization: { ad_accounts?: { id: string; name: string }[] } }[] }>(token, "/me/organizations?with_ad_accounts=true");
  const accounts = (orgs.organizations || []).flatMap((o) => o.organization?.ad_accounts || []);
  const forms: NonNullable<SnapSecrets["forms"]> = [];
  let hmac = s.hmacSecret || null;
  for (const a of accounts) {
    const fs = await api<{ lead_generation_forms?: { lead_generation_form: { id: string; name: string } }[] }>(token, "/adaccounts/" + a.id + "/lead_generation_forms").catch(() => ({ lead_generation_forms: [] }));
    for (const w of fs.lead_generation_forms || []) {
      const f = w.lead_generation_form;
      if (!f?.id) continue;
      const old = known.get(f.id);
      if (old?.integrationId) { forms.push({ ...old, name: f.name || old.name }); continue; }
      try {
        // An existing webhook on this form (made earlier) is reused instead of failing on «one per form».
        const ex = await api<unknown>(token, "/lead_gen/forms/" + f.id + "/integrations?partner_type=PUBLIC_WEBHOOK").catch(() => null);
        const mine = integrations(ex).find((x) => x.url === WEBHOOK);
        let integrationId = mine?.id || null;
        if (mine?.hmac) hmac = mine.hmac;
        // Snap returns the signing secret only when a webhook is created: one made earlier without us keeping
        // the secret is removed and made again, otherwise no lead could be verified.
        if (integrationId && !hmac) {
          await api<unknown>(token, "/lead_gen/integrations/" + integrationId, { method: "DELETE" }).catch(() => null);
          integrationId = null;
        }
        let raw = "";
        if (!integrationId) {
          const r = await api<unknown>(token, "/lead_gen/integrations/public_webhook", {
            method: "POST", body: JSON.stringify({ webhook_integrations: [{ form_id: f.id, webhook_url: WEBHOOK }] }),
          });
          const w2 = integrations(r)[0];
          integrationId = w2?.id || null;
          if (w2?.hmac) hmac = w2.hmac;
          // Kept (secrets masked) when Snap's reply has no integration id, to see its real shape.
          if (!integrationId) raw = JSON.stringify(r).replace(/("hmac_?secret"\s*:\s*")[^"]+/gi, "$1***").slice(0, 300);
        }
        forms.push({ id: f.id, name: f.name || f.id, adAccountId: a.id, integrationId, error: integrationId ? null : "لم يُنشأ الربط" + (raw ? ": " + raw : "") });
      } catch (e) {
        // «existing integration» but none recognised in the listing: keep the listing (secrets masked) to read its shape.
        let list = "";
        if (/existing integration/i.test(String((e as Error).message))) {
          const ex = await api<unknown>(token, "/lead_gen/forms/" + f.id + "/integrations?partner_type=PUBLIC_WEBHOOK").catch((x) => String((x as Error).message));
          list = " | list: " + (typeof ex === "string" ? ex : JSON.stringify(ex)).replace(/("hmac_?secret"\s*:\s*")[^"]+/gi, "$1***").slice(0, 400);
        }
        forms.push({ id: f.id, name: f.name || f.id, adAccountId: a.id, integrationId: null, error: (String((e as Error).message || e).slice(0, 200) + list).slice(0, 600) });
      }
    }
  }
  await secretsRef().set({ forms, ...(hmac ? { hmacSecret: hmac } : {}), syncedAt: Date.now(), lastError: null }, { merge: true });
  return { accounts: accounts.length, forms };
}
