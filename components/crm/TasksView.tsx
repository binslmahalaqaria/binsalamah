"use client";

import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { PRIO } from "@/lib/crm/constants";
import { visibleTasks } from "@/lib/crm/logic";
import type { Task } from "@/lib/crm/types";
import { today } from "@/lib/crm/util";
import { Empty } from "./ui";
import { TaskRow } from "./TaskRow";

/** Open tasks grouped late / today / upcoming / undated, plus a collapsible done list. */
export function TasksView() {
  const { data, openModal } = useCrm();
  const [showDone, setShowDone] = useState(false);
  const all = visibleTasks(data);
  const t = today();
  const open = all.filter((x) => !x.done);
  const sortT = (a: Task, b: Task) =>
    (a.due || "9").localeCompare(b.due || "9") || PRIO.indexOf(b.priority as never) - PRIO.indexOf(a.priority as never);
  const groups: [string, Task[], boolean?][] = [
    ["متأخرة", open.filter((x) => x.due && x.due < t), true],
    ["اليوم", open.filter((x) => x.due === t)],
    ["القادمة", open.filter((x) => x.due && x.due > t)],
    ["بدون تاريخ", open.filter((x) => !x.due)],
  ];
  const done = all.filter((x) => x.done).sort((a, b) => String(b.doneAt || "").localeCompare(String(a.doneAt || "")));
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="muted flex-1">{open.length} مهمة مفتوحة{data.isMgr && !data.viewAs ? " لكل الفريق" : ""}</div>
        <button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "task", preset: { assignee: data.isMgr && data.viewAs && data.viewAs !== "none" ? data.viewAs : data.uid } })}>+ مهمة جديدة</button>
      </div>
      {!all.length && <Empty>ما فيه مهام. أضف مهمة لك أو لأحد من الفريق.</Empty>}
      {groups.map(([l, arr, late]) =>
        arr.length ? (
          <div key={l}>
            <div className={"mt-4 mb-2 flex items-baseline gap-2.5 " + (late ? "text-[var(--crm-danger)]" : "")}>
              <h2 className="text-[15.5px]">{l}</h2><span className="num muted">{arr.length}</span>
            </div>
            <div className="crm-card overflow-hidden">{arr.sort(sortT).map((x) => <TaskRow key={x.id} t={x} />)}</div>
          </div>
        ) : null
      )}
      {done.length > 0 && (
        <>
          <div className="mt-4 mb-2 flex items-baseline gap-2.5">
            <h2 className="text-[15.5px]">المنجزة</h2><span className="num muted">{done.length}</span>
            <button type="button" className="crm-btn ghost sm ms-auto" onClick={() => setShowDone((v) => !v)}>{showDone ? "إخفاء" : "عرض"}</button>
          </div>
          {showDone && <div className="crm-card overflow-hidden">{done.slice(0, 50).map((x) => <TaskRow key={x.id} t={x} />)}</div>}
        </>
      )}
    </div>
  );
}
