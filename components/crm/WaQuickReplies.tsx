"use client";

/**
 * Quick replies in the WhatsApp composer (client 2026-11-11): saved messages put into the box with one tap, to edit
 * and send. Shared by the team in `crm/lists.waQuick`; managers add and delete them (the rules allow managers to
 * write crm/lists). «{الاسم}» in a reply becomes the client's name.
 */
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type QuickReply = { id: string; title: string; text: string };

export function WaQuickReplies({ canEdit, clientName, disabled, onPick }: {
  canEdit: boolean;
  clientName?: string | null;
  disabled?: boolean;
  onPick: (text: string) => void;
}) {
  const [list, setList] = useState<QuickReply[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => onSnapshot(doc(db, "crm", "lists"), (s) => {
    const xs = s.exists() ? (s.data().waQuick as unknown) : null;
    setList(Array.isArray(xs) ? xs.filter((x) => x && typeof x.text === "string").map((x) => ({ id: String(x.id), title: String(x.title || ""), text: String(x.text) })) : []);
  }, () => setList([])), []);

  const save = async (next: QuickReply[]) => {
    try { await setDoc(doc(db, "crm", "lists"), { waQuick: next }, { merge: true }); setErr(""); return true; }
    catch { setErr("تعذّر الحفظ — إضافة الردود للمدير"); return false; }
  };
  const fill = (t: string) => t.replace(/\{الاسم\}/g, (clientName || "").trim() || "");

  return (
    <div className="relative shrink-0">
      <button type="button" className="crm-btn h-[42px] max-md:!px-2.5" disabled={disabled} onClick={() => setOpen((o) => !o)} title="ردود سريعة جاهزة">
        ⚡<span className="max-md:hidden"> ردود سريعة</span>
      </button>
      {open && (
        <div className="absolute bottom-[50px] end-0 z-30 grid max-h-[60vh] w-[min(340px,86vw)] gap-1.5 overflow-auto rounded-xl border border-[var(--crm-line)] bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-1">
            <b className="text-[13.5px]">ردود سريعة</b>
            <button type="button" className="crm-btn ghost sm" onClick={() => { setOpen(false); setAdding(false); }}>إغلاق</button>
          </div>
          {!list.length && !adding && <p className="crm-hint m-0 px-1">ما فيه ردود محفوظة.{canEdit ? " أضف أول رد." : " المدير يضيفها."}</p>}
          {list.map((r) => (
            <div key={r.id} className="flex items-start gap-1 rounded-lg hover:bg-[var(--crm-surface-2)]">
              <button type="button" className="min-w-0 flex-1 p-1.5 text-start" onClick={() => { onPick(fill(r.text)); setOpen(false); }}>
                <b className="block text-[13px]">{r.title || r.text.slice(0, 30)}</b>
                <span className="line-clamp-2 block text-[12.5px] text-[var(--crm-ink-3)]">{r.text}</span>
              </button>
              {canEdit && (
                <button type="button" className="crm-btn ghost sm" title="حذف" aria-label={"حذف " + r.title}
                  onClick={() => { if (window.confirm("حذف الرد «" + (r.title || r.text.slice(0, 30)) + "»؟")) save(list.filter((x) => x.id !== r.id)); }}>✕</button>
              )}
            </div>
          ))}
          {canEdit && (adding ? (
            <div className="grid gap-1.5 rounded-lg border border-[var(--crm-line)] p-2">
              <input value={title} placeholder="اسم الرد، مثال: ترحيب" aria-label="اسم الرد" onChange={(e) => setTitle(e.target.value)} />
              <textarea rows={3} value={text} placeholder="نص الرد. اكتب {الاسم} ويتحول لاسم العميل" aria-label="نص الرد" onChange={(e) => setText(e.target.value)} />
              <div className="flex gap-1.5">
                <button type="button" className="crm-btn sm primary" onClick={async () => {
                  if (!text.trim()) return setErr("اكتب نص الرد");
                  if (await save([...list, { id: Math.random().toString(36).slice(2, 10), title: title.trim(), text: text.trim() }])) { setTitle(""); setText(""); setAdding(false); }
                }}>حفظ</button>
                <button type="button" className="crm-btn sm" onClick={() => { setAdding(false); setErr(""); }}>إلغاء</button>
              </div>
            </div>
          ) : <button type="button" className="crm-btn sm justify-self-start" onClick={() => setAdding(true)}>+ رد جديد</button>)}
          {err && <p className="m-0 px-1 text-[12.5px] text-[var(--crm-danger)]">{err}</p>}
        </div>
      )}
    </div>
  );
}
