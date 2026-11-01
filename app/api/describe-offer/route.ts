import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { activeStaffUid } from "@/lib/verify-staff";

/**
 * «✨ اكتب لي الوصف» in the website offer form (client 2026-11-01): turns the facts already typed into the form
 * (and any rough notes in the description box) into a tidy Arabic description. Active staff only; the Anthropic key
 * never reaches the browser. The model may only use the facts it is given — no invented numbers, features or promises.
 */

const MODEL = "claude-opus-5-5";

const SYSTEM = `أنت كاتب إعلانات عقارية لشركة «بن سلمه العقارية» في الرياض. تكتب وصفاً مرتباً وجذاباً لعرض عقاري يُنشر في موقع الشركة.
القواعد:
- اكتب بالعربية الفصحى المبسطة، بنبرة محترمة وواثقة، بدون مبالغة وبدون عبارات مثل «فرصة لا تعوّض» أو «الأفضل على الإطلاق».
- استخدم فقط المعلومات المعطاة لك. لا تخترع أرقاماً ولا مميزات ولا قرباً من أماكن ولا ضمانات. ما لم يُذكر لا تذكره.
- التنسيق نص عادي (بدون Markdown وبدون رموز # أو **):
  1) سطر افتتاحي واحد يلخص العقار (النوع والحي).
  2) سطر فارغ.
  3) نقاط قصيرة، كل نقطة في سطر تبدأ بـ «• »، مثل: «• المساحة: 315 م²». رتّب النقاط: الموقع، المساحة، الغرف ودورات المياه، الواجهة والشارع (إن ذُكرا)، المميزات، الضمانات، التسليم أو الحالة (إن ذُكرا).
  4) إن كانت هناك وحدات: سطر فارغ ثم «الوحدات المتاحة:» وتحته سطر لكل وحدة.
  5) لا تكتب السعر ولا رقم الجوال (يظهران في الصفحة).
- إن أعطاك المستخدم ملاحظات خام في حقل notes فأعد صياغة ما فيها بشكل مرتب دون إضافة جديدة.
- الطول: من 4 إلى 12 سطراً. أعد النص فقط بدون أي مقدمة أو شرح.`;

type Facts = Record<string, unknown>;

export async function POST(req: NextRequest) {
  const idToken = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    if (!(await activeStaffUid(idToken))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_key" }, { status: 503 });

  const facts = (await req.json()) as Facts;
  if (!facts || typeof facts !== "object" || !Object.keys(facts).length) return NextResponse.json({ error: "empty" }, { status: 400 });

  const client = new Anthropic();
  try {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1200,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: "معلومات العرض (JSON):\n" + JSON.stringify(facts) }],
    });
    if (message.stop_reason === "refusal") return NextResponse.json({ error: "refusal" }, { status: 422 });
    const text = message.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("").trim();
    if (!text) return NextResponse.json({ error: "empty_output" }, { status: 502 });
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "bad_key" }, { status: 503 });
    if (error instanceof Anthropic.APIError) return NextResponse.json({ error: "api_error", detail: error.message }, { status: 502 });
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
