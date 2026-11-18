"use client";

/**
 * «⏰ تأجيل» (client 2026-11-15: postpone the follow-up from every home section): tomorrow, 3 days, a week, or a
 * date from the calendar. `onPick` gets the chosen day (YYYY-MM-DD) and saves it where that row keeps its date
 * (the client's next call, an interest's check-back, a task's due day).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCrm } from "@/lib/crm/store";
import { addDays, relDay, today } from "@/lib/crm/util";

/** `onPick(null)` = «بدون موعد» (client 2026-11-15): no follow-up date at all. */
export function PostponeButton({ onPick, title = "تأجيل موعد المتابعة" }: { onPick: (day: string | null) => Promise<unknown>; title?: string }) {
  const { toast } = useCrm();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // The menu is drawn on <body> at a fixed spot next to the button (client 2026-11-18: it was cut off inside cards
  // that hide overflow); it opens upwards when there is no room below. It does not close on scroll/resize: a phone's date picker fires those.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = box.current?.getBoundingClientRect();
    if (r) {
      const W = 200, H = 250;
      const top = window.innerHeight - r.bottom >= H + 8 ? r.bottom + 6 : Math.max(8, r.top - H - 6);
      const left = Math.min(Math.max(8, r.right - W), window.innerWidth - W - 8);
      setPos({ top, left });
    }
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const pick = async (day: string | null) => {
    if (day === "" || busy) return;
    setBusy(true);
    try { await onPick(day); toast(day ? "تأجّل إلى " + relDay(day) + " (" + day + ")" : "صار بدون موعد"); setOpen(false); }
    catch { toast("تعذّر التأجيل"); }
    finally { setBusy(false); }
  };
  return (
    <div ref={box} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="crm-btn sm" title={title} disabled={busy} onClick={toggle}>⏰ تأجيل</button>
      {open && pos && createPortal(
        <div ref={menu} dir="rtl" onClick={(e) => e.stopPropagation()} style={{ top: pos.top, left: pos.left, background: "#fff" }}
          className="crm fixed z-[1000] grid w-[200px] gap-1 rounded-xl border border-[var(--crm-line)] bg-white p-2 shadow-lg">
          {([[1, "غداً"], [3, "بعد 3 أيام"], [7, "بعد أسبوع"]] as [number, string][]).map(([n, l]) => (
            <button key={n} type="button" className="crm-btn sm justify-start" disabled={busy} onClick={() => pick(addDays(n))}>{l}</button>
          ))}
          <label className="grid gap-1 text-[12.5px] text-[var(--crm-ink-3)]">
            تاريخ محدد
            <input type="date" min={today()} onChange={(e) => pick(e.target.value)} />
          </label>
          <button type="button" className="crm-btn sm justify-start" disabled={busy} onClick={() => pick(null)}>بدون موعد</button>
        </div>,
        document.body,
      )}
    </div>
  );
}
