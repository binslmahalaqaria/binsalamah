import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { REDIRECT, SNAP_API, SNAP_AUTH, WEBHOOK, accessToken, importSnapLeads, linkForms, readSecrets, requireOwner, secretsRef } from "@/lib/snap-server";

/**
 * Owner-only control of the Snapchat lead-ads link (client 2026-11-12), used by components/crm/SnapLink.tsx.
 * GET: status (never returns secrets). POST {action}: «config» saves the OAuth app keys the owner pasted and returns
 * the Snap sign-in URL; «connect» returns a fresh sign-in URL; «sync» links new lead forms; «test» asks Snap to send a
 * sample lead to the webhook.
 */
export const runtime = "nodejs";
export const maxDuration = 60; // the leads import waits for Snap's report

const authUrl = async (clientId: string) => {
  const state = randomBytes(16).toString("hex");
  await secretsRef().set({ state, stateAt: Date.now() }, { merge: true });
  return SNAP_AUTH + "?" + new URLSearchParams({ client_id: clientId, redirect_uri: REDIRECT, response_type: "code", scope: "snapchat-marketing-api", state });
};

export async function GET(req: NextRequest) {
  if (!(await requireOwner(req.headers.get("authorization")))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const s = await readSecrets();
  return NextResponse.json({
    configured: !!(s.clientId && s.clientSecret), connected: !!s.refreshToken, signing: !!(s.hmacSecret || process.env.SNAP_HMAC_SECRET),
    forms: (s.forms || []).map((f) => ({ name: f.name, linked: !!f.integrationId, error: f.error || null })),
    connectedAt: s.connectedAt || null, syncedAt: s.syncedAt || null, lastError: s.lastError || null, redirect: REDIRECT, webhook: WEBHOOK,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireOwner(req.headers.get("authorization")))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; clientId?: string; clientSecret?: string };
  try {
    if (body.action === "config") {
      const clientId = String(body.clientId || "").trim(), clientSecret = String(body.clientSecret || "").trim();
      if (!clientId || !clientSecret) return NextResponse.json({ error: "missing" }, { status: 400 });
      await secretsRef().set({ clientId, clientSecret }, { merge: true });
      return NextResponse.json({ url: await authUrl(clientId) });
    }
    const s = await readSecrets();
    if (body.action === "connect") {
      if (!s.clientId) return NextResponse.json({ error: "not_configured" }, { status: 400 });
      return NextResponse.json({ url: await authUrl(s.clientId) });
    }
    if (!s.refreshToken) return NextResponse.json({ error: "not_connected" }, { status: 400 });
    const token = await accessToken(s);
    if (body.action === "sync") {
      const r = await linkForms(token);
      return NextResponse.json({ accounts: r.accounts, forms: r.forms.map((f) => ({ name: f.name, linked: !!f.integrationId, error: f.error || null })) });
    }
    if (body.action === "import") {
      // Leads from before the link (last 30 days), stopping before the function's time limit.
      const r = await importSnapLeads(token, Date.now() + 45_000);
      return NextResponse.json(r);
    }
    if (body.action === "test") {
      const f = (s.forms || []).find((x) => x.integrationId);
      if (!f) return NextResponse.json({ error: "no_forms" }, { status: 400 });
      const res = await fetch(SNAP_API + "/lead_gen/integrations/" + f.integrationId + "/test", { headers: { Authorization: "Bearer " + token } });
      return NextResponse.json({ ok: res.ok, form: f.name, status: res.status });
    }
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await secretsRef().set({ lastError: msg }, { merge: true }).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
