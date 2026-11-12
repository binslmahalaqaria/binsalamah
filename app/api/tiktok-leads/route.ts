import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/snap-server";
import { readTt, ttSignatureOk } from "@/lib/tiktok-server";

/**
 * TikTok Instant Form webhook (client 2026-11-12). Each event: { entry: [{ page_id, campaign_name, adgroup_name,
 * ad_name, create_time, changes: [{ field, value }] }] }, signed in X-Open-Signature with the app secret. Each lead is
 * stored in `leads` as source «tiktok» (doc id from a hash of the form, time and answers, so TikTok's retries never
 * duplicate it); WebLeadDispatcher turns it into a client + request for the next employee, like Snap and the website.
 */
export const runtime = "nodejs";

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const LABEL: Record<string, string> = { email: "الإيميل", city: "المدينة", address: "العنوان", gender: "الجنس", scheduled_time: "الوقت المناسب" };

export async function POST(req: NextRequest) {
  let secret: string | undefined;
  try { secret = (await readTt()).secret; } catch { return NextResponse.json({ error: "secrets_unavailable" }, { status: 503 }); }
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  if (!ttSignatureOk(raw, req.headers.get("x-open-signature"), secret)) return NextResponse.json({ error: "bad_signature" }, { status: 401 });

  let body: { entry?: Record<string, unknown>[] };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  let saved = 0;
  for (const e of body.entry || []) {
    const ans = new Map<string, string>();
    for (const c of (e.changes as { field?: string; value?: unknown }[]) || []) if (c?.field) ans.set(String(c.field), str(c.value));
    const name = ans.get("name") || [ans.get("first_name"), ans.get("last_name")].filter(Boolean).join(" ");
    const phone = ans.get("phone_number") || ans.get("phone") || "";
    const extra = [...ans.entries()].filter(([k]) => !["name", "first_name", "last_name", "phone_number", "phone"].includes(k)).map(([k, v]) => (LABEL[k] || k) + ": " + v);
    const message = [
      "عميل من إعلان تيك توك",
      str(e.campaign_name) && "الحملة: " + str(e.campaign_name),
      str(e.ad_name) && "الإعلان: " + str(e.ad_name),
      ...extra,
    ].filter(Boolean).join(" | ");
    const key = str(e.lead_id) || createHash("sha256").update([str(e.page_id), str(e.create_time), phone, name].join("|")).digest("hex").slice(0, 32);
    try {
      await db().collection("leads").doc("tt_" + key.replace(/[^\w-]/g, "")).create({
        customer_name: (name || "عميل تيك توك").slice(0, 150), phone, email: ans.get("email") || null,
        source: "tiktok", related_offer_id: null, message: message.slice(0, 2000), status: "new", assigned_to: null, notes: [],
        tiktok: { page_id: str(e.page_id), campaign_id: str(e.campaign_id), campaign_name: str(e.campaign_name), adgroup_name: str(e.adgroup_name), ad_id: str(e.ad_id), ad_name: str(e.ad_name), create_time: str(e.create_time) },
        created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
      });
      saved++;
    } catch (x) {
      if ((x as { code?: number }).code !== 6) throw x; // 6 = ALREADY_EXISTS (a retry)
    }
  }
  return NextResponse.json({ ok: true, saved });
}
