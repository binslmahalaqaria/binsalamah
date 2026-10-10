"use client";

/**
 * "المساعد الذكي" — floating assistant panel, ported from the original
 * artifact CRM. Runs the Claude tool loop in the browser: each turn posts
 * the conversation to /api/assistant (which holds the API key), runs any
 * requested tools locally against live CRM data, and sends the results
 * back. The conversation is append-only (full assistant content, thinking
 * blocks included, is kept as-is) — "محادثة جديدة" starts over.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { assistantRules, buildTools, toolDefs, type OfferItem, type ToolCtx } from "@/lib/crm/assistant-tools";
import { reqSent, applyUpdate } from "@/lib/crm/actions";
import { addDays } from "@/lib/crm/util";
import { Icon } from "./ui";

type Msg = Anthropic.Beta.BetaMessageParam;
interface View {
  role: "user" | "assistant";
  text: string;
  actions: { label: string; kind: string | null; id: string | null }[];
  offer?: { title: string; pid: string; items: OfferItem[] };
  wa: { label: string; link: string }[];
  err?: string;
  pending?: boolean;
}

const ERR: Record<string, string> = {
  no_key: "المساعد يحتاج مفتاح Claude API على السيرفر (ANTHROPIC_API_KEY). كلّم المالك.",
  bad_key: "مفتاح Claude API غير صحيح. كلّم المالك.",
  rate_limited: "طلبات كثيرة ورا بعض، انتظر شوي وجرب.",
  forbidden: "حسابك ما عنده صلاحية على المساعد.",
  unauthorized: "سجّل دخولك من جديد.",
};
const MAX_STEPS = 15;

function mdLite(t: string) {
  return t.split("\n").map((line, i) => {
    const parts = line.replace(/^[-•] /, "• ").split(/\*\*(.+?)\*\*/g);
    return <div key={i}>{parts.map((p, j) => (j % 2 ? <b key={j}>{p}</b> : p))}{!line && " "}</div>;
  });
}

export function Assistant() {
  const { data, openClient, openModal, toast } = useCrm();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<View[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const hist = useRef<Msg[]>([]);
  const dataRef = useRef(data);
  const ctl = useRef<AbortController | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const tools = useMemo(() => buildTools(), []);
  const defs = useMemo(() => toolDefs(tools), [tools]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [views, open]);

  const patchLast = (f: (v: View) => View) => setViews((vs) => vs.map((v, i) => (i === vs.length - 1 ? f(v) : v)));

  async function send(textIn: string) {
    const text = textIn.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    ctl.current = new AbortController();
    hist.current.push({ role: "user", content: text });
    setViews((vs) => [...vs, { role: "user", text, actions: [], wa: [] }, { role: "assistant", text: "", actions: [], wa: [], pending: true }]);
    const ctx: ToolCtx = {
      act: (label, kind, id) => patchLast((v) => ({ ...v, actions: [...v.actions, { label, kind, id }] })),
      offer: (o) => patchLast((v) => ({ ...v, offer: o })),
      wa: (label, link) => patchLast((v) => ({ ...v, wa: [...v.wa, { label, link }] })),
    };
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ system: assistantRules(dataRef.current), tools: defs, messages: hist.current }),
          signal: ctl.current.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(ERR[body.error] || "صار خطأ، جرب مرة ثانية.");
        const msg = body as Anthropic.Beta.BetaMessage;
        // Keep the assistant turn exactly as returned (thinking/fallback blocks included).
        hist.current.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
        const said = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
        if (said) patchLast((v) => ({ ...v, text: said }));
        if (msg.stop_reason === "refusal") throw new Error("المساعد ما قدر ينفذ هذا الطلب.");
        if (msg.stop_reason === "max_tokens") throw new Error("الرد طويل مرة، جرب تقسم الطلب.");
        if (msg.stop_reason !== "tool_use") break;
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const b of msg.content) {
          if (b.type !== "tool_use") continue;
          const tool = tools.find((t) => t.name === b.name);
          try {
            if (!tool) throw new Error("أداة غير معروفة");
            const out = await tool.run(dataRef.current, (b.input || {}) as Record<string, unknown>, ctx);
            results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out ?? { ok: true }) });
          } catch (e) {
            results.push({ type: "tool_result", tool_use_id: b.id, content: e instanceof Error ? e.message : "فشل التنفيذ", is_error: true });
          }
        }
        hist.current.push({ role: "user", content: results });
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) patchLast((v) => ({ ...v, err: e instanceof Error ? e.message : "صار خطأ" }));
      // Leave history valid: if the last turn is our unanswered user text, drop it so the next message starts cleanly.
      const last = hist.current[hist.current.length - 1];
      if (last?.role === "user" && typeof last.content === "string") hist.current.pop();
      // Stopped between a tool request and its results: answer each call so the next turn stays valid.
      else if (last?.role === "assistant" && Array.isArray(last.content)) {
        const pendingCalls = last.content.filter((b) => b.type === "tool_use") as Anthropic.Beta.BetaToolUseBlockParam[];
        if (pendingCalls.length)
          hist.current.push({ role: "user", content: pendingCalls.map((b) => ({ type: "tool_result" as const, tool_use_id: b.id, content: "انلغى قبل التنفيذ", is_error: true })) });
      }
    } finally {
      patchLast((v) => ({ ...v, pending: false }));
      setBusy(false);
      ctl.current = null;
    }
  }

  const openAct = (kind: string | null, id: string | null) => {
    if (!id) return;
    if (window.innerWidth < 900) setOpen(false);
    if (kind === "client") openClient(id);
    else if (kind === "property") openModal({ kind: "property", id });
    else if (kind === "task") openModal({ kind: "task", id });
    else if (kind === "request") openModal({ kind: "request", id });
  };

  const sugs = [
    "وش اتصالاتي اليوم؟",
    "طلب جديد: خالد 0551234567 يبي فيلا في الملقا أو حطين، ميزانيته 3 مليون، تمويل بنكي",
    "فهد أرسلت له الموقع، كلمه بعد 3 أيام",
    "سوّ لي مهمة بكرة: معاينة فيلا النرجس",
    "عرض: فيلا 300م في الملقا بـ 3.2 مليون، مين يناسبه؟",
  ].concat(data.isMgr ? ["وزّع العملاء غير المسندين على الموظفين بالتساوي", "عطني ملخص أداء الفريق اليوم"] : []);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="افتح المساعد الذكي"
        className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] end-4 z-[12] flex items-center gap-2 rounded-full border border-[var(--crm-gold)]/50 bg-[#262626] px-4.5 py-3 font-semibold text-[#efeae3] shadow-[0_6px_24px_rgb(0_0_0/.25)] md:bottom-5 md:end-5">
        <span className="text-[var(--crm-gold)]">✦</span> المساعد
      </button>
    );

  return (
    <aside role="dialog" aria-label="المساعد الذكي" dir="rtl"
      className="fixed inset-y-0 end-0 z-[35] flex w-[min(440px,100%)] flex-col border-s border-[var(--crm-line)] bg-white shadow-[0_0_40px_rgb(0_0_0/.18)]">
      <div className="flex items-center justify-between border-b border-[var(--crm-line)] px-3.5 py-3">
        <b className="font-heading"><span className="text-[var(--crm-gold)]">✦</span> المساعد الذكي</b>
        <div className="flex gap-1">
          {views.length > 0 && !busy && (
            <button type="button" className="crm-btn ghost sm" onClick={() => { hist.current = []; setViews([]); }}>محادثة جديدة</button>
          )}
          <button type="button" className="crm-btn ghost icon" aria-label="إغلاق" onClick={() => setOpen(false)}><Icon k="close" size={18} /></button>
        </div>
      </div>

      <div ref={box} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3.5">
        {!views.length && (
          <div>
            <p className="mb-2.5 text-sm text-[var(--crm-ink-2)]">اكتب لي وش تبي وأنا أسويه داخل النظام: أسجّل الطلبات والعملاء، أضيف عقارات، أسجّل التحديثات، أسوي مهام، أوزّع العملاء، وأجهّز رسائل واتساب.</p>
            <div className="flex flex-col gap-1.5">
              {sugs.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}
                  className="rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface-2)] px-2.5 py-2 text-start text-[13.5px] hover:border-[var(--crm-gold)]">{s}</button>
              ))}
            </div>
          </div>
        )}
        {views.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="max-w-[92%] self-start rounded-xl bg-[var(--crm-ink)] px-3 py-2 text-[14.5px] whitespace-pre-wrap text-white">{m.text}</div>
          ) : (
            <div key={i} className="grid w-full max-w-full gap-2 self-end rounded-xl bg-[var(--crm-surface-2)] px-3 py-2 text-[14.5px]">
              {m.text ? <div className="break-words">{mdLite(m.text)}</div> : m.pending && <div className="animate-pulse text-[13.5px] text-[var(--crm-ink-3)]">{m.actions.length ? "أنفّذ…" : "أفكر…"}</div>}
              {m.actions.length > 0 && (
                <div className="grid gap-1 border-t border-[var(--crm-line)] pt-1.5">
                  {m.actions.map((a, j) => (
                    <div key={j} className="flex flex-wrap items-center gap-1 text-[13px] text-[var(--crm-ok)]">
                      ✓ {a.label}
                      {a.id && a.kind && <button type="button" className="crm-btn ghost sm !py-0.5" onClick={() => openAct(a.kind, a.id)}>فتح</button>}
                    </div>
                  ))}
                </div>
              )}
              {m.offer && (
                <div className="grid gap-0.5 border-t border-[var(--crm-line)] pt-1.5">
                  <b className="mb-1 text-[13px]">{m.offer.items.length ? m.offer.items.length + " عميل يناسبهم: " + m.offer.title : "ما لقيت عملاء يناسبهم: " + m.offer.title}</b>
                  {m.offer.items.map((x) => (
                    <div key={x.cid} className="flex items-center gap-2 border-t border-dashed border-[var(--crm-line)] py-1.5 first:border-0">
                      <span className="num min-w-[38px] font-heading text-[var(--crm-gold-ink)]">{x.score}%</span>
                      <div className="grid min-w-0 flex-1">
                        <b className="link text-sm" onClick={() => openAct("client", x.cid)}>{x.name}</b>
                        <small className="truncate text-[11.5px] text-[var(--crm-ink-3)]">{x.why}{data.isMgr && x.as ? " · " + x.as : ""}</small>
                      </div>
                      {x.link ? (
                        <a className="crm-btn sm wa" href={x.link} target="_blank" rel="noopener" onClick={() => {
                          const d = dataRef.current;
                          (m.offer!.pid && x.rid ? reqSent(d, x.rid, m.offer!.pid) : applyUpdate(d, x.cid, "تم إرسال التفاصيل", addDays(3), "عرض: " + m.offer!.title, null))
                            .then(() => toast("سجّلت: أرسلت العرض — اتصال بعد 3 أيام"));
                        }}>أرسل</a>
                      ) : <span className="muted text-xs">بدون جوال</span>}
                    </div>
                  ))}
                </div>
              )}
              {m.wa.map((w, j) => <a key={j} className="crm-btn sm wa justify-self-start" href={w.link} target="_blank" rel="noopener">{w.label}</a>)}
              {m.err && <div className="text-[13px] text-[var(--crm-danger)]">{m.err}</div>}
            </div>
          )
        )}
      </div>

      <div className="flex gap-2 border-t border-[var(--crm-line)] px-3 py-2.5">
        <textarea rows={2} className="flex-1 resize-none" value={input} disabled={busy} placeholder="مثال: طلب جديد لسعد 0550000000 يبي شقة في الياسمين…"
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
        {busy ? (
          <button type="button" className="crm-btn" onClick={() => ctl.current?.abort()}>إيقاف</button>
        ) : (
          <button type="button" className="crm-btn primary" onClick={() => send(input)}>نفّذ</button>
        )}
      </div>
      <div className="crm-hint px-3 pb-2.5">راجع اللي سواه المساعد من زر &quot;فتح&quot;.</div>
    </aside>
  );
}
