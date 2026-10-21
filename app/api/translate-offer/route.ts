import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { activeStaffUid } from "@/lib/verify-staff";

/**
 * English for an offer's Arabic text (client 2026-10-21: the English site must not show Arabic).
 * The offer form sends only the fields that have no English yet; Claude returns them in the same
 * JSON shape. Active staff only; the Anthropic key (ANTHROPIC_API_KEY) never reaches the browser.
 */

const MODEL = "claude-opus-5-5";

const SYSTEM = `You translate Saudi real-estate listing text from Arabic to English for the website of Bin Slmah Real Estate (Riyadh).
- You receive a JSON object. Return a JSON object with exactly the same keys and shape (strings stay strings, arrays keep their length and order).
- Write natural, polished English for property buyers. Keep numbers, prices and units as they are.
- Riyadh district names: use the common English transliteration (e.g. الملقا → Al Malqa, النرجس → An Narjis, حطين → Hittin). Cities: الرياض → Riyadh.
- Unit names such as «دور أرضي» → "Ground floor", «دور أول» → "First floor", «ملحق علوي» → "Rooftop annex", «فيلا A» → "Villa A", «شقة 3» → "Apartment 3".
- Multi-line text keeps one line per line.
- Return only the JSON object, no explanation and no code fences.`;

type Payload = Record<string, string | string[]>;

export async function POST(req: NextRequest) {
  const idToken = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    if (!(await activeStaffUid(idToken))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_key" }, { status: 503 });

  const fields = (await req.json()) as Payload;
  if (!fields || typeof fields !== "object" || !Object.keys(fields).length) return NextResponse.json({ fields: {} });

  const client = new Anthropic();
  try {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(fields) }],
    });
    if (message.stop_reason === "refusal") return NextResponse.json({ error: "refusal" }, { status: 422 });
    const text = message.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("").trim()
      .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const out = JSON.parse(text) as Payload;
    // Keep only keys that were asked for, with the same shape.
    const clean: Payload = {};
    for (const [k, v] of Object.entries(fields)) {
      const t = out[k];
      if (Array.isArray(v) ? Array.isArray(t) && t.length === v.length && t.every((x) => typeof x === "string") : typeof t === "string") clean[k] = t;
    }
    return NextResponse.json({ fields: clean });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "bad_output" }, { status: 502 });
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "bad_key" }, { status: 503 });
    if (error instanceof Anthropic.APIError) return NextResponse.json({ error: "api_error", detail: error.message }, { status: 502 });
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
