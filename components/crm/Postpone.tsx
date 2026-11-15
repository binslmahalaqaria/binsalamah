"use client";

/**
 * «⏰ تأجيل» (client 2026-11-15: postpone the follow-up from every home section): tomorrow, 3 days, a week, or a
 * date from the calendar. `onPick` gets the chosen day (YYYY-MM-DD) and saves it where that row keeps its date
 * (the client's next call, an interest's check-back, a task's due day).
 */
import { useEffect, useRef, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { addDays, relDay, today } from "@/lib/crm/util";

export function PostponeButton({ onPick, title = "تأجيل موعد المتابعة" }: { onPick: (day: string) => Promise<unknown>; title?: string }) {
  const { toast } = useCrm();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const pick = async (day: string) => {
    if (!day || busy) return;
    setBusy(true);
    try { await onPick(day); toast("تأجّل إلى " + relDay(day) + " (" + day + ")"); setOpen(false); }
    catch { toast("تعذّر التأجيل"); }
    finally { setBusy(false); }
  };
  return (
    <div ref={box} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="crm-btn sm" title={title} disabled={busy} onClick={() => setOpen((o) => !o)}>⏰ تأجيل</button>
      {open && (
        <div className="absolute end-0 top-[110%] z-30 grid w-[190px] gap-1 rounded-xl border border-[var(--crm-line)] bg-white p-2 shadow-lg">
          {([[1, "غداً"], [3, "بعد 3 أيام"], [7, "بعد أسبوع"]] as [number, string][]).map(([n, l]) => (
            <button key={n} type="button" className="crm-btn sm justify-start" disabled={busy} onClick={() => pick(addDays(n))}>{l}</button>
          ))}
          <label className="grid gap-1 text-[12.5px] text-[var(--crm-ink-3)]">
            تاريخ محدد
            <input type="date" min={today()} onChange={(e) => pick(e.target.value)} />
          </label>
        </div>
      )}
    </div>
  );
}
