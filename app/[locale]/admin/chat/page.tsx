"use client";

/** "الدردشة" — one team channel; messages can link a client and @mention a colleague. */
import { useEffect, useRef, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { clientById, isMgrId, nameOf, visibleClients } from "@/lib/crm/logic";
import { sendChat, write } from "@/lib/crm/actions";
import { addDays, iso, today } from "@/lib/crm/util";
import { Empty, PageHeader, Pill } from "@/components/crm/ui";

export default function ChatPage() {
  const { data, chat, openClient, toast } = useCrm();
  const [text, setText] = useState("");
  const [cid, setCid] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const myName = nameOf(data, data.uid);

  useEffect(() => {
    if (box.current && atBottom.current) box.current.scrollTop = box.current.scrollHeight;
    const last = chat.length ? chat[chat.length - 1].at : null;
    const me = data.staff.find((s) => s.id === data.uid);
    if (last && me && (!me.chatSeen || me.chatSeen < last)) write("staff", data.uid, { chatSeen: last }, "update").catch(() => {});
  }, [chat, data.staff, data.uid]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    atBottom.current = true;
    try {
      await sendChat(data, t, cid || null);
    } catch {
      setText(t);
      toast("ما انرسلت، حاول مرة ثانية");
    }
  }

  const firstOfDay = new Set(chat.filter((m, i) => i === 0 || iso(new Date(chat[i - 1].at)) !== iso(new Date(m.at))).map((m) => m.id));
  return (
    <>
      <PageHeader eyebrow="الفريق" title="الدردشة" sub="قناة الفريق" />
      <div className="crm-card flex flex-col">
        <div ref={box} className="flex h-[min(60vh,560px)] flex-col gap-2 overflow-y-auto p-3.5"
          onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
          {!chat.length && <Empty>ابدأ أول رسالة للفريق.</Empty>}
          {chat.map((m) => {
            const d = iso(new Date(m.at));
            const sep = firstOfDay.has(m.id) ? (<div key={"d" + m.id} className="my-1.5 text-center"><span className="rounded-full bg-[var(--crm-surface-2)] px-2.5 py-0.5 text-xs text-[var(--crm-ink-3)]">{d === today() ? "اليوم" : d === addDays(-1) ? "أمس" : d}</span></div>) : null;
            const mine = m.by === data.uid;
            const ment = !mine && myName && myName !== "أنا" && m.text.includes("@" + myName);
            const tm = new Date(m.at);
            const c = clientById(data, m.clientId);
            return [
              sep,
              <div key={m.id} className={"flex max-w-[92%] items-end gap-2 md:max-w-[80%] " + (mine ? "self-end flex-row-reverse" : "")}>
                {!mine && <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--crm-surface-2)] text-xs font-semibold">{nameOf(data, m.by).slice(0, 1)}</div>}
                <div className={"min-w-20 rounded-xl px-3 py-1.5 " + (mine ? "bg-[var(--crm-gold-soft)]" : "bg-[var(--crm-surface-2)]") + (ment ? " outline-2 outline-[var(--crm-gold)]" : "")}>
                  {!mine && <div className="mb-0.5 text-[12.5px] font-semibold text-[var(--crm-gold-ink)]">{nameOf(data, m.by)} {isMgrId(data, m.by) && <Pill tone="gold">مدير</Pill>}</div>}
                  <div className="break-words whitespace-pre-wrap">{m.text}</div>
                  {c && <button type="button" className="crm-btn ghost sm !px-0" onClick={() => openClient(c.id)}>العميل: {c.name}</button>}
                  <div className="num mt-0.5 text-end text-[11px] text-[var(--crm-ink-3)]">{String(tm.getHours()).padStart(2, "0")}:{String(tm.getMinutes()).padStart(2, "0")}</div>
                </div>
              </div>,
            ];
          })}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[var(--crm-line)] px-3 py-2.5">
          <textarea rows={2} className="min-w-[240px] flex-1 resize-none" value={text} placeholder="اكتب رسالة للفريق… (Enter للإرسال، Shift+Enter لسطر جديد)"
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <select className="max-w-[160px]" aria-label="اربط عميل" value={cid} onChange={(e) => setCid(e.target.value)}>
            <option value="">بدون عميل</option>
            {visibleClients(data).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" className="crm-btn primary" onClick={send}>إرسال</button>
        </div>
        <div className="crm-hint px-3 pb-2.5">تقدر تنادي زميلك بكتابة @ واسمه. الرسائل تظهر لكل الفريق.</div>
      </div>
    </>
  );
}
