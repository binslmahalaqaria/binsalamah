import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { adminApp } from "@/lib/firebase-admin";
import { readSecrets } from "@/lib/snap-server";

/**
 * Snapchat lead-form webhook (client 2026-11-12: Snap Ads leads straight into the CRM).
 *
 * Snap posts each lead here as it is submitted (Marketing API «PUBLIC_WEBHOOK» integration, one per form). Every
 * event is signed: HMAC-SHA256 with the ad account's `hmacSecret` over `<t header>.<raw body>`, hex. The secret
 * is saved in `secrets/snap` when the forms are linked (lib/snap-server.ts); without it nothing is accepted. The lead is stored in `leads`
 * (source «snapchat», doc id `snap_<lead_id>` so a retry never duplicates it); the CRM's WebLeadDispatcher turns
 * it into a client + request for the next employee in turn, exactly like a website request.
 */
export const runtime = "nodejs";

const hex = (s: string) => /^[0-9a-f]{64}$/i.test(s);

function signatureOk(req: NextRequest, raw: string, secret: string) {
  const t = req.headers.get("t") || req.headers.get("x-snap-timestamp") || "";
  const want = createHmac("sha256", secret).update(t + "." + raw, "utf8").digest("hex");
  // Snap's guide names it only «the Signature header»: accept any signature-like header carrying the hex digest.
  for (const [name, value] of req.headers.entries()) {
    if (!/sign/i.test(name)) continue;
    for (const part of value.split(/[,\s]+/)) {
      const v = part.replace(/^(sha256|v1|s)=/i, "").trim();
      if (hex(v) && timingSafeEqual(Buffer.from(v.toLowerCase()), Buffer.from(want))) return true;
    }
  }
  return false;
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());

export async function POST(req: NextRequest) {
  // The secret Snap returned when the forms were linked (secrets/snap), or a Vercel env override.
  const secret = process.env.SNAP_HMAC_SECRET || (await readSecrets()).hmacSecret;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  if (!signatureOk(req, raw, secret)) return NextResponse.json({ error: "bad_signature" }, { status: 401 });

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  // One lead per event, or a list of them.
  const items = (Array.isArray(body) ? body : Array.isArray((body as { leads?: unknown[] })?.leads) ? (body as { leads: unknown[] }).leads : [body]) as Record<string, unknown>[];

  const db = getFirestore(adminApp);
  let saved = 0;
  for (const l of items) {
    const leadId = str(l.lead_id);
    if (!leadId) continue;
    const name = [str(l.first_name), str(l.last_name)].filter(Boolean).join(" ") || str(l.full_name);
    const custom = Array.from({ length: 8 }, (_, i) => str(l["custom_field_" + (i + 1)])).filter(Boolean);
    const message = [
      "عميل من إعلان سناب",
      str(l.campaign_name) && "الحملة: " + str(l.campaign_name),
      str(l.ad_name) && "الإعلان: " + str(l.ad_name),
      str(l.form_name) && "النموذج: " + str(l.form_name),
      str(l.email) && "الإيميل: " + str(l.email),
      str(l.address_level_2 || l.address_level_1) && "المدينة: " + str(l.address_level_2 || l.address_level_1),
      ...custom.map((c) => "إجابة: " + c),
    ].filter(Boolean).join(" | ");
    const ref = db.collection("leads").doc("snap_" + leadId.replace(/[^\w-]/g, ""));
    // create() fails when the lead is already stored: a retried event is simply acknowledged.
    try {
      await ref.create({
        customer_name: (name || "عميل سناب").slice(0, 150), phone: str(l.phone_number), email: str(l.email) || null,
        source: "snapchat", related_offer_id: null, message: message.slice(0, 2000), status: "new", assigned_to: null, notes: [],
        snap: {
          lead_id: leadId, form_id: str(l.form_id), form_name: str(l.form_name), campaign_id: str(l.campaign_id), campaign_name: str(l.campaign_name),
          ad_squad_name: str(l.ad_squad_name), ad_id: str(l.ad_id), ad_name: str(l.ad_name), ad_account_id: str(l.ad_account_id), create_time: str(l.create_time),
        },
        created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
      });
      saved++;
    } catch (e) {
      if ((e as { code?: number }).code !== 6) throw e; // 6 = ALREADY_EXISTS
    }
  }
  return NextResponse.json({ ok: true, saved });
}
