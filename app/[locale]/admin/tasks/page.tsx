"use client";

/**
 * "المهام" — every task in one place: tasks assigned to me, tasks I assigned to
 * others (to follow up), and for managers the whole team with per-employee
 * counts. Grouped as overdue / today / upcoming / no date, with done ones
 * folded at the end. "+ مهمة جديدة" opens the task form with an assignee picker.
 * «خاصة 🔒» holds the employee's private reminders (components/crm/PrivateTodos).
 */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { members, nameOf } from "@/lib/crm/logic";
import type { Task } from "@/lib/crm/types";
import { today } from "@/lib/crm/util";
import { Empty, PageHeader } from "@/components/crm/ui";
import { TaskRow } from "@/components/crm/TaskRow";
import { PrivateTodos } from "@/components/crm/PrivateTodos";

type Tab = "mine" | "given" | "team" | "private";

export default function TasksPage() {
  const { data, loaded, openModal } = useCrm();
  const [tab, setTab] = useState<Tab>("mine");
  const [who, setWho] = useState("");
  const [showDone, setShowDone] = useState(false);

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  const t = today();
  const me = data.uid;
  const mine = data.tasks.filter((x) => x.assignee === me);
  const given = data.tasks.filter((x) => x.createdBy === me && x.assignee !== me);
  const team = data.isMgr ? data.tasks : [];
  let list = tab === "mine" ? mine : tab === "given" ? given : team;
  if (tab === "team" && who) list = list.filter((x) => x.assignee === who);

  const open = list.filter((x) => !x.done);
  const done = list.filter((x) => x.done).sort((a, b) => String(b.doneAt || b.updatedAt).localeCompare(String(a.doneAt || a.updatedAt)));
  const byDue = (a: Task, b: Task) => String(a.due || "9").localeCompare(String(b.due || "9"));
  const groups: [string, Task[], string?][] = [
    ["متأخرة", open.filter((x) => x.due && x.due < t).sort(byDue), "var(--crm-danger)"],
    ["اليوم", open.filter((x) => x.due === t)],
    ["القادمة", open.filter((x) => x.due && x.due > t).sort(byDue)],
    ["بدون تاريخ", open.filter((x) => !x.due)],
  ];
  const lateOf = (id: string) => data.tasks.filter((x) => !x.done && x.assignee === id && x.due && x.due < t).length;
  const openOf = (id: string) => data.tasks.filter((x) => !x.done && x.assignee === id).length;

  const tabs: [Tab, string, number][] = [
    ["mine", "مهامي", mine.filter((x) => !x.done).length],
    ["given", "أسندتها لغيري", given.filter((x) => !x.done).length],
    ...(data.isMgr ? [["team", "كل الفريق", team.filter((x) => !x.done).length] as [Tab, string, number]] : []),
    ["private", "خاصة 🔒", 0],
  ];

  return (
    <>
      <PageHeader title="المهام" sub="أسند مهمة لأي موظف وتابع إنجازها"
        action={<button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "task", preset: { assignee: tab === "team" && who ? who : me } })}>+ مهمة جديدة</button>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="crm-seg">
          {tabs.map(([k, l, n]) => (
            <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l} {k !== "private" && <span className="num opacity-70">{n}</span>}</button>
          ))}
        </div>
        {tab !== "private" && <label className="ms-auto flex items-center gap-1.5 text-[13px] text-[var(--crm-ink-2)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> عرض المنجزة ({done.length})
        </label>}
      </div>

      {tab === "private" ? <PrivateTodos /> : <>
      {tab === "team" && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button type="button" className={"crm-qchip" + (!who ? " on" : "")} onClick={() => setWho("")}>الكل</button>
          {members(data).map((id) => (
            <button key={id} type="button" className={"crm-qchip" + (who === id ? " on" : "")} onClick={() => setWho(who === id ? "" : id)}>
              {nameOf(data, id)} <span className="num">{openOf(id)}</span>{lateOf(id) > 0 && <span className="num text-[var(--crm-danger)]"> · {lateOf(id)} متأخرة</span>}
            </button>
          ))}
        </div>
      )}

      {tab === "given" && <p className="crm-hint mb-3">المهام التي أسندتها لزملائك — تظهر لهم في «اليوم» مع تنبيه «جديدة»، وتُشطب هنا عند إنجازها.</p>}

      {open.length || (showDone && done.length) ? (
        <div className="grid gap-3">
          {groups.filter(([, xs]) => xs.length).map(([title, xs, color]) => (
            <section key={title} className="crm-card overflow-hidden">
              <h2 className="border-b border-[var(--crm-line)] px-3.5 py-2.5 text-[14.5px]" style={color ? { color } : undefined}>{title} <span className="num muted text-[13px]">({xs.length})</span></h2>
              {xs.map((x) => <TaskRow key={x.id} t={x} />)}
            </section>
          ))}
          {showDone && done.length > 0 && (
            <section className="crm-card overflow-hidden opacity-80">
              <h2 className="border-b border-[var(--crm-line)] px-3.5 py-2.5 text-[14.5px]">المنجزة <span className="num muted text-[13px]">({done.length})</span></h2>
              {done.slice(0, 50).map((x) => <TaskRow key={x.id} t={x} />)}
            </section>
          )}
        </div>
      ) : (
        <Empty>{tab === "given" ? "لم تُسند مهام لأحد بعد." : "لا توجد مهام مفتوحة."}</Empty>
      )}
      </>}
    </>
  );
}
