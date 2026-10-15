"use client";

/**
 * "اختيار من واتساب" for the client and request forms: lists WhatsApp chats
 * whose number is not yet a CRM client and fills the form's name and phone.
 * Shown to whoever may use the company WhatsApp (see the `whatsapp` permission).
 */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { can } from "@/lib/crm/logic";
import { normPhone } from "@/lib/crm/util";
import { localPhone, seesAllOf, waApi, waTime, type WaChat, type WaSource } from "@/lib/crm/wa";

export function WaPicker({ onPick }: { onPick: (c: { name: string; phone: string; last: string }) => void }) {
  const { data } = useCrm();
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<WaChat[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  if (!can(data, "whatsapp")) return null;

  async function load() {
    setOpen(true);
    setErr("");
    try {
      const { sources } = await waApi<{ sources: WaSource[] }>("/api/sources");
      if (!sources.some((s) => s.status === "open")) return setErr("لا يوجد رقم واتساب مربوط. اربطه من صفحة واتساب أولاً.");
      // Unregistered numbers are only offered from numbers whose chats this user may see in full.
      const full = new Set(sources.filter((s) => seesAllOf(s, data.uid, data.isMgr)).map((s) => s.id));
      const taken = new Set(data.clients.map((c) => normPhone(c.phone)).filter(Boolean));
      const r = await waApi<{ chats: WaChat[] }>("/api/chats");
      const seen = new Set<string>();
      setChats(r.chats.filter((c) => full.has(c.source) && c.phone && !taken.has(c.phone) && !seen.has(c.phone) && (seen.add(c.phone), true)));
    } catch {
      setErr("خدمة واتساب غير متصلة.");
    }
  }

  if (!open) {
    return (
      <button type="button" className="crm-btn sm justify-self-start sm:col-span-2" onClick={load}>
        <span className="text-[#25d366]">●</span> اختيار من واتساب
      </button>
    );
  }
  const qq = q.trim();
  const list = (chats || []).filter((c) => !qq || [c.name, c.phone, c.last].some((x) => x && x.includes(qq))).slice(0, 60);
  return (
    <div className="grid gap-2 rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface-2)] p-2.5 sm:col-span-2">
      <div className="flex items-center gap-2">
        <b className="flex-1 text-[13.5px]">محادثات واتساب غير المسجّلة في النظام</b>
        <button type="button" className="crm-btn ghost sm" onClick={() => setOpen(false)}>إغلاق</button>
      </div>
      {err ? <p className="crm-hint m-0">{err}</p> : !chats ? <p className="crm-hint m-0">جارٍ التحميل…</p> : (
        <>
          <input className="crm-input" placeholder="ابحث بالاسم أو الرقم أو نص الرسالة" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid max-h-60 gap-1 overflow-y-auto">
            {list.length ? list.map((c) => (
              <button key={c.source + c.jid} type="button"
                onClick={() => { onPick({ name: c.name || "", phone: localPhone(c.phone), last: c.last || "" }); setOpen(false); }}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-lg bg-white px-2.5 py-2 text-start hover:outline hover:outline-1 hover:outline-[var(--crm-gold)]">
                <span className="truncate font-semibold">{c.name || localPhone(c.phone)}</span>
                <span className="num text-[11.5px] text-[var(--crm-ink-3)]">{waTime(c.ts)}</span>
                <span className="truncate text-[12.5px] text-[var(--crm-ink-2)]"><span className="num">{localPhone(c.phone)}</span>{c.last ? " · " + c.last : ""}</span>
              </button>
            )) : <p className="crm-hint m-0">لا توجد محادثات غير مسجّلة{qq ? " بهذا البحث" : ""}.</p>}
          </div>
        </>
      )}
    </div>
  );
}
