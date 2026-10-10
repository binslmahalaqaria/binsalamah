"use client";

/**
 * "اليوم" — the CRM home: the staff member's auto-built daily routine,
 * monthly goal pace, attendance check-in/out, and three queues: calls due
 * (with one-tap call logging), visits to confirm or close out, and tasks.
 * Ported from the original artifact CRM's Today screen.
 */
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { GOALK, QL_OUT, REQ_TONE, TEMP_TONE } from "@/lib/crm/constants";
import {
  activeClients, actualsFor, attToday, calledToday, dueCalls, fmtK, goalOf, goalVals, hoursOf, lateMin, monthInfo,
  myTasksOpen, nameOf, noDate, pace, PACE_TXT, planFor, propById, reqsOf, upcoming, visibleClients, visibleTasks, wantLine,
} from "@/lib/crm/logic";
import { applyUpdate, checkIO, confirmVisit, markTasksSeen, visitNoShow } from "@/lib/crm/actions";
import type { Client } from "@/lib/crm/types";
import {
  addDays, ageDays, fmtVisit, hm, lateTxt, monthName, num, relDay, today, waLink, weekdayLong, ym,
} from "@/lib/crm/util";
import { ContactIcons, Empty, Kebab, PageHeader, Pill } from "@/components/crm/ui";
import { TasksView } from "@/components/crm/TasksView";

export default function TodayPage() {
  const { data, me, loaded, openClient, openModal, setViewAs, toast } = useCrm();
  const router = useRouter();
  const [seg, setSeg] = useState<"calls" | "visits" | "tasks">("calls");
  const [callF, setCallF] = useState<"due" | "late" | "now" | "done">("due");
  const [qlog, setQlog] = useState<string | null>(null);
  const [qType, setQType] = useState("");
  const [qNext, setQNext] = useState("");
  const [qDate, setQDate] = useState("");
  const [qNote, setQNote] = useState("");
  const [planOpen, setPlanOpen] = useState(true);

  if (!loaded || !me) return <Empty>جاري تحميل البيانات…</Empty>;

  const t = today();
  const due = dueCalls(data);
  const lateL = due.filter((c) => (c.nextCall as string) < t),
    nowL = due.filter((c) => c.nextCall === t);
  const doneL = activeClients(data)
    .filter((c) => calledToday(c) && !(c.nextCall && c.nextCall <= t))
    .concat(visibleClients(data).filter((c) => (c.status || "نشط") !== "نشط" && calledToday(c)));
  const total = due.length + doneL.length;
  const pct = total ? Math.round((doneL.length / total) * 100) : 0;
  const vis = activeClients(data).filter((c) => c.visitAt);
  const soon = vis.filter((c) => { const d = c.visitAt!.slice(0, 10); return d >= t && d <= addDays(1); }).sort((a, b) => a.visitAt!.localeCompare(b.visitAt!));
  const pastV = vis.filter((c) => c.visitAt!.slice(0, 10) < t).sort((a, b) => a.visitAt!.localeCompare(b.visitAt!));
  const td = visibleTasks(data).filter((x) => !x.done && x.due && x.due <= t);
  const newTasks = myTasksOpen(data).filter((x) => x.seen === false).length;
  const fresh = data.clients.filter((c) => c.unseen && c.assignee === data.uid && !c.escalatedFrom);
  const escL = data.clients.filter((c) => c.escalatedFrom && c.assignee === data.uid && c.unseen);
  const unassigned = data.isMgr && !data.viewAs ? data.clients.filter((c) => !c.assignee && (c.status || "نشط") === "نشط").length : 0;
  const who = data.isMgr && data.viewAs && data.viewAs !== "none" ? data.viewAs : data.uid;

  /* ---- attendance ---- */
  const myAtt = attToday(data, data.uid);
  const late = lateMin(data, myAtt, data.uid);
  const attBar = !myAtt ? (
    <button type="button" className="crm-btn gold" onClick={async () => { await checkIO(data.uid, "in"); toast("تم تسجيل حضورك"); }}>تسجيل حضور</button>
  ) : !myAtt.out ? (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-[var(--crm-ink-2)]">حضرت {hm(myAtt.in)} {late > 0 && <Pill tone="warm">متأخر {late} د</Pill>}</span>
      <button type="button" className="crm-btn" onClick={async () => { await checkIO(data.uid, "out"); toast("تم تسجيل انصرافك، يعطيك العافية"); }}>تسجيل انصراف</button>
    </div>
  ) : (
    <span className="text-[13px] text-[var(--crm-ink-2)]">{hm(myAtt.in)} – {hm(myAtt.out)} · {hoursOf(myAtt).toFixed(1)} س</span>
  );

  /* ---- routine ---- */
  const plan = planFor(data, who, hm);
  const planDone = plan.filter((x) => x.done).length;
  function planGo(k: string) {
    if (who !== data.uid) return;
    if (k === "checkin") return checkIO(data.uid, "in").then(() => toast("تم تسجيل حضورك"));
    if (k === "checkout") return checkIO(data.uid, "out").then(() => toast("تم تسجيل انصرافك، يعطيك العافية"));
    if (k === "late" || k === "calls") { setSeg("calls"); setCallF(k === "late" ? "late" : "due"); }
    else if (k === "confirm" || k === "outcome") setSeg("visits");
    else if (k === "tasks") { setSeg("tasks"); markTasksSeen(data); }
    else if (k === "fresh") router.push("/admin/requests?stage=جديد");
    else if (k === "send") router.push("/admin/requests?follow=none");
  }

  /* ---- goals ---- */
  const month = ym();
  const g = goalOf(data, who, month);
  const a = actualsFor(data, who, month);
  const mi = monthInfo(month);
  const goalTiles = g
    ? GOALK.filter(([k]) => num(g[k])).map(([k, , col]) => {
        const target = num(g[k])!;
        if (k === "calls") {
          const v = a.callsToday;
          return { k, label: "مكالمات اليوم", v: String(v), target: String(target), w: Math.min(100, Math.round((v / target) * 100)), st: v >= target ? "ok" : "", txt: v >= target ? "خلّصت هدف اليوم" : "باقي " + (target - v) };
        }
        const v = goalVals(a)[k];
        const st = pace(v, target, month) || "ok";
        return { k, label: col, v: fmtK(k, v), target: fmtK(k, target), w: Math.min(100, Math.round((v / target) * 100)), st, txt: PACE_TXT[st] };
      })
    : [];

  /* ---- call queue ---- */
  async function saveQuick(c: Client) {
    if (!qType) return toast("اختر وش صار");
    const def = QL_OUT.find((x) => x[0] === qType)?.[2];
    const nx = qNext || String(def);
    let next: string | null = null;
    if (nx === "date") {
      if (!qDate) return toast("اختر التاريخ");
      next = qDate;
    } else if (nx !== "none") next = addDays(+nx);
    await applyUpdate(data, c.id, qType, next, qNote.trim(), null);
    setQlog(null);
    toast("انحفظ — " + (next ? "المكالمة الجاية " + relDay(next) : "بدون موعد"));
  }
  const lastContact = (c: Client) => {
    const l = (c.log || [])[0];
    if (!l) return <span className="muted">ما فيه تواصل سابق</span>;
    return (
      <>
        <b>{l.type || "ملاحظة"}</b> <span className="muted">· {ageDays(l.at)}</span>
        {l.text && <div className="truncate text-[12.5px] text-[var(--crm-ink-3)]">{String(l.text).slice(0, 90)}</div>}
      </>
    );
  };
  const GRID = "md:grid-cols-[34px_minmax(0,1.5fr)_minmax(0,1.3fr)_130px_auto]";
  const callRow = (c: Client, idx: number) => {
    const isLate = (c.nextCall as string) < t;
    const open = qlog === c.id;
    const r0 = reqsOf(data, c)[0];
    return (
      <div key={c.id}>
        <div className={"crm-row grid-cols-[30px_minmax(0,1fr)_auto] " + GRID + (isLate ? " late" : "") + (open ? " bg-[var(--crm-surface-2)]" : "")}>
          <div className={"num grid h-[26px] w-[26px] place-items-center self-start rounded-full border text-xs font-bold md:self-center " + (isLate ? "border-transparent bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]" : "border-[var(--crm-line)] text-[var(--crm-ink-3)]")}>{idx}</div>
          <div className="min-w-0 cursor-pointer" onClick={() => openClient(c.id)}>
            <div className="flex flex-wrap items-center gap-1.5">
              <b className="font-heading text-[15.5px]">{c.name}</b>
              <Pill tone={TEMP_TONE[c.temp || ""]}>{c.temp}</Pill>
              {data.isMgr && c.assignee && c.assignee !== data.uid && <span className="crm-chip">{nameOf(data, c.assignee)}</span>}
              {c.escalatedFrom && c.assignee === data.uid && <Pill tone="warm">راجع من {nameOf(data, c.escalatedFrom)}</Pill>}
            </div>
            <div className="mt-0.5 truncate text-[13px] text-[var(--crm-ink-2)]">{wantLine(data, c) || <span className="muted">ما تسجّل طلبه</span>}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--crm-ink-3)]">
              {r0 && <Pill tone={REQ_TONE[r0.status || "جديد"]}>{r0.status || "جديد"}</Pill>}
              {c.phone && <span className="num">{c.phone}</span>}
            </div>
          </div>
          <div className="col-span-2 min-w-0 text-[13px] md:col-span-1 md:col-start-auto max-md:col-start-2 max-md:row-start-2">{lastContact(c)}</div>
          <div className="max-md:col-start-3 max-md:row-start-1 self-start md:self-center"><Pill tone={isLate ? "hot" : "accent"}>{lateTxt(c.nextCall)}</Pill></div>
          <div className="flex items-center justify-start gap-1.5 max-md:col-span-2 max-md:col-start-2 md:justify-end">
            <ContactIcons phone={c.phone} />
            <button type="button" className="crm-btn sm primary" onClick={() => { setQlog(open ? null : c.id); setQType(""); setQNext(""); setQNote(""); setQDate(""); }}>{open ? "إغلاق" : "سجّل المكالمة"}</button>
          </div>
        </div>
        {open && (
          <div className="grid gap-3 border-t border-dashed border-[var(--crm-line)] bg-[var(--crm-surface-2)] px-4 pt-1 pb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="w-full text-[13px] font-semibold text-[var(--crm-ink-2)] md:w-auto md:min-w-[110px]">وش صار؟</span>
              <div className="flex flex-wrap gap-1.5">
                {QL_OUT.map(([k, l, d]) => (
                  <button key={k} type="button" className={"crm-qchip" + (qType === k ? " on" : "")} onClick={() => { setQType(k); setQNext(String(d)); }}>{l}</button>
                ))}
                {r0 && <button type="button" className="crm-qchip" onClick={() => openModal({ kind: "visit", reqId: r0.id })}>حدد موعد زيارة</button>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="w-full text-[13px] font-semibold text-[var(--crm-ink-2)] md:w-auto md:min-w-[110px]">نتصل عليه متى؟</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[["1", "بكرة"], ["3", "بعد 3 أيام"], ["7", "بعد أسبوع"], ["date", "تاريخ"], ["none", "لا تتصل"]].map(([v, l]) => (
                  <button key={v} type="button" className={"crm-qchip" + (qNext === v ? " on" : "")} onClick={() => setQNext(v)}>{l}</button>
                ))}
                {qNext === "date" && <input type="date" min={t} value={qDate} onChange={(e) => setQDate(e.target.value)} />}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <input className="crm-input min-w-[180px] flex-1" placeholder="ملاحظة سريعة (اختياري)" value={qNote}
                onChange={(e) => setQNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveQuick(c)} />
              <button type="button" className="crm-btn primary" disabled={!qType} onClick={() => saveQuick(c)}>حفظ</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const visitCard = (c: Client, past: boolean) => {
    const p = propById(data, c.visitProperty);
    const msg = "السلام عليكم " + c.name + "، نذكّرك بموعد زيارة" + (p ? " " + p.title : " العقار") + " " + fmtVisit(c.visitAt) + (p?.link ? "\nالموقع: " + p.link : "") + "\nنأكد الموعد؟";
    return (
      <article key={c.id} className={"crm-card grid items-center gap-2.5 border-s-4 p-3.5 md:grid-cols-[minmax(0,1fr)_auto] " + (past ? "border-s-[var(--crm-danger)]" : "border-s-[var(--crm-gold)]")}>
        <div className="grid min-w-0 cursor-pointer gap-1.5" onClick={() => openClient(c.id)}>
          <div className="flex flex-wrap items-center gap-2">
            <b className="font-heading text-[15.5px]">{c.name}</b>
            {c.visitConfirmed ? <Pill tone="ok">مؤكد</Pill> : !past && <Pill tone="warm">يحتاج تأكيد</Pill>}
            <span className="ms-auto text-[12.5px] text-[var(--crm-ink-3)]">{fmtVisit(c.visitAt)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {p && <span className="crm-chip">{p.title}</span>}
            {data.isMgr && c.assignee && <span className="crm-chip">{nameOf(data, c.assignee)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {past ? (
            <>
              <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "update", clientId: c.id, type: "زار العقار", propertyId: c.visitProperty || undefined })}>زار — سجّل النتيجة</button>
              <Kebab items={[{ label: "ما حضر", onClick: async () => { await visitNoShow(data, c.id); toast("انشال الموعد، واتصل عليه اليوم"); } }, { label: "ملف العميل", onClick: () => openClient(c.id) }]} />
            </>
          ) : (
            <>
              {c.phone && <a className="crm-btn sm wa" href={waLink(c.phone, msg) || "#"} target="_blank" rel="noopener">رسالة تأكيد</a>}
              {!c.visitConfirmed && <button type="button" className="crm-btn sm primary" onClick={async () => { await confirmVisit(data, c.id); toast("تم تأكيد الموعد"); }}>أكّد</button>}
              <Kebab items={[c.phone ? { label: "اتصال", href: "tel:" + c.phone } : null, { label: "ملف العميل", onClick: () => openClient(c.id) }]} />
            </>
          )}
        </div>
      </article>
    );
  };

  const list = callF === "late" ? lateL : callF === "now" ? nowL : callF === "done" ? doneL : due;
  const up = upcoming(data),
    nd = noDate(data);

  return (
    <>
      <PageHeader eyebrow={weekdayLong(new Date())} title="اليوم" sub="اتصالاتك وزياراتك ومهامك لليوم" action={attBar} />

      {fresh.length > 0 && (
        <div className="crm-card mb-2 px-3.5 py-2.5 text-sm">
          <b>{fresh.length}</b> عميل جديد انسند لك:{" "}
          {fresh.slice(0, 3).map((c, i) => <span key={c.id}>{i > 0 && "، "}<span className="link" onClick={() => openClient(c.id)}>{c.name}</span></span>)}
        </div>
      )}
      {escL.length > 0 && (
        <div className="mb-2 rounded-xl bg-[var(--crm-warn-soft)] px-3.5 py-2.5 text-sm text-[var(--crm-warn)]">
          رجع لك <b>{escL.length}</b> عميل ما تواصل معهم الموظف:{" "}
          {escL.slice(0, 3).map((c, i) => <span key={c.id}>{i > 0 && "، "}<span className="link" onClick={() => openClient(c.id)}>{c.name}</span> (من {nameOf(data, c.escalatedFrom)})</span>)}
        </div>
      )}
      {unassigned > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[var(--crm-warn-soft)] px-3.5 py-2.5 text-sm text-[var(--crm-warn)]">
          <span>فيه <b>{unassigned}</b> عميل غير مسند لأي موظف.</span>
          <button type="button" className="crm-btn sm" onClick={() => { setViewAs("none"); router.push("/admin/clients"); }}>وزّعهم</button>
        </div>
      )}

      {plan.length > 0 && (
        <div className="crm-card mb-3 overflow-hidden">
          <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-start" onClick={() => setPlanOpen((v) => !v)} aria-expanded={planOpen}>
            <b className="font-heading text-[15px]">{who === data.uid ? "روتين اليوم" : "روتين " + nameOf(data, who)}</b>
            <span className="text-[13px] whitespace-nowrap text-[var(--crm-ink-2)]"><span className="num">{planDone}</span> من <span className="num">{plan.length}</span></span>
            <span className="crm-bar ok max-w-[260px] min-w-[60px] flex-1"><i style={{ width: Math.round((planDone / plan.length) * 100) + "%" }} /></span>
            <span className="ms-auto text-xs text-[var(--crm-ink-3)]">{planOpen ? "▴" : "▾"}</span>
          </button>
          {planOpen && (
            <div className="grid border-t border-[#efebe4] md:grid-cols-3">
              {(["الصباح", "خلال اليوم", "آخر اليوم"] as const).map((sec) => {
                const xs = plan.filter((x) => x.sec === sec);
                if (!xs.length) return null;
                return (
                  <div key={sec} className="grid content-start gap-0.5 border-[#efebe4] px-3 pt-2.5 pb-3 max-md:border-t md:border-s md:first:border-s-0">
                    <span className="px-1.5 pb-1 text-[11.5px] font-semibold tracking-wide text-[var(--crm-gold-ink)]">{sec}</span>
                    {xs.map((x) => (
                      <button key={x.k} type="button" disabled={who !== data.uid} onClick={() => planGo(x.k)}
                        className="grid grid-cols-[20px_1fr] items-start gap-x-2 rounded-lg px-1.5 py-1.5 text-start enabled:hover:bg-[var(--crm-surface-2)]">
                        <span className={"mt-0.5 grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.5px] text-xs font-bold " + (x.done ? "border-[var(--crm-ok)] bg-[var(--crm-ok)] text-white" : "border-[var(--crm-ink-3)]")}>{x.done ? "✓" : ""}</span>
                        <span className={"text-sm font-medium " + (x.done ? "text-[var(--crm-ink-3)] line-through" : "")}>{x.label}</span>
                        {x.hint && <span className={"col-start-2 text-xs " + (x.done ? "text-[var(--crm-ink-3)]" : "text-[var(--crm-ink-2)]")}>{x.hint}</span>}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {goalTiles.length > 0 && g && (
        <div className="crm-card mb-3 grid gap-2.5 p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2.5">
            <b className="font-heading text-[15px]">{who === data.uid ? "أهدافي" : "أهداف " + nameOf(data, who)} لشهر {monthName(month)}</b>
            <small className="muted text-[12.5px]">باقي <span className="num">{mi.left}</span> يوم</small>
          </div>
          {g.note && <div className="border-s-2 border-[var(--crm-gold)] ps-2.5 text-[13px] text-[var(--crm-ink-2)]">{g.note}</div>}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            {goalTiles.map((x) => (
              <div key={x.k} className="grid gap-1.5 rounded-xl border border-[#efebe4] bg-[var(--crm-surface-2)] px-3 py-2.5">
                <span className="text-[12.5px] text-[var(--crm-ink-2)]">{x.label}</span>
                <span className="num font-heading text-xl">{x.v} <small className="text-[13px] text-[var(--crm-ink-3)]">/ {x.target}</small></span>
                <div className={"crm-bar " + x.st}><i style={{ width: x.w + "%" }} /></div>
                <span className={"text-[11.5px] font-semibold " + (x.st === "ok" ? "text-[var(--crm-ok)]" : x.st === "warn" ? "text-[var(--crm-warn)]" : x.st === "bad" ? "text-[var(--crm-danger)]" : "text-[var(--crm-ink-3)]")}>{x.txt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="crm-seg my-3" role="tablist">
        {([["calls", "المكالمات", due.length], ["visits", "الزيارات", soon.length + pastV.length], ["tasks", "المهام", td.length + newTasks]] as const).map(([k, l, n]) => (
          <button key={k} type="button" role="tab" aria-selected={seg === k} className={seg === k ? "on" : ""} onClick={() => { setSeg(k); if (k === "tasks") markTasksSeen(data); }}>
            {l}{n > 0 && <span className="n num">{n}</span>}
          </button>
        ))}
      </div>

      {seg === "calls" && (
        <>
          <div className="crm-card mb-3 grid gap-2.5 px-4 py-3">
            <div className="grid gap-2">
              <div className="text-sm"><b className="num font-heading text-lg">{doneL.length}</b> من <b className="num font-heading text-lg">{total}</b> مكالمة تمت اليوم{lateL.length > 0 && <> · <span className="text-[var(--crm-danger)]">{lateL.length} متأخرة</span></>}</div>
              <div className="crm-bar"><i style={{ width: pct + "%" }} /></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([["due", "المطلوبة", due.length], ["late", "المتأخرة", lateL.length], ["now", "موعدها اليوم", nowL.length], ["done", "تمت اليوم", doneL.length]] as const).map(([k, l, n]) => (
                <button key={k} type="button" className={"crm-qchip" + (callF === k ? " on" : "")} onClick={() => setCallF(k)}>{l} <span className="num opacity-70">{n}</span></button>
              ))}
            </div>
          </div>
          {callF === "done" ? (
            list.length ? (
              <div className="crm-card overflow-hidden">
                {list.map((c) => { const l = calledToday(c)!; return (
                  <div key={c.id} className={"crm-row grid-cols-[30px_minmax(0,1fr)_auto] opacity-85 " + GRID}>
                    <div className="grid h-[26px] w-[26px] place-items-center rounded-full border border-[var(--crm-line)] text-xs">✓</div>
                    <div className="cursor-pointer" onClick={() => openClient(c.id)}><b className="font-heading">{c.name}</b><div className="text-[13px] text-[var(--crm-ink-2)]">{wantLine(data, c)}</div></div>
                    <div className="text-[13px] max-md:hidden"><b>{l.type}</b>{l.text && <div className="truncate text-[12.5px] text-[var(--crm-ink-3)]">{l.text}</div>}</div>
                    <div className="max-md:hidden"><Pill tone="muted">{c.nextCall ? "القادم " + relDay(c.nextCall) : "بدون موعد"}</Pill></div>
                    <div className="flex justify-end gap-1.5"><ContactIcons phone={c.phone} /></div>
                  </div>
                ); })}
              </div>
            ) : <Empty>ما سجّلت أي مكالمة اليوم للحين.</Empty>
          ) : !list.length ? (
            <Empty big>{due.length ? "ما فيه في هذا الفلتر." : "خلصت مكالمات اليوم. يعطيك العافية!"}</Empty>
          ) : (
            <div className="crm-card overflow-hidden">
              <div className={"crm-head hidden md:grid md:gap-3 " + GRID}><span>#</span><span>العميل وطلبه</span><span>آخر تواصل</span><span>الموعد</span><span /></div>
              {callF === "due" && lateL.length > 0 && nowL.length > 0 ? (
                <>
                  <div className="crm-grp late">متأخرة <span className="num">{lateL.length}</span></div>
                  {lateL.map((c, i) => callRow(c, i + 1))}
                  <div className="crm-grp">موعدها اليوم <span className="num">{nowL.length}</span></div>
                  {nowL.map((c, i) => callRow(c, lateL.length + i + 1))}
                </>
              ) : list.map((c, i) => callRow(c, i + 1))}
            </div>
          )}
          {up.length > 0 && (
            <details className="mt-3.5">
              <summary className="cursor-pointer px-0.5 py-2 font-heading text-[var(--crm-ink-2)]">مكالمات الأيام الجاية <span className="num">({up.length})</span></summary>
              <div className="crm-card mt-1.5 overflow-hidden">
                {up.map((c) => (
                  <div key={c.id} className="flex cursor-pointer justify-between gap-2.5 border-b border-[var(--crm-line)] px-3 py-2.5 last:border-0 hover:bg-[var(--crm-surface-2)]" onClick={() => openClient(c.id)}>
                    <span>{c.name} <span className="muted">· {wantLine(data, c)}</span></span><span className="muted">{relDay(c.nextCall)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {nd.length > 0 && (
            <details className="mt-3.5">
              <summary className="cursor-pointer px-0.5 py-2 font-heading text-[var(--crm-ink-2)]">عملاء نشطين بدون موعد اتصال <span className="num">({nd.length})</span></summary>
              <div className="crm-card mt-1.5 overflow-hidden">
                {nd.map((c) => (
                  <div key={c.id} className="flex cursor-pointer justify-between gap-2.5 border-b border-[var(--crm-line)] px-3 py-2.5 last:border-0 hover:bg-[var(--crm-surface-2)]" onClick={() => openModal({ kind: "update", clientId: c.id })}>
                    <span>{c.name}</span><span className="muted">حدد موعد ←</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {seg === "visits" && (
        <>
          {soon.length > 0 && (<><div className="mt-4 mb-2 flex items-baseline gap-2.5"><h2 className="text-[15.5px]">اليوم وبكرة — أكّد مع العميل</h2><span className="num muted">{soon.length}</span></div><div className="grid gap-2.5">{soon.map((c) => visitCard(c, false))}</div></>)}
          {pastV.length > 0 && (<><div className="mt-4 mb-2 flex items-baseline gap-2.5 text-[var(--crm-danger)]"><h2 className="text-[15.5px]">فاتت — وش صار؟</h2><span className="num">{pastV.length}</span></div><div className="grid gap-2.5">{pastV.map((c) => visitCard(c, true))}</div></>)}
          {!soon.length && !pastV.length && <Empty big>ما فيه زيارات اليوم أو بكرة.</Empty>}
        </>
      )}

      {seg === "tasks" && <TasksView />}
    </>
  );
}
