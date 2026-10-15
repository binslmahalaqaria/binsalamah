import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { activeStaffUid } from "@/lib/verify-staff";

/**
 * CRM AI assistant: one Claude Messages API turn per request. The browser
 * runs the tool loop itself (components/crm/Assistant.tsx) — tools execute
 * client-side with the staff member's own Firestore permissions, exactly
 * like the rest of the CRM — and posts the full conversation here each
 * turn. This route only (1) checks the caller is an active staff member and
 * (2) holds the Anthropic API key (ANTHROPIC_API_KEY), which must never
 * reach the browser. See CLAUDE.md §1/§11.
 *
 * Staff check uses the caller's own ID token against the Firestore REST
 * API (staff may read their own doc), so it needs no service-account key.
 */

const MODEL = "claude-opus-5-5";

export async function POST(req: NextRequest) {
  const idToken = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    if (!(await activeStaffUid(idToken))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_key" }, { status: 503 });

  const body = (await req.json()) as {
    system: string;
    tools: Anthropic.Beta.BetaTool[];
    messages: Anthropic.Beta.BetaMessageParam[];
  };

  const client = new Anthropic();
  try {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Opus 5.5 always thinks; effort is the depth control (its default is medium — set explicitly).
      output_config: { effort: "medium" },
      // If a safety classifier declines, the API re-runs the turn on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: body.system,
      tools: body.tools,
      messages: body.messages,
    });
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "bad_key" }, { status: 503 });
    if (error instanceof Anthropic.BadRequestError) return NextResponse.json({ error: "bad_request", detail: error.message }, { status: 400 });
    if (error instanceof Anthropic.APIError) return NextResponse.json({ error: "api_error", detail: error.message }, { status: 502 });
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
