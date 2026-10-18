"use client";

/**
 * WhatsApp media inside the CRM inbox, like WhatsApp Web: voice notes with a
 * player (play/pause, seek, speed), images (open full size), videos, files and
 * stickers — fetched from wa-server's /api/media with the user's token — plus
 * the composer's voice recorder and file picker.
 */
import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { WA_SERVER, type WaMsg } from "@/lib/crm/wa";

const cache = new Map<string, Promise<string>>(); // "source|id" -> object URL

/** Object URL of a message's file, fetched once per page load. */
function mediaUrl(source: string, id: string): Promise<string> {
  const k = source + "|" + id;
  let p = cache.get(k);
  if (!p) {
    p = (async () => {
      const token = await auth?.currentUser?.getIdToken();
      const r = await fetch(WA_SERVER + "/api/media?source=" + encodeURIComponent(source) + "&id=" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token } });
      if (!r.ok) throw new Error(String(r.status));
      return URL.createObjectURL(await r.blob());
    })();
    p.catch(() => cache.delete(k)); // allow a retry later (e.g. the number was offline)
    cache.set(k, p);
  }
  return p;
}

function useMedia(source: string, id: string, auto: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const load = () => {
    setState("loading");
    mediaUrl(source, id).then((u) => { setUrl(u); setState("idle"); }, () => setState("error"));
  };
  useEffect(() => {
    if (auto) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, id, auto]);
  return { url, state, load };
}

const mmss = (s: number) => { const t = Math.max(0, Math.round(s)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
const GREEN = "#00a884";

/** WhatsApp-style voice note player. */
export function VoiceNote({ source, id, secs, fromMe }: { source: string; id: string; secs: number; fromMe: boolean }) {
  const { url, state, load } = useMedia(source, id, false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(secs || 0);
  const [rate, setRate] = useState(1);
  const want = useRef(false);

  useEffect(() => {
    if (url && want.current && audio.current) { want.current = false; audio.current.play().catch(() => {}); }
  }, [url]);

  const toggle = () => {
    const a = audio.current;
    if (!url) { want.current = true; load(); return; }
    if (!a) return;
    if (a.paused) {
      document.querySelectorAll("audio").forEach((x) => x !== a && x.pause()); // one voice note at a time
      a.play().catch(() => {});
    } else a.pause();
  };
  const speed = () => {
    const r = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(r);
    if (audio.current) audio.current.playbackRate = r;
  };

  return (
    <div className="flex min-w-[230px] items-center gap-2.5 py-1" dir="ltr">
      <button type="button" onClick={toggle} aria-label={playing ? "إيقاف" : "تشغيل"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: fromMe ? "#5fb9a5" : GREEN }}>
        {state === "loading" && !url ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : playing ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <div className="grid flex-1 gap-1">
        <input type="range" min={0} max={dur || 1} step={0.1} value={pos} aria-label="موضع التشغيل"
          onChange={(e) => { const v = +e.target.value; setPos(v); if (audio.current) audio.current.currentTime = v; }}
          className="h-1 w-full cursor-pointer" style={{ accentColor: GREEN }} />
        <div className="flex items-center justify-between text-[11px]" style={{ color: "#667781" }}>
          <span className="num">{state === "error" ? "تعذّر التحميل — اضغط للمحاولة" : mmss(playing || pos ? pos : dur)}</span>
          {url && <button type="button" onClick={speed} className="num rounded-full bg-black/5 px-1.5 font-bold">{rate}×</button>}
        </div>
      </div>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "#dfe5e7", color: "#fff" }} aria-hidden>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" /></svg>
      </span>
      {url && (
        <audio ref={audio} src={url} preload="metadata"
          onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (isFinite(d) && d > 0) setDur(d); e.currentTarget.playbackRate = rate; }}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setPos(0); }} />
      )}
    </div>
  );
}

function ImageMsg({ source, id, sticker }: { source: string; id: string; sticker?: boolean }) {
  const { url, state, load } = useMedia(source, id, true);
  if (!url) {
    return (
      <button type="button" onClick={load} className={"grid place-items-center rounded-md bg-black/5 text-[12.5px] " + (sticker ? "h-28 w-28" : "h-48 w-64")} style={{ color: "#667781" }}>
        {state === "error" ? "تعذّر تحميل الصورة — اضغط للمحاولة" : "جارٍ تحميل الصورة…"}
      </button>
    );
  }
  if (sticker) return <img src={url} alt="ملصق" className="h-32 w-32 object-contain" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt="صورة" className="max-h-80 w-auto max-w-[min(320px,100%)] rounded-md object-cover" />
    </a>
  );
}

function VideoMsg({ source, id }: { source: string; id: string }) {
  const { url, state, load } = useMedia(source, id, false);
  if (url) return <video src={url} controls autoPlay className="max-h-80 max-w-[min(320px,100%)] rounded-md" />;
  return (
    <button type="button" onClick={load} className="grid h-44 w-64 place-items-center rounded-md bg-black/70 text-white">
      {state === "loading" ? (
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : (
        <span className="grid justify-items-center gap-1 text-[12.5px]">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          {state === "error" ? "تعذّر التحميل — اضغط للمحاولة" : "تشغيل الفيديو"}
        </span>
      )}
    </button>
  );
}

function DocMsg({ source, id, name, size }: { source: string; id: string; name: string; size?: number }) {
  const { url, state, load } = useMedia(source, id, false);
  useEffect(() => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }, [url, name]);
  return (
    <button type="button" onClick={() => (url ? window.open(url, "_blank") : load())}
      className="flex min-w-[230px] items-center gap-2.5 rounded-md bg-black/5 px-2.5 py-2 text-start">
      <span className="grid h-10 w-8 shrink-0 place-items-center rounded bg-[#f15c6d] text-[10px] font-bold text-white">{(name.split(".").pop() || "ملف").slice(0, 4).toUpperCase()}</span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-[13.5px]">{name}</span>
        <span className="text-[11px]" style={{ color: "#667781" }}>
          {state === "loading" ? "جارٍ التحميل…" : state === "error" ? "تعذّر التحميل — اضغط للمحاولة" : size ? (size / 1024 / 1024).toFixed(1) + " م.ب · اضغط للتنزيل" : "اضغط للتنزيل"}
        </span>
      </span>
    </button>
  );
}

/** The media part of a message bubble (null for plain text). */
export function MediaBody({ m, source }: { m: WaMsg; source: string }) {
  const x = m.media;
  if (!x) return null;
  if (x.kind === "audio") return <VoiceNote source={source} id={m.id} secs={x.secs || 0} fromMe={m.fromMe} />;
  if (x.kind === "image") return <ImageMsg source={source} id={m.id} />;
  if (x.kind === "sticker") return <ImageMsg source={source} id={m.id} sticker />;
  if (x.kind === "video") return <VideoMsg source={source} id={m.id} />;
  return <DocMsg source={source} id={m.id} name={x.name || "ملف"} size={x.size} />;
}

/** Caption under a media message (the server stores "[صورة] caption" as text). */
export const captionOf = (m: WaMsg) => (m.media ? m.media.caption || null : m.text);

const toDataUrl = (b: Blob) => new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = fail; r.readAsDataURL(b); });

/**
 * The microphone button: tap to record, then send or delete — like WhatsApp Web.
 * Sends through /api/send-media with voice: true (the server turns it into a voice note).
 */
export function VoiceRecorder({ disabled, onSend, onRecording }: { disabled?: boolean; onSend: (dataUrl: string) => Promise<void>; onRecording?: (on: boolean) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const keep = useRef(false);

  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => { onRecording?.(!!rec || busy); }, [rec, busy, onRecording]);
  useEffect(() => () => { stopTimer(); rec?.stream.getTracks().forEach((t) => t.stop()); }, [rec]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        setRec(null);
        if (!keep.current) return;
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        setBusy(true);
        try { await onSend(await toDataUrl(blob)); } finally { setBusy(false); setSecs(0); }
      };
      r.start(250);
      setSecs(0);
      timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
      setRec(r);
    } catch {
      alert("لم يُسمح باستخدام الميكروفون. اسمح للمتصفح باستخدامه ثم حاول مرة أخرى.");
    }
  }
  const finish = (send: boolean) => { keep.current = send; rec?.stop(); };

  if (busy) {
    return <span className="flex h-[42px] items-center gap-2 px-2 text-[13px]" style={{ color: "#667781" }}><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent" />جارٍ إرسال التسجيل…</span>;
  }
  if (rec) {
    return (
      <div className="flex h-[42px] flex-1 items-center gap-3 rounded-lg bg-white px-3">
        <button type="button" onClick={() => finish(false)} aria-label="حذف التسجيل" className="text-[#8696a0] hover:text-[#ea0038]">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z" /></svg>
        </button>
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ea0038]" />
        <span className="num flex-1 text-[15px]">{mmss(secs)}</span>
        <button type="button" onClick={() => finish(true)} aria-label="إرسال التسجيل"
          className="grid h-9 w-9 place-items-center rounded-full text-white" style={{ background: GREEN }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="-scale-x-100" aria-hidden><path d="M1.1 21.8 23 12 1.1 2.2 1 9.8l15.7 2.2L1 14.2z" /></svg>
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={start} disabled={disabled} aria-label="تسجيل رسالة صوتية" title="تسجيل رسالة صوتية"
      className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-white disabled:opacity-40" style={{ background: GREEN }}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" /></svg>
    </button>
  );
}

/** Paperclip: pick an image, video or file (up to 16 MB) and send it. */
export function AttachButton({ disabled, onSend }: { disabled?: boolean; onSend: (dataUrl: string, fileName: string) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()} aria-label="إرفاق" title="إرفاق صورة أو ملف"
        className="grid h-[42px] w-[38px] shrink-0 place-items-center text-[#54656f] disabled:opacity-40">
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent" /> : (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden><path d="M16.5 6.5v10.6a4.5 4.5 0 0 1-9 0V5.6a3 3 0 0 1 6 0v10.3a1.5 1.5 0 0 1-3 0V6.5H9v9.4a3 3 0 0 0 6 0V5.6a4.5 4.5 0 0 0-9 0v11.5a6 6 0 0 0 12 0V6.5h-1.5Z" /></svg>
        )}
      </button>
      <input ref={input} type="file" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        if (f.size > 16 * 1024 * 1024) { alert("الحد الأقصى للملف 16 ميجابايت."); return; }
        setBusy(true);
        try { await onSend(await toDataUrl(f), f.name); } finally { setBusy(false); }
      }} />
    </>
  );
}
