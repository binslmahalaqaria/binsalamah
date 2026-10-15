import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { activeStaffUid } from "@/lib/verify-staff";

/**
 * Suggested WhatsApp reply for the CRM inbox (app/[locale]/admin/whatsapp):
 * the browser sends the recent conversation, what the CRM knows about the
 * client, and matching available properties; Claude drafts one reply that
 * the employee edits or sends. Nothing is sent from here. Active staff only;
 * the Anthropic key (ANTHROPIC_API_KEY) never reaches the browser.
 */

const MODEL = "claude-opus-5-5";

// Stable instructions first so they cache across requests; per-chat data goes in the user turn.
const SYSTEM = `أنت تساعد موظف مبيعات في شركة «بن سلمه العقارية» (تسويق عقاري في الرياض) على الرد على عملاء واتساب.
اكتب ردًّا واحدًا يرسله الموظف للعميل الآن، بناءً على آخر رسائل المحادثة.

- اكتب بعربية مهذبة وواضحة تناسب محادثة واتساب مع عميل سعودي: ودودة ومختصرة (جملتان إلى أربع غالبًا)، بلا مبالغة ولا رموز تعبيرية كثيرة.
- رد على آخر ما كتبه العميل تحديدًا. إن كان سؤالًا تعرف جوابه من البيانات المرفقة فأجب، وإن لم تعرف فقل إن الموظف سيتأكد ويعود إليه.
- لا تخترع أسعارًا أو مساحات أو وحدات أو مواعيد غير موجودة في البيانات المرفقة، ولا تعِد بخصومات.
- إن كان العميل يبحث عن عقار ولم تتضح متطلباته فاسأله سؤالًا أو سؤالين فقط مما ينقص (نوع العقار، الحي، الميزانية، طريقة الدفع).
- إن وُجدت عقارات مناسبة في البيانات فاقترح أنسبها باختصار (الاسم، الحي، السعر) واعرض إرسال التفاصيل أو تحديد موعد معاينة.
- إن كانت آخر رسالة من الموظف نفسه ولم يرد العميل بعد، فاكتب متابعة لطيفة قصيرة.
- اكتب نص الرد فقط، بدون مقدمة أو شرح أو علامات اقتباس.`;

interface Body {
  messages: { fromMe: boolean; text: string; ts: number }[];
  client: string | null;
  properties: string[];
  staffName: string;
}

export async function POST(req: NextRequest) {
  const idToken = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    if (!(await activeStaffUid(idToken))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_key" }, { status: 503 });

  const b = (await req.json()) as Body;
  const transcript = (b.messages || [])
    .slice(-30)
    .map((m) => (m.fromMe ? "الموظف" : "العميل") + " (" + new Date(m.ts).toISOString().slice(0, 16).replace("T", " ") + "): " + m.text)
    .join("\n");
  const context =
    "اسم الموظف: " + (b.staffName || "—") + "\n" +
    "بيانات العميل في النظام: " + (b.client || "غير مسجّل في النظام بعد") + "\n" +
    "عقارات متاحة قد تناسبه:\n" + (b.properties?.length ? b.properties.map((p) => "- " + p).join("\n") : "لا يوجد") + "\n\n" +
    "المحادثة (الأقدم أولًا):\n" + transcript;

  const client = new Anthropic();
  try {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // A short chat reply: low effort is enough and keeps it fast.
      output_config: { effort: "low" },
      // If a safety classifier declines, the API re-runs the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: context }],
    });
    if (message.stop_reason === "refusal") return NextResponse.json({ error: "refusal" }, { status: 422 });
    const text = message.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("").trim();
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "bad_key" }, { status: 503 });
    if (error instanceof Anthropic.BadRequestError) return NextResponse.json({ error: "bad_request", detail: error.message }, { status: 400 });
    if (error instanceof Anthropic.APIError) return NextResponse.json({ error: "api_error", detail: error.message }, { status: 502 });
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
}
