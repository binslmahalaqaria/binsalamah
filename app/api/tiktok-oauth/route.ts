import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireOwner } from "@/lib/snap-server";
import { TT_AUTH, TT_REDIRECT, TT_WEBHOOK, readTt, ttAdvertisers, ttRef, ttSubscribe } from "@/lib/tiktok-server";

/**
 * Owner-only control of the TikTok lead-ads link (components/crm/TikTokLink.tsx). GET: status (no secrets).
 * POST {action}: «config» saves the app keys and returns TikTok's authorization URL; «connect» a fresh URL;
 * «sync» subscribes advertisers authorized since.
 */
export const runtime = "nodejs";

const authUrl = async (appId: string) => {
  const state = randomBytes(16).toString("hex");
  await ttRef().set({ state, stateAt: Date.now() }, { merge: true });
  return TT_AUTH + "?" + new URLSearchParams({ app_id: appId, state, redirect_uri: TT_REDIRECT });
};

export async function GET(req: NextRequest) {
  if (!(await requireOwner(req.headers.get("authorization")))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const s = await readTt();
  return NextResponse.json({
    configured: !!(s.appId && s.secret), connected: !!s.accessToken,
    advertisers: (s.advertisers || []).map((a) => ({ id: a.id, linked: !!a.subscriptionId, error: a.error || null })),
    lastError: s.lastError || null, redirect: TT_REDIRECT, webhook: TT_WEBHOOK,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireOwner(req.headers.get("authorization")))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; appId?: string; secret?: string };
  try {
    if (body.action === "config") {
      const appId = String(body.appId || "").trim(), secret = String(body.secret || "").trim();
      if (!appId || !secret) return NextResponse.json({ error: "missing" }, { status: 400 });
      await ttRef().set({ appId, secret }, { merge: true });
      return NextResponse.json({ url: await authUrl(appId) });
    }
    const s = await readTt();
    if (body.action === "connect") {
      if (!s.appId) return NextResponse.json({ error: "not_configured" }, { status: 400 });
      return NextResponse.json({ url: await authUrl(s.appId) });
    }
    if (body.action === "sync") {
      if (!s.accessToken) return NextResponse.json({ error: "not_connected" }, { status: 400 });
      const ids = await ttAdvertisers(s);
      const r = await ttSubscribe(ids);
      return NextResponse.json({ advertisers: r.map((a) => ({ id: a.id, linked: !!a.subscriptionId, error: a.error || null })) });
    }
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await ttRef().set({ lastError: msg }, { merge: true }).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
