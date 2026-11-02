"use client";

/**
 * Team chat alerts and presence (client 2026-11-02): a new channel or private message from a colleague rings the chime and
 * shows a toast (plus a system notification when the tab is in the background and the browser allows it); nothing rings
 * while that very conversation is open. The same component keeps `staff/{uid}.lastSeen` fresh while the person is
 * active, which is what the chat shows as online/offline (lib/crm/presence.ts). Not active in the manager's preview.
 */
import { useEffect, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePathname } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { nameOf } from "@/lib/crm/logic";
import { nowStamp } from "@/lib/crm/util";
import { BEAT_MS } from "@/lib/crm/presence";
import { chime } from "./TaskAlerts";

export function ChatAlerts() {
  const { data, chat, dms, loaded, previewAs, toast } = useCrm();
  const pathname = usePathname();
  const known = useRef<Set<string> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const onChat = useRef(false);
  onChat.current = pathname === "/admin/chat";
  const me = data.uid;

  // Presence: write lastSeen about once a minute, only after some activity since the last write.
  useEffect(() => {
    if (!loaded || previewAs || !me || !db) return;
    let active = true;
    const mark = () => { active = true; };
    const evs = ["mousemove", "pointerdown", "keydown", "scroll", "touchstart", "wheel"];
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const beat = () => {
      if (!active || document.hidden) return;
      active = false;
      updateDoc(doc(db!, "staff", me), { lastSeen: nowStamp() }).catch(() => {});
    };
    beat();
    const iv = setInterval(beat, BEAT_MS);
    const vis = () => { if (!document.hidden) { active = true; beat(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { evs.forEach((e) => window.removeEventListener(e, mark)); clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
  }, [loaded, previewAs, me]);

  // New messages from colleagues.
  useEffect(() => {
    if (!loaded || previewAs || !me) return;
    const all = [
      ...chat.map((m) => ({ id: "c" + m.id, by: m.by, text: m.text, dm: false })),
      ...dms.filter((m) => m.to === me).map((m) => ({ id: "d" + m.id, by: m.by, text: m.text, dm: true })),
    ];
    if (known.current === null) { known.current = new Set(all.map((m) => m.id)); return; }
    const fresh = all.filter((m) => !known.current!.has(m.id) && m.by !== me);
    all.forEach((m) => known.current!.add(m.id));
    if (!fresh.length) return;
    if (onChat.current && !document.hidden) return; // the conversation list is on screen
    const m = fresh[fresh.length - 1];
    const who = nameOf(dataRef.current, m.by);
    chime();
    toast("💬 " + who + (m.dm ? "" : " (قناة الفريق)") + ": " + (m.text.length > 60 ? m.text.slice(0, 60) + "…" : m.text) + (fresh.length > 1 ? " (+" + (fresh.length - 1) + ")" : ""));
    try {
      if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(who, { body: m.text.slice(0, 120) });
    } catch { /* not allowed */ }
  }, [loaded, previewAs, me, chat, dms, toast]);

  // Ask once for permission to show system notifications (needs a click first in some browsers).
  useEffect(() => {
    const ask = () => { try { if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission(); } catch { /* ignore */ } };
    window.addEventListener("pointerdown", ask, { once: true });
    return () => window.removeEventListener("pointerdown", ask);
  }, []);

  return null;
}
