"use client";

/**
 * Task reminders with a chime (client 2026-10-26): a task assigned to me by someone else rings as soon as it arrives, and
 * tasks due today or overdue ring when the CRM opens and then every 30 minutes while it stays open. Sound is a short
 * two-note tone made in the browser (no file); browsers only allow it after the first click/tap on the page, so it is
 * unlocked then. Works only while the CRM is open in a tab. Not shown while a manager previews an employee's account.
 */
import { useEffect, useRef } from "react";
import { useCrm } from "@/lib/crm/store";
import { today } from "@/lib/crm/util";

let ctx: AudioContext | null = null;
function unlock() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* no sound available */ }
}
function chime() {
  try {
    if (!ctx || ctx.state !== "running") return;
    const t0 = ctx.currentTime;
    [[880, 0], [1175, 0.22]].forEach(([f, d]) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.6);
      o.connect(g); g.connect(ctx!.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.65);
    });
  } catch { /* ignore */ }
}

const EVERY = 30 * 60 * 1000;

export function TaskAlerts() {
  const { data, loaded, previewAs, toast } = useCrm();
  const known = useRef<Set<string> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    const on = () => unlock();
    window.addEventListener("pointerdown", on);
    window.addEventListener("keydown", on);
    return () => { window.removeEventListener("pointerdown", on); window.removeEventListener("keydown", on); };
  }, []);

  // New task from someone else.
  useEffect(() => {
    if (!loaded || previewAs || !data.uid) return;
    const mine = data.tasks.filter((t) => !t.done && t.assignee === data.uid);
    if (known.current === null) { known.current = new Set(mine.map((t) => t.id)); return; }
    const fresh = mine.filter((t) => !known.current!.has(t.id) && t.createdBy !== data.uid);
    mine.forEach((t) => known.current!.add(t.id));
    if (fresh.length) {
      chime();
      toast("🔔 مهمة جديدة: " + fresh[0].title + (fresh.length > 1 ? " (+" + (fresh.length - 1) + ")" : ""));
    }
  }, [loaded, previewAs, data.tasks, data.uid, toast]);

  // Due today / overdue: on open, then every 30 minutes.
  useEffect(() => {
    if (!loaded || previewAs) return;
    const remind = () => {
      const d = dataRef.current, t0 = today();
      const due = d.tasks.filter((t) => !t.done && t.assignee === d.uid && t.due && t.due <= t0);
      if (!due.length) return;
      chime();
      const late = due.filter((t) => t.due! < t0).length;
      toast("🔔 لديك " + due.length + (due.length === 1 ? " مهمة" : " مهام") + " اليوم" + (late ? " (منها " + late + " متأخرة)" : "") + " — من «المهام»");
    };
    const first = setTimeout(remind, 4000);
    const iv = setInterval(remind, EVERY);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [loaded, previewAs, toast]);

  return null;
}
