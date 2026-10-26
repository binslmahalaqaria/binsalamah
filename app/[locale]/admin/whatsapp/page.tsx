"use client";

/**
 * "واتساب" — unified inbox over every linked WhatsApp number (company numbers
 * and employees' own), served by /wa-server, laid out like WhatsApp Web. Per
 * number: QR linking, a default employee, and who may see it. Per chat: reply,
 * WhatsApp Business labels (synced both ways), link to the CRM client or add
 * them, record the next action, and CRM tags. Employees see the numbers they
 * own or receive, plus their own clients' chats on team numbers.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCrm } from "@/lib/crm/store";
import { can, matchesForReq, members, nameOf, propPrice, reqsOf, visibleClients, wantLine } from "@/lib/crm/logic";
import { auth } from "@/lib/firebase";
import type { Client } from "@/lib/crm/types";
import { normPhone, nowStamp, waLink } from "@/lib/crm/util";
import { createClient, isPhoneTaken, PHONE_TAKEN } from "@/lib/crm/actions";
import { TO_CONTACT } from "@/lib/crm/constants";
import {
  localPhone, seesAllOf, waApi as api, waTime as timeOf, WA_LABEL_COLORS, WA_STATUS_AR,
  type WaChat as Chat, type WaLabel, type WaMsg as Msg, type WaSource as Source,
} from "@/lib/crm/wa";
import { ConfirmButton, Empty, PageHeader, Pill } from "@/components/crm/ui";
import { WaImport } from "@/components/crm/WaImport";
import { AttachButton, MediaBody, VoiceRecorder, captionOf } from "@/components/crm/WaMedia";
import { WaSendProperty } from "@/components/crm/WaSendProperty";

const dot = (st: string) => (st === "open" ? "bg-[var(--crm-ok)]" : st === "loggedOut" || st === "error" ? "bg-[var(--crm-danger)]" : "bg-[var(--crm-warn)]");
const key = (c: { source: string; jid: string }) => c.source + "|" + c.jid;
const labelColor = (l?: WaLabel) => WA_LABEL_COLORS[(l?.color ?? 0) % WA_LABEL_COLORS.length];

/* WhatsApp Web palette */
const WA = { panel: "#f0f2f5", line: "#e9edef", ink: "#111b21", ink2: "#667781", green: "#00a884", unread: "#25d366", out: "#d9fdd3", wall: "#efeae2" };
const AVATAR = ["#00a884", "#53bdeb", "#ff8a8c", "#a5b337", "#ffbc38", "#7f66ff", "#e26ab6", "#06cf9c"];
const avatarBg = (s: string) => AVATAR[[...s].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR.length];

function Avatar({ name, size = 49 }: { name: string; size?: number }) {
  const ch = [...(name.replace(/^[+\d\s]+$/, "") || "؟").trim()][0] || "؟";
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: avatarBg(name), fontSize: size * 0.4 }}>{/\d|\+/.test(ch) ? "👤" : ch}</span>
  );
}

/** "اليوم" / "أمس" / d/m/yyyy, for the date pills between messages. */
function dayLabel(ts: number) {
  const d = new Date(ts), now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "اليوم";
  if (d.toDateString() === y.toDateString()) return "أمس";
  return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
}
const clock = (ts: number) => new Date(ts).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" });

/** Suggested replies (app/api/wa-suggest): on since ANTHROPIC_API_KEY was set on Vercel (2026-10-18). */
const SUGGEST_ON = true;

export default function WhatsAppPage() {
  return <Suspense fallback={<Empty>جارٍ التحميل…</Empty>}><WhatsAppInbox /></Suspense>;
}

function WhatsAppInbox() {
  const { data, loaded, openClient, openModal, toast, previewAs } = useCrm();
  const [rawSources, setSources] = useState<Source[] | null>(null);
  const [down, setDown] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [labels, setLabels] = useState<WaLabel[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "unread" | "clients" | "new">("all");
  const [srcF, setSrcF] = useState("");
  const [labelF, setLabelF] = useState("");
  const [tagF, setTagF] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Deep link from a client ("💬 واتساب" / "📤 إرسال الطلب"): ?phone=9665…&text=draft
  const sp = useSearchParams();
  const wantPhone = sp.get("phone"), draft = sp.get("text");
  const [extra, setExtra] = useState<Chat | null>(null);
  const handled = useRef("");
  const endRef = useRef<HTMLDivElement>(null);
  const scrollBox = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // keep the view at the newest message unless the user scrolled up to read
  const [recording, setRecording] = useState(false);
  const [showProp, setShowProp] = useState(false);
  const [tools, setTools] = useState(false); // phone: CRM actions, labels and tags fold behind «⋮»
  const allowed = loaded && can(data, "whatsapp");

  const byPhone = useMemo(() => {
    const m = new Map<string, Client>();
    if (loaded) visibleClients(data).forEach((c) => { const p = normPhone(c.phone); if (p) m.set(p, c); });
    return m;
  }, [data, loaded]);

  const poll = useCallback(async () => {
    try {
      const r = await api<{ sources: Source[] }>("/api/sources");
      setSources(r.sources);
      setDown(false);
      // Always refresh: after unlinking, the server has already cleared that number's chats and the list must empty too.
      const c = await api<{ chats: Chat[]; labels?: WaLabel[] }>("/api/chats");
      setChats(c.chats);
      setLabels(c.labels || []);
      setSel((s) => (s && !c.chats.some((x) => key(x) === s) ? null : s));
    } catch {
      setDown(true);
    }
  }, []);
  useEffect(() => {
    if (!allowed) return;
    const first = setTimeout(poll, 0);
    const t = setInterval(poll, 4000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [allowed, poll]);

  // While a manager previews an employee, the server still answers as the manager, so apply the employee's own rules here
  // (same as wa-server's canSee/canManage): no other people's private numbers, and no QR codes for numbers they can't manage.
  const sources = useMemo(() => {
    if (!rawSources || !previewAs) return rawSources;
    const who = { uid: data.uid, mgr: data.isMgr };
    return rawSources
      .filter((s) => who.mgr || s.ownerUid === who.uid)
      .map((s) => {
        const manage = who.mgr || (!!s.ownerUid && s.ownerUid === who.uid);
        return { ...s, canManage: manage, qr: manage ? s.qr : null };
      });
  }, [rawSources, previewAs, data.uid, data.isMgr]);

  // A number we have never chatted with gets a temporary entry so the first message can be sent from here.
  const allChats = extra && !chats.some((c) => key(c) === key(extra)) ? [extra, ...chats] : chats;
  const cur = allChats.find((c) => key(c) === sel) || null;
  useEffect(() => {
    if (!wantPhone || !sources || handled.current === wantPhone + "|" + draft) return;
    const open = sources.filter((s) => s.status === "open");
    const found = chats.find((c) => c.phone === wantPhone && open.some((s) => s.id === c.source)) || chats.find((c) => c.phone === wantPhone);
    if (!found && !open.length) {
      // No linked number at all: say so and open the customer's chat in the normal WhatsApp instead of waiting for chats that will never come.
      toast("لا يوجد رقم واتساب متصل في النظام — فُتحت المحادثة في واتساب جوالك");
      handled.current = wantPhone + "|" + draft;
      const ext = waLink(wantPhone, draft || undefined);
      if (ext) window.open(ext, "_blank", "noopener");
      return;
    }
    if (!found && !chats.length && open.some((s) => !s.sync?.done)) return; // wait for the first chat list
    handled.current = wantPhone + "|" + draft;
    if (found) setSel(key(found));
    else {
      const src = open.find((s) => seesAllOf(s, data.uid, data.isMgr)) || open[0];
      const x: Chat = { jid: wantPhone + "@s.whatsapp.net", source: src.id, name: null, phone: wantPhone, ts: Date.now(), unread: 0, tags: [], labels: [] };
      setExtra(x);
      setSel(key(x));
    }
    if (draft) setText(draft);
  }, [wantPhone, draft, sources, chats, data.uid, data.isMgr, toast]);
  useEffect(() => {
    if (!sel) return;
    const [source, jid] = sel.split("|");
    let live = true;
    const qs = "?source=" + encodeURIComponent(source) + "&jid=" + encodeURIComponent(jid);
    const load = () => api<{ messages: Msg[] }>("/api/messages" + qs).then((r) => live && setMsgs(r.messages)).catch(() => {});
    const first = setTimeout(load, 0);
    const t = setInterval(load, 2000);
    stick.current = true;
    api("/api/read", { source, jid }).catch(() => {});
    return () => { live = false; clearTimeout(first); clearInterval(t); setMsgs([]); };
  }, [sel]);
  // Braces matter: newer browsers return a Promise from scrollIntoView, which React rejects as an effect cleanup.
  useEffect(() => {
    if (stick.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, sel]);
  // An employee has exactly one number — their own phone: create it on first visit so its QR shows straight away.
  // (Kept above the early returns: hooks must run in the same order on every render.)
  const autoAdded = useRef(false);
  const ownPhone = (rawSources || []).some((s) => s.kind === "personal" && s.ownerUid === data.uid);
  useEffect(() => {
    if (!allowed || data.isMgr || previewAs || !rawSources || ownPhone || autoAdded.current) return;
    autoAdded.current = true;
    addSource("personal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, data.isMgr, previewAs, rawSources, ownPhone]);

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  if (!allowed) return <Empty>لا تملك صلاحية الاطلاع على واتساب الشركة.</Empty>;

  const srcById = new Map((sources || []).map((s) => [s.id, s]));
  const labelOf = (source: string, id: string) => labels.find((l) => l.source === source && l.id === id);
  const clientOf = (c: Chat) => (c.phone ? byPhone.get(c.phone) : undefined);
  // A WhatsApp "name" that is just the number again (e.g. +9665…) adds nothing; fall back to the local number.
  const label = (c: Chat) => clientOf(c)?.name || (c.name && !/^[+\d\s()\- ‎‏‪-‮]+$/.test(c.name) ? c.name : "") || (c.phone ? localPhone(c.phone) : "رقم مخفي");
  const mine = allChats.filter((c) => {
    const s = srcById.get(c.source);
    return !!s && (seesAllOf(s, data.uid, data.isMgr) || !!clientOf(c));
  });
  const allTags = [...new Set(mine.flatMap((c) => c.tags))];
  // Labels of the numbers in view, merged by name across numbers, with how many chats carry each.
  const labelList = [...new Map(labels.filter((l) => !srcF || l.source === srcF).map((l) => [l.name, l])).values()]
    .map((l) => ({ l, n: mine.filter((c) => (c.labels || []).some((id) => labelOf(c.source, id)?.name === l.name)).length }))
    .filter((x) => x.n > 0);
  const qq = q.trim();
  const list = mine.filter((c) => {
    const cl = clientOf(c);
    if (srcF && c.source !== srcF) return false;
    if (labelF && !(c.labels || []).some((id) => labelOf(c.source, id)?.name === labelF)) return false;
    if (tagF && !c.tags.includes(tagF)) return false;
    if (only === "unread" && !c.unread) return false;
    if (only === "clients" && !cl) return false;
    if (only === "new" && cl) return false;
    if (!labelF && c.old && !qq) return false; // old labelled chats show under their label or in a search
    return !qq || [cl?.name, c.name, c.phone, c.phone && localPhone(c.phone), c.last, ...c.tags].some((x) => x && x.includes(qq));
  });
  const curSrc = cur ? srcById.get(cur.source) : undefined;
  const curClient = cur ? clientOf(cur) : undefined;
  const curLabels = cur ? (cur.labels || []).map((id) => labelOf(cur.source, id)).filter((l): l is WaLabel => !!l) : [];
  const pending = (sources || []).filter((s) => s.canManage && s.status !== "open");
  const hasMine = (sources || []).some((s) => s.kind === "personal" && s.ownerUid === data.uid);

  async function addSource(kind: "company" | "personal") {
    try {
      await api("/api/sources", { kind, label: kind === "company" ? "رقم الشركة " + ((sources || []).filter((s) => s.kind === "company").length + 1) : "رقم " + nameOf(data, data.uid), visibility: "private" });
      toast("أُضيف الرقم — امسح الرمز للربط");
      poll();
    } catch {
      toast("تعذّرت الإضافة");
    }
  }
  const reload = async (c: Chat) =>
    setMsgs((await api<{ messages: Msg[] }>("/api/messages?source=" + encodeURIComponent(c.source) + "&jid=" + encodeURIComponent(c.jid))).messages);
  async function sendNow() {
    const t = text.trim();
    if (!t || !cur) return;
    const c = cur;
    // Show the message at once (with a clock) like WhatsApp, then replace it with the server's copy.
    const tmp: Msg = { id: "tmp-" + Date.now(), fromMe: true, text: t, ts: Date.now(), pending: true };
    setText("");
    stick.current = true;
    setMsgs((m) => [...m, tmp]);
    setSending(true);
    try {
      await api("/api/send", { source: c.source, jid: c.jid, text: t });
      await reload(c);
    } catch {
      setMsgs((m) => m.filter((x) => x.id !== tmp.id));
      setText(t);
      toast("تعذّر الإرسال — تأكد أن الرقم متصل");
    } finally {
      setSending(false);
    }
  }
  /** One item of a property sent from the inventory: a photo by link, or the details text. */
  async function sendItem(item: { url: string } | { text: string }) {
    if (!cur) return;
    stick.current = true;
    if ("url" in item) await api("/api/send-media", { source: cur.source, jid: cur.jid, url: item.url });
    else await api("/api/send", { source: cur.source, jid: cur.jid, text: item.text });
    await reload(cur);
  }
  /** Voice note (recorded here) or a picked file. */
  async function sendFile(dataUrl: string, fileName?: string, voice?: boolean) {
    if (!cur) return;
    const c = cur;
    stick.current = true;
    try {
      await api("/api/send-media", { source: c.source, jid: c.jid, dataUrl, fileName, voice: !!voice, caption: voice ? undefined : text.trim() || undefined });
      if (!voice && text.trim()) setText("");
      await reload(c);
    } catch (e) {
      toast(String((e as Error)?.message) === "413" ? "الملف أكبر من المسموح (16 ميجابايت)" : "تعذّر الإرسال — تأكد أن الرقم متصل");
    }
  }
  /** Ask Claude for a reply draft; it goes into the box for the employee to edit or send. */
  async function suggest() {
    if (!cur) return;
    setSuggesting(true);
    try {
      const r0 = curClient ? reqsOf(data, curClient)[0] : undefined;
      const props = (r0 ? matchesForReq(data, r0).map((x) => x.p) : data.props.filter((p) => (p.status || "متاح") === "متاح")).slice(0, 8);
      const res = await fetch("/api/wa-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await auth?.currentUser?.getIdToken()) },
        body: JSON.stringify({
          messages: msgs.slice(-30),
          client: curClient ? curClient.name + " — " + (wantLine(data, curClient) || "لم يُسجَّل طلبه") + (r0?.requirements ? " — " + r0.requirements : "") + (curClient.notes ? " — ملاحظات: " + curClient.notes.slice(0, 300) : "") : null,
          properties: props.map((p) => [p.title, p.district && "حي " + p.district, p.type, propPrice(p), p.link].filter(Boolean).join(" · ")),
          staffName: nameOf(data, data.uid),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.text) setText(j.text);
      else toast(j.error === "no_key" ? "اقتراح الردود يحتاج مفتاح Claude API على الخادم — يرجى التواصل مع المالك" : j.error === "rate_limited" ? "طلبات كثيرة، حاول بعد قليل" : "تعذّر اقتراح رد");
    } catch {
      toast("تعذّر اقتراح رد");
    } finally {
      setSuggesting(false);
    }
  }

  async function setTags(tags: string[]) {
    if (!cur) return;
    try {
      await api("/api/tags", { source: cur.source, jid: cur.jid, tags });
      setChats((cs) => cs.map((c) => (key(c) === key(cur) ? { ...c, tags } : c)));
    } catch {
      toast("تعذّر حفظ الوسوم");
    }
  }
  /** Like scrolling up in WhatsApp Web: ask the phone for 50 older messages; they arrive within seconds. */
  async function loadOlder() {
    if (!cur) return;
    const c = cur, before = msgs.length;
    setLoadingOlder(true);
    try {
      await api("/api/older", { source: c.source, jid: c.jid });
      let got = 0;
      for (let i = 0; i < 8 && !got; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const m = (await api<{ messages: Msg[] }>("/api/messages?source=" + encodeURIComponent(c.source) + "&jid=" + encodeURIComponent(c.jid))).messages;
        got = m.length - before;
        if (got > 0) setMsgs(m);
      }
      toast(got > 0 ? "تم تحميل " + got + " رسالة أقدم" : "لا توجد رسائل أقدم في الجوال لهذه المحادثة");
    } catch {
      toast("تعذّر الطلب — تأكد أن الرقم متصل وأن الجوال متصل بالإنترنت");
    } finally {
      setLoadingOlder(false);
    }
  }
  /** Add or remove a WhatsApp Business label; the change also shows on the phone. */
  async function toggleLabel(id: string, on: boolean) {
    if (!cur) return;
    try {
      const r = await api<{ labels: string[] }>("/api/label", { source: cur.source, jid: cur.jid, labelId: id, on });
      setChats((cs) => cs.map((c) => (key(c) === key(cur) ? { ...c, labels: r.labels } : c)));
    } catch {
      toast("تعذّر تعديل التصنيف — تأكد أن الرقم متصل");
    }
  }

  const header = (
    <PageHeader title="واتساب" sub="صندوق موحّد لمحادثات أرقام الشركة"
      action={sources && (
        <div className="flex flex-wrap gap-2 max-md:w-full max-md:[&>button]:!px-3 max-md:[&>button]:!py-1.5 max-md:[&>button]:!text-[13px]">
          {data.isMgr && <button type="button" className="crm-btn" onClick={() => addSource("company")}>+ ربط رقم للشركة</button>}
          {data.isMgr && <button type="button" className={"crm-btn" + (showImport ? " primary" : "")} onClick={() => setShowImport((v) => !v)}>استيراد العملاء</button>}
          <button type="button" className={"crm-btn" + (showSettings ? " primary" : "")} onClick={() => setShowSettings((v) => !v)}>إعدادات الأرقام</button>
        </div>
      )} />
  );

  if (down) return (
    <>
      <PageHeader title="واتساب" sub="صندوق موحّد لمحادثات أرقام الشركة" />
      <div className="crm-card grid max-w-xl gap-2 p-5">
        <b>خدمة واتساب غير متصلة حالياً</b>
        <p className="crm-hint m-0">الخادم متوقف أو يعيد التشغيل. حاول مجدداً بعد دقيقة، وإن استمر الانقطاع فالخادم على Railway يحتاج «Restart».</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="crm-btn primary" onClick={() => { setDown(false); poll(); }}>إعادة المحاولة</button>
          {wantPhone && waLink(wantPhone, draft || undefined) && <a className="crm-btn wa" href={waLink(wantPhone, draft || undefined)!} target="_blank" rel="noopener">فتح واتساب على جوالي</a>}
        </div>
      </div>
    </>
  );
  if (!sources) return <><PageHeader title="واتساب" /><Empty>جارٍ الاتصال بخدمة واتساب…</Empty></>;

  const pill = (on: boolean) =>
    "shrink-0 rounded-full px-3 py-1 text-[13.5px] transition-colors " + (on ? "font-semibold" : "hover:brightness-95");
  const pillStyle = (on: boolean) => (on ? { background: "#e7fce3", color: "#008069" } : { background: WA.panel, color: WA.ink2 });

  // messages grouped by day, as WhatsApp shows them
  const rows: ({ day: string } | Msg)[] = [];
  msgs.forEach((m, i) => {
    const d = dayLabel(m.ts);
    if (i === 0 || dayLabel(msgs[i - 1].ts) !== d) rows.push({ day: d });
    rows.push(m);
  });

  return (
    <>
      {header}

      {/* numbers waiting for a QR scan */}
      {pending.map((s) => (
        <div key={s.id} className="crm-card mb-3 grid items-center gap-5 p-5 md:grid-cols-[1fr_260px]">
          <div className="grid gap-2">
            <h2 className="text-base">ربط «{s.label}» <Pill tone={s.status === "loggedOut" ? "hot" : "warm"}>{WA_STATUS_AR[s.status] || s.status}</Pill></h2>
            <ol className="grid list-decimal gap-1 ps-5 text-[14px] text-[var(--crm-ink-2)]">
              <li>افتح واتساب على الجوال صاحب الرقم.</li>
              <li>الإعدادات ← <b>الأجهزة المرتبطة</b> ← <b>ربط جهاز</b>.</li>
              <li>امسح الرمز الظاهر.</li>
            </ol>
            <p className="crm-hint m-0">يبقى واتساب يعمل على الجوال كالمعتاد، وتظهر المحادثات هنا خلال دقائق.</p>
          </div>
          {s.qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.qr} alt={"رمز ربط " + s.label} className="h-[260px] w-[260px] rounded-xl border border-[var(--crm-line)] bg-white p-2" />
          ) : <div className="grid h-[260px] place-items-center rounded-xl border border-dashed border-[var(--crm-line)] text-sm text-[var(--crm-ink-3)]">جارٍ تجهيز الرمز…</div>}
        </div>
      ))}

      {showSettings && <SourcesSettings sources={sources} onChange={poll} />}
      {showImport && data.isMgr && <WaImport sources={sources} onClose={() => setShowImport(false)} />}
      {/* pull every conversation back to its first message */}
      {sources.filter((s) => s.canManage && s.status === "open").map((s) => {
        const b = s.backfill;
        const pct = b && b.total ? Math.round((b.done / b.total) * 100) : 0;
        const finished = b && !b.running && b.total > 0 && b.done >= b.total;
        return (
          <div key={"bf" + s.id} className="mb-3 flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm max-md:gap-2 max-md:text-[12.5px]" style={{ background: "#e7fce3", color: "#0b3d2e" }}>
            {b?.running ? (
              <>
                <span className="min-w-0 flex-1">
                  جارٍ سحب كل المحادثات من الجوال{sources.length > 1 ? " («" + s.label + "»)" : ""}: <b className="num">{b.done}</b> من <b className="num">{b.total}</b> محادثة · أُضيفت <b className="num">{b.added}</b> رسالة أقدم. أبقِ الجوال متصلاً بالإنترنت؛ يمكنك متابعة العمل.
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full" style={{ width: pct + "%", background: WA.green }} /></span>
                </span>
                <button type="button" className="crm-btn sm" onClick={() => api("/api/sources/" + s.id + "/backfill", { action: "stop" }).then(poll).catch(() => {})}>إيقاف</button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1">
                  {finished ? <>اكتمل سحب المحادثات: كل محادثة وصلت إلى أول رسالة فيها{b.added ? <> (أُضيفت <b className="num">{b.added}</b> رسالة في آخر تشغيل)</> : null}.</>
                    : <>يرسل واتساب عند الربط الرسائل الحديثة فقط. اسحب كل محادثة حتى أول رسالة فيها{b && b.done ? <> — تم <b className="num">{b.done}</b> من <b className="num">{b.total}</b></> : null}.</>}
                </span>
                {!finished && (
                  <button type="button" className="crm-btn sm primary" onClick={() => api("/api/sources/" + s.id + "/backfill", { action: "start" }).then(() => { toast("بدأ سحب المحادثات — يعمل في الخلفية"); poll(); }).catch(() => toast("تعذّر البدء"))}>
                    {b && b.done ? "متابعة السحب" : "سحب كل المحادثات"}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      {sources.some((s) => s.status === "open" && s.sync && !s.sync.done && s.sync.progress != null) && (
        <div className="mb-3 rounded-xl bg-[var(--crm-surface-2)] px-3.5 py-2 text-sm text-[var(--crm-ink-2)]">
          جارٍ مزامنة سجل المحادثات من الجوال: {sources.filter((s) => s.sync && !s.sync.done && s.sync.progress != null).map((s) => s.label + " " + s.sync!.progress + "%").join("، ")} — أبقِ الجوال متصلاً بالإنترنت.
        </div>
      )}

      {/* WhatsApp Web–style inbox */}
      <div className="grid h-[calc(100dvh-210px)] min-h-[440px] overflow-hidden rounded-xl border bg-white shadow-sm md:h-[calc(100dvh-170px)] md:min-h-[520px] md:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]"
        style={{ borderColor: WA.line, color: WA.ink }}>
        {/* chat list */}
        <div className={"flex min-h-0 min-w-0 flex-col md:border-e " + (sel ? "max-md:hidden" : "")} style={{ borderColor: WA.line }}>
          <div className="flex h-[59px] shrink-0 items-center gap-2 px-4" style={{ background: WA.panel }}>
            <b className="flex-1 text-[19px]">الدردشات</b>
            {sources.length > 1 ? (
              <select className="crm-quiet !text-[13px]" value={srcF} onChange={(e) => { setSrcF(e.target.value); setLabelF(""); }} aria-label="الرقم">
                <option value="">كل الأرقام</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.label} — {WA_STATUS_AR[s.status] || s.status}</option>)}
              </select>
            ) : sources[0] ? (
              <span className="flex items-center gap-1.5 text-[13px]" style={{ color: WA.ink2 }} title={WA_STATUS_AR[sources[0].status]}>
                <i className={"inline-block h-2 w-2 rounded-full " + dot(sources[0].status)} />{sources[0].label}
              </span>
            ) : <span className="text-[13px]" style={{ color: WA.ink2 }}>{data.isMgr ? "لا يوجد رقم مربوط" : "لم تربط جوالك بعد"}</span>}
          </div>
          <div className="grid shrink-0 gap-2 px-3 py-2">
            <div className="flex items-center gap-2 rounded-lg px-3" style={{ background: WA.panel }}>
              <span aria-hidden style={{ color: WA.ink2 }}>🔍</span>
              <input className="!m-0 h-[35px] w-full !border-0 !bg-transparent !p-0 !shadow-none !outline-none text-[14px]" placeholder="ابحث بالاسم أو الرقم أو نص الرسالة"
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
              {([["all", "الكل"], ["unread", "غير مقروءة"], ["clients", "عملاء النظام"], ["new", "غير مسجّلين"]] as const).map(([k, l]) => (
                <button key={k} type="button" className={pill(only === k && !labelF)} style={pillStyle(only === k && !labelF)} onClick={() => { setOnly(k); setLabelF(""); }}>{l}</button>
              ))}
            </div>
            {labelList.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                {labelList.map(({ l, n }) => (
                  <button key={l.name} type="button" className={pill(labelF === l.name) + " flex items-center gap-1.5"} style={pillStyle(labelF === l.name)}
                    onClick={() => { setLabelF(labelF === l.name ? "" : l.name); setOnly("all"); }}>
                    <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: labelColor(l) }} />{l.name}<span className="num text-[11.5px] opacity-70">{n}</span>
                  </button>
                ))}
              </div>
            )}
            {allTags.length > 0 && (
              <select className="crm-quiet justify-self-start !text-[12.5px]" value={tagF} onChange={(e) => setTagF(e.target.value)} aria-label="وسوم النظام">
                <option value="">وسوم النظام: الكل</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.length ? list.map((c) => {
              const cl = clientOf(c);
              const s = srcById.get(c.source);
              const name = label(c);
              const ls = (c.labels || []).map((id) => labelOf(c.source, id)).filter((l): l is WaLabel => !!l);
              const on = sel === key(c);
              return (
                <button key={key(c)} type="button" onClick={() => setSel(key(c))}
                  className="flex w-full items-center gap-3 ps-3 text-start" style={{ background: on ? WA.panel : undefined }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "#f5f6f6"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = ""; }}>
                  <Avatar name={name} />
                  <span className="grid min-w-0 flex-1 gap-0.5 border-b py-2.5 pe-3" style={{ borderColor: WA.line }}>
                    <span className="flex items-baseline gap-2">
                      <span className="flex min-w-0 flex-1 items-baseline gap-2">
                        <bdi className="truncate text-[16px]">{name}</bdi>
                        {c.phone && name !== localPhone(c.phone) && <span className="num shrink-0 text-[12px]" style={{ color: WA.ink2 }} dir="ltr">{localPhone(c.phone)}</span>}
                      </span>
                      <span className="num shrink-0 text-[12px]" style={{ color: c.unread ? WA.unread : WA.ink2 }}>{c.ts ? timeOf(c.ts) : ""}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: WA.ink2 }}>
                        {c.old ? "محادثة أقدم من السجل المسحوب" : <>{c.lastFromMe && <span style={{ color: "#53bdeb" }}>✓✓ </span>}{c.last}</>}
                      </span>
                      {c.unread > 0 && <span className="num grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[12px] font-bold text-white" style={{ background: WA.unread }}>{c.unread}</span>}
                    </span>
                    {(ls.length > 0 || cl || c.tags.length > 0 || (sources.length > 1 && s)) && (
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {ls.map((l) => (
                          <span key={l.id} className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px]" style={{ background: labelColor(l) + "33", color: WA.ink }}>
                            <i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: labelColor(l) }} />{l.name}
                          </span>
                        ))}
                        {cl && <span className="rounded-full px-2 py-px text-[11px]" style={{ background: "#e7fce3", color: "#008069" }}>عميل{data.isMgr ? " · " + nameOf(data, cl.assignee) : ""}</span>}
                        {c.tags.map((t) => <span key={t} className="crm-pill tone-gold !text-[11px]">{t}</span>)}
                        {sources.length > 1 && s && <span className="rounded-full px-2 py-px text-[11px]" style={{ background: WA.panel, color: WA.ink2 }}>{s.label}</span>}
                      </span>
                    )}
                  </span>
                </button>
              );
            }) : <Empty>{chats.length ? "لا توجد محادثات بهذا البحث." : sources.some((s) => s.status === "open") ? "جارٍ مزامنة المحادثات… قد يستغرق ذلك بضع دقائق بعد الربط." : data.isMgr || hasMine ? "اربط رقماً لتظهر المحادثات." : "جارٍ تجهيز رمز الربط لجوالك… امسحه من واتساب جوالك."}</Empty>}
          </div>
        </div>

        {/* conversation */}
        <div className={"flex min-h-0 min-w-0 flex-col " + (sel ? "max-md:fixed max-md:inset-0 max-md:z-[80] max-md:h-[100dvh] max-md:bg-white" : "max-md:hidden")}>
          {cur ? (
            <>
              <div className="grid shrink-0 gap-1.5 px-2 py-2 md:px-4" style={{ background: WA.panel, borderBottom: "1px solid " + WA.line }}>
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <button type="button" aria-label="رجوع" className="grid h-9 w-9 place-items-center rounded-full text-[22px] md:hidden" style={{ color: WA.ink2 }}
                    onClick={() => { setSel(null); setTools(false); }}>→</button>
                  <Avatar name={label(cur)} size={40} />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[16px] font-normal"><bdi>{label(cur)}</bdi></b>
                    <span className="block truncate text-[13px]" style={{ color: WA.ink2 }}>
                      {cur.phone && <span className="num" dir="ltr">{localPhone(cur.phone)}</span>}
                      {curSrc && <> · عبر {curSrc.label}</>}
                    </span>
                  </div>
                  <button type="button" aria-label="المزيد" className="grid h-9 w-9 place-items-center rounded-full text-[20px] md:hidden" style={{ color: WA.ink2, background: tools ? "#e9edef" : undefined }}
                    onClick={() => setTools((v) => !v)}>⋮</button>
                  <div className={"flex flex-wrap gap-2 " + (tools ? "max-md:w-full" : "max-md:hidden")}>
                  {curClient ? (
                    <>
                      <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "update", clientId: curClient.id })}>تسجيل الإجراء التالي</button>
                      <button type="button" className="crm-btn sm" onClick={() => openClient(curClient.id)}>ملف العميل{data.isMgr ? " · " + nameOf(data, curClient.assignee) : ""}</button>
                    </>
                  ) : (
                    <>
                    <button type="button" className="crm-btn sm" disabled={!cur.phone}
                      title="يُسجَّل الرقم في «الأرقام» ليتصل به الموظف، بدون طلب"
                      onClick={async () => {
                        if (!cur.phone) return;
                        const ph = localPhone(cur.phone);
                        try {
                          await createClient({
                            name: cur.name || ph, phone: ph, source: data.sources.includes("واتساب") ? "واتساب" : null,
                            status: TO_CONTACT, assignee: null, assignedAt: null, assignedBy: null, unseen: false, temp: null,
                            nextCall: null, visitAt: null, visitProperty: null, visitConfirmed: false,
                            notes: cur.last ? "آخر رسالة على واتساب: " + String(cur.last).slice(0, 500) : null,
                            log: [], createdAt: nowStamp(), updatedAt: nowStamp(),
                          });
                          toast("تم تسجيل الرقم في «الأرقام»");
                        } catch (e) { toast(isPhoneTaken(e) ? PHONE_TAKEN : "تعذّر تسجيل الرقم"); }
                      }}>
                      📥 تسجيل رقم
                    </button>
                    <button type="button" className="crm-btn sm primary"
                      onClick={() => openModal({ kind: "request", preset: {
                        source: data.sources.includes("واتساب") ? "واتساب" : null, _newName: cur.name || "", _newPhone: localPhone(cur.phone),
                        ...(curSrc?.defaultAssignee || curSrc?.ownerUid ? { assignee: curSrc.defaultAssignee || curSrc.ownerUid } : {}),
                      } })}>
                      إضافة كعميل وطلب
                    </button>
                    </>
                  )}
                  </div>
                </div>
                <div className={"flex flex-wrap items-center gap-1.5 " + (tools ? "" : "max-md:hidden")}>
                  {curLabels.map((l) => (
                    <span key={l.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[12px]">
                      <i className="inline-block h-2 w-2 rounded-full" style={{ background: labelColor(l) }} />{l.name}
                      <button type="button" aria-label={"إزالة التصنيف " + l.name} className="opacity-60 hover:opacity-100" onClick={() => toggleLabel(l.id, false)}>×</button>
                    </span>
                  ))}
                  {labels.some((l) => l.source === cur.source && !(cur.labels || []).includes(l.id)) && (
                    <select className="crm-quiet !text-[12.5px]" value="" aria-label="إضافة تصنيف" onChange={(e) => e.target.value && toggleLabel(e.target.value, true)}>
                      <option value="">+ تصنيف</option>
                      {labels.filter((l) => l.source === cur.source && !(cur.labels || []).includes(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  )}
                  {cur.tags.map((t) => (
                    <span key={t} className="crm-pill tone-gold inline-flex items-center gap-1">
                      {t}<button type="button" aria-label={"إزالة " + t} onClick={() => setTags(cur.tags.filter((x) => x !== t))}>×</button>
                    </span>
                  ))}
                  <input className="crm-input !w-32 !py-0.5 !text-[12.5px]" placeholder="+ وسم النظام" value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && tagInput.trim()) { setTags([...cur.tags, tagInput.trim()]); setTagInput(""); } }} />
                </div>
              </div>
              <div ref={scrollBox} className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3 md:px-[6%]"
                onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}
                style={{ background: WA.wall, backgroundImage: "radial-gradient(rgba(0,0,0,.035) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
                <div className="grid gap-1">
                  {msgs.length > 0 && curSrc?.status === "open" && (
                    <button type="button" disabled={loadingOlder} onClick={loadOlder}
                      className="mb-1 justify-self-center rounded-full bg-white px-3.5 py-1 text-[12.5px] shadow-sm hover:brightness-95 disabled:opacity-60" style={{ color: "#008069" }}>
                      {loadingOlder ? "جارٍ طلب الرسائل من الجوال…" : "↑ تحميل رسائل أقدم من الجوال"}
                    </button>
                  )}
                  {rows.map((r) => "day" in r ? (
                    <span key={"d" + r.day} className="my-2 justify-self-center rounded-lg bg-white px-3 py-1 text-[12.5px] shadow-sm" style={{ color: WA.ink2 }}>{r.day}</span>
                  ) : (
                    <div key={r.id} className={"min-w-0 max-w-[86%] rounded-lg px-2.5 pb-1 pt-1.5 text-[14.2px] leading-[1.45] whitespace-pre-wrap [overflow-wrap:anywhere] shadow-[0_1px_.5px_rgba(11,20,26,.13)] md:max-w-[70%] " +
                      (r.fromMe ? "justify-self-end rounded-se-none" : "justify-self-start rounded-ss-none bg-white")}
                      style={r.fromMe ? { background: WA.out } : undefined}>
                      {r.media && <MediaBody m={r} source={cur.source} />}
                      {captionOf(r) && <span className={r.media ? "mt-1 block" : undefined}>{captionOf(r)}</span>}
                      <span className="num float-end ms-3 mt-1.5 text-[11px] leading-none" style={{ color: WA.ink2 }}>
                        {clock(r.ts)}{r.fromMe && (r.pending ? <span title="جارٍ الإرسال"> 🕓</span> : <span style={{ color: "#53bdeb" }}> ✓✓</span>)}
                      </span>
                    </div>
                  ))}
                  {!msgs.length && (
                    <span className="my-6 justify-self-center rounded-lg bg-[#fff5c4] px-4 py-2 text-center text-[13px] shadow-sm" style={{ color: "#54656f" }}>
                      {cur.old ? "هذه المحادثة أقدم من السجل الذي يرسله واتساب للأجهزة المرتبطة، فلا تظهر رسائلها هنا. يمكنك مراسلة العميل أو إضافته للنظام." : "لا توجد رسائل محفوظة لهذه المحادثة بعد."}
                    </span>
                  )}
                  <div ref={endRef} />
                </div>
              </div>
              <div className="flex shrink-0 items-end gap-1 px-1.5 py-2 pb-[max(.5rem,env(safe-area-inset-bottom))] md:gap-2 md:px-3" style={{ background: WA.panel }}>
                {!recording && <AttachButton disabled={curSrc?.status !== "open"} onSend={(d, name) => sendFile(d, name)} />}
                {!recording && (
                  <button type="button" disabled={curSrc?.status !== "open"} onClick={() => setShowProp(true)} title="إرسال عقار من المخزون" aria-label="إرسال عقار من المخزون"
                    className="grid h-[42px] w-[38px] shrink-0 place-items-center text-[20px] disabled:opacity-40">🏠</button>
                )}
                {showProp && <WaSendProperty client={curClient || null} onClose={() => setShowProp(false)} send={sendItem} />}
                {!recording && (
                  <textarea rows={1} className="max-h-32 min-h-[42px] flex-1 resize-none !rounded-lg !border-0 !bg-white px-3 py-2.5 text-[15px]" placeholder="اكتب رسالة"
                    value={text} onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendNow(); } }} />
                )}
                {SUGGEST_ON && !recording && (
                  <button type="button" className="crm-btn h-[42px] shrink-0 max-md:!px-2.5" disabled={suggesting || !msgs.length} onClick={suggest} title="يقرأ المحادثة ويكتب رداً تراجعه قبل الإرسال">
                    {suggesting ? "…" : <>✨<span className="max-md:hidden"> اقترح رد</span></>}
                  </button>
                )}
                {text.trim() && !recording ? (
                  <button type="button" aria-label="إرسال" title={curSrc?.status !== "open" ? "الرقم غير متصل" : "إرسال (Enter)"}
                    className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
                    style={{ background: WA.green }} disabled={sending || curSrc?.status !== "open"} onClick={sendNow}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className="-scale-x-100" aria-hidden><path d="M1.1 21.8 23 12 1.1 2.2 1 9.8l15.7 2.2L1 14.2z" /></svg>
                  </button>
                ) : (
                  <VoiceRecorder disabled={curSrc?.status !== "open"} onRecording={setRecording} onSend={(d) => sendFile(d, undefined, true)} />
                )}
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center" style={{ background: WA.panel, borderBottom: "6px solid " + WA.unread }}>
              <div className="grid max-w-md justify-items-center gap-3">
                <svg viewBox="0 0 24 24" width="72" height="72" fill={WA.green} aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" /></svg>
                <b className="text-[26px] font-light" style={{ color: "#41525d" }}>واتساب بن سلمه</b>
                <p className="m-0 text-[14px]" style={{ color: WA.ink2 }}>اختر محادثة من القائمة لعرض رسائلها والرد عليها. التصنيفات التي تضيفها هنا تظهر في جوالك أيضاً.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Per-number settings: name, default employee (managers), who may see it, unlink, remove. */
function SourcesSettings({ sources, onChange }: { sources: Source[]; onChange: () => void }) {
  const { data, toast } = useCrm();
  const editable = sources.filter((s) => s.canManage);
  async function update(s: Source, body: object) {
    try {
      await api("/api/sources/" + s.id + "/update", body);
      toast("تم حفظ إعدادات «" + s.label + "»");
      onChange();
    } catch {
      toast("تعذّر الحفظ");
    }
  }
  return (
    <div className="crm-card mb-3 grid gap-3 p-4">
      <h2 className="text-[15.5px]">إعدادات الأرقام</h2>
      {!editable.length && <p className="crm-hint m-0">لا توجد أرقام يمكنك تعديلها.</p>}
      {editable.map((s) => (
        <div key={s.id} className="grid items-end gap-3 rounded-xl border border-[var(--crm-line)] p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="crm-field">
            <label>اسم الرقم <span className="muted text-xs">({s.kind === "company" ? "رقم شركة" : "رقم موظف"}{s.me ? " · " + localPhone(s.me.id.split("@")[0]) : ""} · <span className="num">{s.chats}</span> محادثة{s.sync?.done ? " · المزامنة مكتملة" : ""})</span></label>
            <input defaultValue={s.label} onBlur={(e) => e.target.value.trim() && e.target.value !== s.label && update(s, { label: e.target.value.trim() })} />
          </div>
          <div className="crm-field">
            <label>الموظف الافتراضي للمحادثات الجديدة</label>
            <select value={s.defaultAssignee || ""} disabled={!data.isMgr} onChange={(e) => update(s, { defaultAssignee: e.target.value || null })}>
              <option value="">— بدون —</option>
              {members(data).map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
            </select>
          </div>
          <div className="crm-field">
            <label>من يرى محادثاته</label>
            <select value={s.visibility} onChange={(e) => update(s, { visibility: e.target.value })}>
              <option value="team">الفريق (كل موظف يرى عملاءه)</option>
              <option value="private">صاحب الرقم والموظف الافتراضي والمدير</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.status === "open" && s.hidden > 0 && (
              <button type="button" className="crm-btn sm" onClick={async () => {
                const r = await api<{ resolved: number }>("/api/sources/" + s.id + "/resolve", {}).catch(() => ({ resolved: 0 }));
                toast("استُخرج " + r.resolved + " رقم من " + s.hidden);
                onChange();
              }}>استخراج الأرقام المخفية ({s.hidden})</button>
            )}
            {s.status === "open" && (
              <ConfirmButton onConfirm={async () => { await api("/api/sources/" + s.id + "/logout", {}).catch(() => {}); toast("تم فصل الربط — يظهر رمز جديد"); onChange(); }}>فصل الربط</ConfirmButton>
            )}
            <ConfirmButton onConfirm={async () => { await api("/api/sources/" + s.id + "/remove", {}).catch(() => {}); toast("تم حذف الرقم"); onChange(); }}>حذف الرقم</ConfirmButton>
          </div>
        </div>
      ))}
      <p className="crm-hint m-0">الموظف الافتراضي: يرى كل محادثات الرقم، ويُسند إليه العميل عند «إضافة كعميل وطلب». حذف الرقم يمسح محادثاته المحفوظة في النظام ولا يمسها في الجوال.</p>
    </div>
  );
}
