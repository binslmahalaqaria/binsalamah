import { NextRequest, NextResponse } from "next/server";
import { SITE, exchangeCode, linkForms, readSecrets, secretsRef } from "@/lib/snap-server";

/**
 * Where Snap sends the owner back after signing in (the OAuth app's redirect URI). Checks the one-time `state`,
 * swaps the code for a refresh token, links every lead form to the webhook, then returns to Settings with the result.
 */
export const runtime = "nodejs";

const back = (q: Record<string, string>) => NextResponse.redirect(SITE + "/ar/admin/setup?" + new URLSearchParams(q));

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const s = await readSecrets();
  // The state must match the one issued in the last 15 minutes, and is single-use.
  if (!code || !state || state !== s.state || Date.now() - (s.stateAt || 0) > 15 * 60_000) return back({ snap: "bad_state" });
  await secretsRef().set({ state: null }, { merge: true });
  try {
    const t = await exchangeCode(s, code);
    if (!t.refresh_token) return back({ snap: "no_refresh" });
    await secretsRef().set({ refreshToken: t.refresh_token, connectedAt: Date.now(), lastError: null }, { merge: true });
    const r = await linkForms(t.access_token);
    return back({ snap: "ok", forms: String(r.forms.filter((f) => f.integrationId).length) });
  } catch (e) {
    await secretsRef().set({ lastError: String((e as Error).message || e).slice(0, 300) }, { merge: true }).catch(() => {});
    return back({ snap: "error" });
  }
}
