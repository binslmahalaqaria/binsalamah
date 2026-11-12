import { NextRequest, NextResponse } from "next/server";
import { SITE } from "@/lib/snap-server";
import { readTt, ttExchange, ttRef, ttSubscribe } from "@/lib/tiktok-server";

/** TikTok sends the owner back here with `auth_code` (valid 10 minutes): swap it, subscribe every advertiser, return to Settings. */
export const runtime = "nodejs";

const back = (q: Record<string, string>) => NextResponse.redirect(SITE + "/ar/admin/setup?" + new URLSearchParams(q));

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("auth_code") || req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const s = await readTt();
  if (!code || !state || state !== s.state || Date.now() - (s.stateAt || 0) > 15 * 60_000) return back({ tiktok: "bad_state" });
  await ttRef().set({ state: null }, { merge: true });
  try {
    const t = await ttExchange(s, code);
    await ttRef().set({ accessToken: t.access_token, connectedAt: Date.now(), lastError: null }, { merge: true });
    const r = await ttSubscribe((t.advertiser_ids || []).map(String));
    return back({ tiktok: "ok", accounts: String(r.filter((a) => a.subscriptionId).length) });
  } catch (e) {
    await ttRef().set({ lastError: String((e as Error).message || e).slice(0, 300) }, { merge: true }).catch(() => {});
    return back({ tiktok: "error" });
  }
}
