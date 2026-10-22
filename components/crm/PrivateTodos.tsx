"use client";

/**
 * «مهامي الخاصة»: personal reminders an employee keeps for themself. Stored in
 * the `todos` collection with `owner` = their uid; the Firestore rules let only
 * the owner read or change them — not other staff, not managers. Quick add
 * (text + optional date/time), grouped overdue / today / upcoming / no date,
 * tick to finish, done ones folded at the end.
 */
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { remove, write } from "@/lib/crm/actions";
import { nowStamp, today } from "@/lib/crm/util";

export interface Todo { id: string; owner: string; text: string; due: string | null; time: string | null; done: boolean; doneAt?: string | null; createdAt: string }

/** The signed-in person's own reminders (only the owner can read them — Firestore rules). */
export function usePrivateTodos(enabled = true) {
  const { data } = useCrm();
  const [list, setList] = useState<Todo[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!data.uid || !enabled) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let off = () => {};
    const sub = () => {
      off = onSnapshot(query(collection(db, "todos"), where("owner", "==", data.uid)),
        (s) => { setErr(""); setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Todo, "id">) }))); },
        () => { setErr("القسم الخاص يحتاج تفعيل الصلاحيات من الإدارة."); retry = setTimeout(sub, 15000); });
    };
    sub();
    return () => { off(); if (retry) clearTimeout(retry); };
  }, [data.uid, enabled]);
  return { list, err };
}

export const toggleTodo = (x: Todo) => write("todos", x.id, { done: !x.done, doneAt: x.done ? null : nowStamp() }, "update");

export function PrivateTodos() {
  const { data, toast } = useCrm();
  const { list, err } = usePrivateTodos();
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [time, setTime] = useState("");
  const [showDone, setShowDone] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await write("todos", null, { owner: data.uid, text: text.trim(), due: due || null, time: time || null, done: false, createdAt: nowStamp() });
      setText(""); setDue(""); setTime("");
    } catch {
      toast("تعذّر الحفظ");
    }
  }
  const toggle = (x: Todo) => toggleTodo(x).catch(() => toast("تعذّر الحفظ"));
  const del = (x: Todo) => remove("todos", x.id).catch(() => toast("تعذّر الحذف"));

  const t = today();
  const open = list.filter((x) => !x.done);
  const done = list.filter((x) => x.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  const key = (x: Todo) => (x.due || "9") + (x.time || "");
  const groups: [string, Todo[], boolean?][] = [
    ["متأخرة", open.filter((x) => x.due && x.due < t).sort((a, b) => key(a).localeCompare(key(b))), true],
    ["اليوم", open.filter((x) => x.due === t).sort((a, b) => key(a).localeCompare(key(b)))],
    ["القادمة", open.filter((x) => x.due && x.due > t).sort((a, b) => key(a).localeCompare(key(b)))],
    ["بدون تاريخ", open.filter((x) => !x.due)],
  ];
  const when = (x: Todo) => [x.due === t ? "اليوم" : x.due, x.time].filter(Boolean).join(" · ");

  const row = (x: Todo) => (
    <div key={x.id} className="crm-card flex items-center gap-3 px-3 py-2.5">
      <input type="checkbox" checked={x.done} onChange={() => toggle(x)} className="h-5 w-5 shrink-0 accent-[var(--crm-gold)]" aria-label="تم" />
      <span className={"flex-1 " + (x.done ? "text-[var(--crm-ink-3)] line-through" : "")}>{x.text}</span>
      {when(x) && <span className="num text-[12px] text-[var(--crm-ink-3)]">{when(x)}</span>}
      <button type="button" onClick={() => del(x)} className="crm-btn ghost sm" aria-label="حذف">×</button>
    </div>
  );

  return (
    <div className="grid gap-3">
      <p className="m-0 text-[13px] text-[var(--crm-ink-3)]">🔒 هذه القائمة لك وحدك — لا يراها أي موظف آخر ولا الإدارة.</p>
      <form onSubmit={add} className="crm-card flex flex-wrap items-center gap-2 p-3">
        <input className="min-w-[200px] flex-1" placeholder="اكتب تذكيراً… مثال: الاتصال بأبو فهد بخصوص فيلا الملقا" value={text} onChange={(e) => setText(e.target.value)} />
        <input type="date" className="!w-auto" value={due} onChange={(e) => setDue(e.target.value)} aria-label="التاريخ" />
        <input type="time" className="!w-auto" value={time} onChange={(e) => setTime(e.target.value)} aria-label="الوقت" />
        <button type="submit" className="crm-btn primary" disabled={!text.trim()}>إضافة</button>
      </form>
      {err && <p className="m-0 text-[13px] text-[var(--crm-danger)]">{err}</p>}
      {!open.length && !err && <p className="m-0 py-6 text-center text-[var(--crm-ink-3)]">لا توجد تذكيرات — أضف أول تذكير بالأعلى.</p>}
      {groups.filter(([, xs]) => xs.length).map(([label, xs, late]) => (
        <div key={label} className="grid gap-1.5">
          <b className="text-[13px]" style={late ? { color: "var(--crm-danger)" } : undefined}>{label} <span className="num opacity-60">{xs.length}</span></b>
          {xs.map(row)}
        </div>
      ))}
      {done.length > 0 && (
        <div className="grid gap-1.5">
          <button type="button" className="crm-btn ghost sm justify-self-start" onClick={() => setShowDone((v) => !v)}>{showDone ? "إخفاء المنجزة" : `المنجزة (${done.length})`}</button>
          {showDone && done.map(row)}
        </div>
      )}
    </div>
  );
}
