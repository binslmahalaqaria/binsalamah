"use client";

/**
 * "الدردشة" — the team channel plus private one-to-one conversations with each
 * colleague. Channel messages are seen by everyone (and can @mention someone);
 * private messages only by the two people in the conversation. Any message can
 * link a client. Unread private messages are counted per colleague.
 */
import { useEffect, useRef, useState } from "react";
import { clock, fmtStamp } from "@/lib/crm/util";
import { isOnline } from "@/lib/crm/presence";
import { useCrm } from "@/lib/crm/store";
import { clientById, isMgrId, members, nameOf, wantLine } from "@/lib/crm/logic";
import { markDmRead, sendChat, sendDm, write } from "@/lib/crm/actions";
import { isPreview } from "@/lib/crm/preview";
import { addDays, iso, today } from "@/lib/crm/util";
import { Empty, PageHeader, Pill } from "@/components/crm/ui";
import { ChatAttach, reqLabel, type Attached } from "@/components/crm/ChatAttach";

const CHANNEL = "";
interface Msg { id: string; by: string; text: string; at: string; clientId: string | null; reqId?: string | null; read?: boolean }

export default function ChatPage() {
  const { data, chat, dms, dmBlocked, openClient, toast, previewAs } = useCrm();
  const [peer, setPeer] = useState<string>(CHANNEL);
  const [text, setText] = useState("");
  const [att, setAtt] = useState<Attached | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const myName = nameOf(data, data.uid);
  const me = data.uid;

  // Re-evaluate online/offline as time passes (the staff list itself only changes when someone writes).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(iv); }, []);
  const online = (id: string) => isOnline(data.staff.find((s) => s.id === id), now);
  const lastSeenOf = (id: string) => data.staff.find((s) => s.id === id)?.lastSeen;

  const msgs: Msg[] = peer === CHANNEL ? chat : dms.filter((m) => m.members.includes(peer));

  // Channel: remember the last seen message. Private: mark what was sent to me as read.
  useEffect(() => {
    if (box.current && atBottom.current) box.current.scrollTop = box.current.scrollHeight;
    if (peer === CHANNEL) {
      const last = chat.length ? chat[chat.length - 1].at : null;
      const st = data.staff.find((s) => s.id === me);
      if (last && st && !isPreview() && (!st.chatSeen || st.chatSeen < last)) write("staff", me, { chatSeen: last }, "update").catch(() => {});
    } else {
      markDmRead(dms.filter((m) => m.members.includes(peer) && m.to === me && !m.read).map((m) => m.id));
    }
  }, [chat, dms, peer, data.staff, me]);

  async function send() {
    // A request or client can go alone, with a short line as the message text.
    const attC = att ? clientById(data, att.clientId) : null;
    const attR = att?.reqId ? data.requests.find((r) => r.id === att.reqId) : null;
    const t = text.trim() || (attC ? (attR ? reqLabel(attR) + " — " : "العميل: ") + attC.name : "");
    if (!t) return;
    setText("");
    atBottom.current = true;
    try {
      if (peer === CHANNEL) await sendChat(data, t, att?.clientId || null, att?.reqId || null);
      else await sendDm(data, peer, t, att?.clientId || null, att?.reqId || null);
      setAtt(null);
    } catch {
      setText(t);
      toast(peer !== CHANNEL && dmBlocked ? "الرسائل الخاصة تحتاج نشر قواعد الأمان الجديدة في Firebase" : "لم تُرسل الرسالة، يرجى المحاولة مجدداً");
    }
  }

  // Conversation list: the channel, then colleagues by latest private message.
  const st = data.staff.find((s) => s.id === me);
  const channelUnread = chat.filter((m) => m.by !== me && (!st?.chatSeen || m.at > st.chatSeen)).length;
  const people = [...new Set([...members(data), ...data.staff.filter((s) => s.active && (s.role === "admin" || s.role === "manager")).map((s) => s.id)])].filter((id) => id !== me);
  const lastWith = (id: string) => dms.filter((m) => m.members.includes(id)).slice(-1)[0];
  const unreadFrom = (id: string) => dms.filter((m) => m.by === id && m.to === me && !m.read).length;
  people.sort((a, b) => (lastWith(b)?.at || "").localeCompare(lastWith(a)?.at || "") || nameOf(data, a).localeCompare(nameOf(data, b)));

  const firstOfDay = new Set(msgs.filter((m, i) => i === 0 || iso(new Date(msgs[i - 1].at)) !== iso(new Date(m.at))).map((m) => m.id));
  const title = peer === CHANNEL ? "قناة الفريق" : nameOf(data, peer);

  return (
    <>
      <PageHeader eyebrow="الفريق" title="الدردشة" sub="قناة الفريق والمحادثات الخاصة بين الموظفين" />
      <div className="crm-card grid overflow-hidden md:grid-cols-[260px_minmax(0,1fr)]">
        {/* conversations */}
        <div className={"grid content-start border-[var(--crm-line)] md:border-e " + (peer !== CHANNEL ? "max-md:hidden" : "")}>
          <Conv on={peer === CHANNEL} onClick={() => setPeer(CHANNEL)} name="قناة الفريق" sub={chat.length ? chat[chat.length - 1].text : "رسائل لكل الفريق"} badge={peer === CHANNEL ? 0 : channelUnread} icon="#" />
          <div className="px-3.5 pt-3 pb-1 text-[12px] text-[var(--crm-ink-3)]">رسائل خاصة</div>
          {previewAs ? <p className="crm-hint m-0 px-3.5 pb-3">الرسائل الخاصة لا تظهر في وضع المعاينة.</p>
            : people.map((id) => {
              const l = lastWith(id);
              return <Conv key={id} on={peer === id} onClick={() => setPeer(id)} name={nameOf(data, id)} sub={l ? (l.by === me ? "أنت: " : "") + l.text : isMgrId(data, id) ? "مدير" : "ابدأ محادثة"} badge={unreadFrom(id)} icon={nameOf(data, id).slice(0, 1)} online={online(id)} />;
            })}
        </div>

        {/* messages */}
        <div className={"flex min-w-0 flex-col " + (peer === CHANNEL ? "max-md:hidden md:flex" : "")}>
          <div className="flex items-center gap-2 border-b border-[var(--crm-line)] px-3.5 py-2.5">
            {peer !== CHANNEL && <button type="button" className="crm-btn ghost sm md:hidden" onClick={() => setPeer(CHANNEL)}>رجوع</button>}
            <b className="flex-1">{title}</b>
            <span className="text-[12px] text-[var(--crm-ink-3)]">
              {peer === CHANNEL ? "تظهر لجميع أعضاء الفريق · " + people.filter(online).length + " متصل" : (
                <>
                  <span className={online(peer) ? "font-semibold text-[var(--crm-ok)]" : ""}>{online(peer) ? "● متصل الآن" : "○ غير متصل" + (lastSeenOf(peer) ? " · آخر ظهور " + fmtStamp(lastSeenOf(peer)) : "")}</span>
                  {" · 🔒 بينكما فقط"}
                </>
              )}
            </span>
          </div>
          <div ref={box} className="flex h-[min(60vh,560px)] flex-col gap-2 overflow-y-auto p-3.5"
            onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
            {peer !== CHANNEL && dmBlocked && <Empty>الرسائل الخاصة تحتاج نشر قواعد الأمان الجديدة في Firebase (firestore.rules) قبل استخدامها.</Empty>}
            {!msgs.length && !(peer !== CHANNEL && dmBlocked) && <Empty>{peer === CHANNEL ? "ابدأ أول رسالة للفريق." : "ابدأ محادثة خاصة مع " + title + "."}</Empty>}
            {msgs.map((m) => {
              const d = iso(new Date(m.at));
              const sep = firstOfDay.has(m.id) ? (<div key={"d" + m.id} className="my-1.5 text-center"><span className="rounded-full bg-[var(--crm-surface-2)] px-2.5 py-0.5 text-xs text-[var(--crm-ink-3)]">{d === today() ? "اليوم" : d === addDays(-1) ? "أمس" : d}</span></div>) : null;
              const mine = m.by === me;
              const ment = peer === CHANNEL && !mine && myName && myName !== "أنا" && m.text.includes("@" + myName);
              const tm = new Date(m.at);
              const c = clientById(data, m.clientId);
              const r = m.reqId ? data.requests.find((x) => x.id === m.reqId) : null;
              return [
                sep,
                <div key={m.id} className={"flex max-w-[92%] items-end gap-2 md:max-w-[80%] " + (mine ? "self-end flex-row-reverse" : "")}>
                  {!mine && peer === CHANNEL && <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--crm-surface-2)] text-xs font-semibold">{nameOf(data, m.by).slice(0, 1)}</div>}
                  <div className={"min-w-20 rounded-xl px-3 py-1.5 " + (mine ? "bg-[var(--crm-gold-soft)]" : "bg-[var(--crm-surface-2)]") + (ment ? " outline-2 outline-[var(--crm-gold)]" : "")}>
                    {!mine && peer === CHANNEL && <div className="mb-0.5 text-[12.5px] font-semibold text-[var(--crm-gold-ink)]">{nameOf(data, m.by)} {isMgrId(data, m.by) && <Pill tone="gold">مدير</Pill>}</div>}
                    <div className="break-words whitespace-pre-wrap">{m.text}</div>
                    {c && (
                      <button type="button" className="mt-1 grid w-full rounded-lg border border-[var(--crm-line)] bg-white px-2.5 py-1.5 text-start" onClick={() => openClient(c.id, r?.id)}>
                        <b className="text-[13.5px]">{r ? reqLabel(r) + " · " : "العميل: "}{c.name}</b>
                        {c.phone && <span className="num text-[12.5px] text-[var(--crm-ink-2)]">{c.phone}</span>}
                        {r && <span className="text-[12.5px] text-[var(--crm-ink-3)]">{wantLine(data, c)}</span>}
                      </button>
                    )}
                    <div className="num mt-0.5 text-end text-[11px] text-[var(--crm-ink-3)]">
                      {clock(tm)}
                      {mine && peer !== CHANNEL && <span className={m.read ? "text-[#53bdeb]" : ""}> {m.read ? "✓✓ قُرئت" : "✓"}</span>}
                    </div>
                  </div>
                </div>,
              ];
            })}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[var(--crm-line)] px-3 py-2.5">
            <ChatAttach value={att} onChange={setAtt} />
            <textarea rows={2} className="min-w-[240px] flex-1 resize-none" value={text}
              placeholder={(peer === CHANNEL ? "اكتب رسالة للفريق" : "رسالة خاصة إلى " + title) + "… (Enter للإرسال، Shift+Enter لسطر جديد)"}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button type="button" className="crm-btn primary" onClick={send}>إرسال</button>
          </div>
          {peer === CHANNEL && <div className="crm-hint px-3 pb-2.5">يمكنك الإشارة إلى زميلك بكتابة @ متبوعة باسمه. تظهر الرسائل لجميع أعضاء الفريق.</div>}
        </div>
      </div>
    </>
  );
}

function Conv({ on, onClick, name, sub, badge, icon, online }: { on: boolean; onClick: () => void; name: string; sub: string; badge: number; icon: string; online?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={"flex items-center gap-2.5 border-b border-[var(--crm-line)] px-3.5 py-2.5 text-start hover:bg-[var(--crm-surface-2)] " + (on ? "bg-[var(--crm-surface-2)]" : "")}>
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--crm-ink)] text-[14px] font-semibold text-white">{icon}{online !== undefined && <i className={"absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-white " + (online ? "bg-[var(--crm-ok)]" : "bg-[#b5b5b5]")} />}</span>
      <span className="grid min-w-0 flex-1">
        <b className="truncate text-[14px]">{name}</b>
        <span className="truncate text-[12.5px] text-[var(--crm-ink-3)]">{sub}</span>
      </span>
      {badge > 0 && <span className="num rounded-full bg-[var(--crm-danger)] px-1.5 text-[11px] font-bold leading-[18px] text-white">{badge}</span>}
    </button>
  );
}
