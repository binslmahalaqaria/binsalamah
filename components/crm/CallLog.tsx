"use client";

/**
 * «سجل المكالمات» on لوحة المدير (client 2026-10-21): every call in the dashboard's period, filterable
 * by outcome (successful / unsuccessful / one outcome) and employee, with the client's number to call
 * back. Calls are the same as in the figures above (isCall), each within its employee's period range.
 */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { CALL_T, isCall, lbl } from "@/lib/crm/constants";
import { members, nameOf } from "@/lib/crm/logic";
import { rangeFor, type Period } from "@/lib/crm/report";
import { fmtStamp, localDay } from "@/lib/crm/util";
import { ContactIcons, Empty } from "./ui";

export type CallFilter = "all" | "ok" | "no" | (typeof CALL_T)[number];
const PAGE = 100;

export function CallLog({ period, custom, filter, setFilter }: {
  period: Period; custom: [string, string]; filter: CallFilter; setFilter: (f: CallFilter) => void;
}) {
  const { data, openClient } = useCrm();
  const [who, setWho] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const ids = members(data);
  const ranges = Object.fromEntries(ids.map((id) => [id, rangeFor(data, id, period, custom)]));

  const all = data.clients.flatMap((c) =>
    (c.log || []).filter((l) => {
      const r = l.byId && ranges[l.byId];
      const day = localDay(l.at);
      return r && day && day >= r[0] && day <= r[1] && isCall(l);
    }).map((l) => ({ c, l })),
  ).sort((a, b) => String(b.l.at).localeCompare(String(a.l.at)));

  const list = all.filter(({ l }) =>
    (!who || l.byId === who) &&
    (filter === "all" || (filter === "ok" ? l.type !== "ما رد" : filter === "no" ? l.type === "ما رد" : l.type === filter)));

  return (
    <section id="calls" className="crm-card mb-5 grid scroll-mt-4 gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[15.5px]">سجل المكالمات <span className="num muted text-sm">({list.length})</span></h2>
        <select className="!w-auto" value={filter} onChange={(e) => { setFilter(e.target.value as CallFilter); setLimit(PAGE); }} aria-label="نتيجة المكالمة">
          <option value="all">كل المكالمات</option>
          <option value="ok">الناجحة</option>
          <option value="no">غير الناجحة (لم يرد)</option>
          {CALL_T.filter((x) => x !== "ما رد").map((x) => <option key={x} value={x}>{lbl(x)}</option>)}
        </select>
        <select className="!w-auto" value={who} onChange={(e) => { setWho(e.target.value); setLimit(PAGE); }} aria-label="الموظف">
          <option value="">كل الموظفين</option>
          {ids.map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
        </select>
      </div>
      {!list.length ? (
        <Empty>لا توجد مكالمات بهذا الفلتر في الفترة المختارة.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="crm-table min-w-[760px]">
            <thead><tr><th>الوقت</th><th>الموظف</th><th>العميل</th><th>الجوال</th><th>النتيجة</th><th>الملاحظة</th></tr></thead>
            <tbody>
              {list.slice(0, limit).map(({ c, l }, i) => (
                <tr key={c.id + l.at + i}>
                  <td className="num whitespace-nowrap text-[12.5px]">{fmtStamp(l.at)}</td>
                  <td>{nameOf(data, l.byId)}</td>
                  <td><b className="link" onClick={() => openClient(c.id)}>{c.name}</b></td>
                  <td><span className="flex items-center gap-1.5"><span className="num">{c.phone || "—"}</span>{c.phone && <ContactIcons phone={c.phone} />}</span></td>
                  <td className={l.type === "ما رد" ? "font-semibold text-[var(--crm-danger)]" : ""}>{lbl(l.type)}</td>
                  <td className="max-w-[260px] truncate text-[12.5px] text-[var(--crm-ink-3)]">{l.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > limit && <button type="button" className="crm-btn sm mt-2" onClick={() => setLimit((n) => n + PAGE)}>عرض المزيد ({list.length - limit})</button>}
        </div>
      )}
    </section>
  );
}
