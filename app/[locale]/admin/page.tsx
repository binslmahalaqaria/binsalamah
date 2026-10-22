"use client";

/**
 * «لوحتي» — the CRM home (client spec, 2026-10-22; replaced «اليوم» the same day): greeting and
 * check-in/out, notices (newly assigned / returned / unassigned clients), the daily call target
 * (10), and six sections in the order of the work: calls to new customers, follow-ups on customers
 * with a request, offers awaiting a reply, viewings, negotiations, and tasks (overdue first); then
 * upcoming calls and active clients with no call date. Managers see the team (or one employee via «عرض بيانات»).
 */
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { CALL_TARGET, MISSED, PRIO, REQ_TONE, TEMPS, TO_CONTACT, lbl } from "@/lib/crm/constants";
import {
  activityFor, attToday, calledToday, fmtDur, hoursOf, isActive, lateMin, members, missedStreak, nameOf, noDate, propById, reqsOf,
  upcoming, visibleTasks, wantLine, workClients,
} from "@/lib/crm/logic";
import { applyUpdate, checkIO, markTasksSeen } from "@/lib/crm/actions";
import { fmtDist, locateForAttendance } from "@/lib/crm/geo";
import type { Client, Request, Task } from "@/lib/crm/types";
import { addDays, ageDays, fmtVisit, hm, relDay, today, weekdayLong } from "@/lib/crm/util";
import { ContactIcons, Empty, PageHeader, Pill } from "@/components/crm/ui";
import { TaskRow } from "@/components/crm/TaskRow";
import { TempPill } from "@/components/crm/bits";
import { ProposalRow, ViewingRow } from "@/components/crm/Journey";
import { ContactImport } from "@/components/crm/ContactImport";

const tempRank = (c?: Client | null) => TEMPS.indexOf((c?.temp || "دافئ") as never);
const lastCall = (c: Client) => (c.log || []).find((l) => l.type !== "طلب من الموقع");

function Section({ n, title, count, hint, children, open: open0 = true }: { n: number; title: string; count: number; hint?: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(open0);
  return (
    <section className="crm-card mb-3 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-start" aria-expanded={open}>
        <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--crm-ink)] text-[13px] font-bold text-white">{n}</span>
        <b className="font-heading text-[15.5px]">{title}</b>
        <span className="num rounded-full bg-[var(--crm-surface-2)] px-2.5 text-[13px] font-semibold">{count}</span>
        {hint && <span className="hidden text-[12.5px] text-[var(--crm-ink-3)] md:inline">{hint}</span>}
        <span className="ms-auto text-xs text-[var(--crm-ink-3)]">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="border-t border-[var(--crm-line)]">{count ? children : <Empty>لا يوجد شيء هنا الآن.</Empty>}</div>}
    </section>
  );
}

export default function HomeDashboard() {
  const { data, me, loaded, openClient, openModal, setViewAs, toast, settings } = useCrm();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [adding, setAdding] = useState(false);
  // Opening the home page marks newly given tasks as seen (they are listed below; the sidebar badge clears).
  const unseenTasks = data.tasks.some((x) => x.seen === false && x.assignee === data.uid);
  useEffect(() => {
    if (!loaded || !unseenTasks) return;
    const tm = setTimeout(() => markTasksSeen(data).catch(() => {}), 4000);
    return () => clearTimeout(tm);
  }, [loaded, unseenTasks, data]);
  if (!loaded || !me) return <Empty>جارٍ تحميل البيانات…</Empty>;

  const t = today();
  const team = data.isMgr && (!data.viewAs || data.viewAs === "none");
  const who = data.isMgr && data.viewAs && data.viewAs !== "none" ? data.viewAs : data.uid;
  const mine = workClients(data);
  const open = (c: Client) => reqsOf(data, c);
  const byPrio = (a: Client, b: Client) => tempRank(a) - tempRank(b) || String(a.nextCall || "").localeCompare(String(b.nextCall || ""));

  // 1) New customers to call: no open request yet — due today/overdue, or on the re-contact list and not tried today.
  const newCalls = mine.filter((c) =>
    !open(c).length && ((isActive(c) && c.nextCall && c.nextCall <= t) || (c.status === TO_CONTACT && !calledToday(c)))).sort(byPrio);
  // 2) Follow-ups: customers with a request whose follow-up is due (negotiations have their own section).
  const negSt = ["تفاوض", "عربون"];
  // Each customer in one section only: offers, viewings and negotiations have their own sections below.
  const follow = mine.filter((c) => isActive(c) && c.nextCall && c.nextCall <= t && open(c).length && !c.visitAt &&
    ![...negSt, "أرسلنا خيارات"].includes(open(c)[0].status || "")).sort(byPrio);
  // 3) Offers sent, waiting for the customer's answer.
  const reqsMine = (st: string[]) => mine.flatMap((c) => open(c).filter((r) => st.includes(r.status || "جديد")).map((r) => ({ c, r })));
  // Offers record (proposals) still waiting on the customer; plus older requests sent before the record existed.
  const mineIds = new Set(mine.map((c) => c.id));
  const props = data.proposals.filter((p) => mineIds.has(p.clientId) && ["أُرسل", "بانتظار الرد"].includes(p.status))
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const offers = reqsMine(["أرسلنا خيارات"]).filter((x) => !x.c.visitAt && !data.proposals.some((p) => p.requestId === x.r.id))
    .sort((a, b) => Number(!!b.c.nextCall && b.c.nextCall <= t) - Number(!!a.c.nextCall && a.c.nextCall <= t) || byPrio(a.c, b.c));
  // 4) Viewings record (scheduled/postponed); plus visits booked before the record existed.
  const views = data.viewings.filter((v) => mineIds.has(v.clientId) && ["مجدولة", "مؤجلة"].includes(v.status));
  const viewings = mine.filter((c) => c.visitAt && !views.some((v) => v.clientId === c.id)).sort((a, b) => a.visitAt!.localeCompare(b.visitAt!));
  // 5) Negotiation.
  const neg = reqsMine(negSt);
  // 6) Tasks: overdue first, then today and undated; by priority within.
  const prioRank = (x: Task) => -PRIO.indexOf((x.priority || "عادية") as never);
  const tasks = visibleTasks(data).filter((x) => !x.done && (!x.due || x.due <= t))
    .sort((a, b) => Number(!!b.due && b.due < t) - Number(!!a.due && a.due < t) || prioRank(a) - prioRank(b) || String(a.due || "").localeCompare(String(b.due || "")));
  const overdueTasks = tasks.filter((x) => x.due && x.due < t).length;

  /* ---- attendance (checks the office location first when that rule is on) ---- */
  async function doCheck(kind: "in" | "out") {
    if (locating) return;
    setLocating(true);
    try {
      const r = await locateForAttendance(settings, !!data.staff.find((x) => x.id === data.uid)?.anyLocation);
      if (!r.ok) return toast(r.msg);
      await checkIO(data.uid, kind, r.loc);
      const where = r.loc?.dist != null && settings.geoOn ? " — على بُعد " + fmtDist(r.loc.dist) + " من المكتب" : "";
      toast((kind === "in" ? "تم تسجيل حضورك" : "تم تسجيل انصرافك، شكراً لجهودك") + where);
    } catch {
      toast("تعذّر التسجيل، حاول مجدداً");
    } finally {
      setLocating(false);
    }
  }
  const myAtt = attToday(data, data.uid);
  const lateBy = lateMin(data, myAtt, data.uid);
  const attBar = !myAtt ? (
    <button type="button" className="crm-btn gold" disabled={locating} onClick={() => doCheck("in")}>{locating ? "جارٍ تحديد موقعك…" : "تسجيل حضور"}</button>
  ) : !myAtt.out ? (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-[var(--crm-ink-2)]">حضرت {hm(myAtt.in)} {lateBy > 0 && <Pill tone="warm">متأخر {fmtDur(lateBy)}</Pill>}</span>
      <button type="button" className="crm-btn" disabled={locating} onClick={() => doCheck("out")}>{locating ? "جارٍ تحديد موقعك…" : "تسجيل انصراف"}</button>
    </div>
  ) : (
    <span className="text-[13px] text-[var(--crm-ink-2)]">{hm(myAtt.in)} – {hm(myAtt.out)} · {hoursOf(myAtt).toFixed(1)} س</span>
  );

  /* ---- notices ---- */
  const fresh = data.clients.filter((c) => c.unseen && c.assignee === data.uid && !c.escalatedFrom);
  const escL = data.clients.filter((c) => c.escalatedFrom && c.assignee === data.uid && c.unseen);
  const unassigned = data.isMgr && !data.viewAs ? data.clients.filter((c) => !c.assignee && (c.status || "نشط") === "نشط").length : 0;
  const up = upcoming(data), nd = noDate(data);

  // Daily call target: calls logged today (WhatsApp messages excluded).
  const ids = team ? members(data) : [who];
  const doneBy = (id: string) => activityFor(data, id, t, t).calls;

  async function quick(c: Client, type: string) {
    setBusy(c.id);
    try {
      const nx = type === "رقم خاطئ" ? null : addDays(1);
      await applyUpdate(data, c.id, type, nx, "", null);
      toast(type === "رقم خاطئ" ? "نُقل إلى الأرشيف (رقم خاطئ)" : "سُجّلت المحاولة — الاتصال القادم غداً" + (missedStreak(c) + 1 >= 3 ? " · أُنشئت مهمة رسالة واتساب" : ""));
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(null);
    }
  }

  const reqRow = ({ c, r }: { c: Client; r: Request }, action: ReactNode) => (
    <div key={r.id} className="crm-row grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 cursor-pointer" onClick={() => openClient(c.id, r.id)}>
        <div className="flex flex-wrap items-center gap-1.5"><b className="font-heading">{c.name}</b><TempPill t={c.temp} /><Pill tone={REQ_TONE[r.status || "جديد"]}>{lbl(r.status || "جديد")}</Pill></div>
        <div className="truncate text-[13px] text-[var(--crm-ink-2)]">{wantLine(data, c)}</div>
        <div className="text-xs text-[var(--crm-ink-3)]">
          {r.sent?.length ? "أُرسل له " + r.sent.length + " عرض · " : ""}آخر تحديث {ageDays(r.updatedAt)}
          {c.nextCall && <> · المتابعة: <span className={c.nextCall < t ? "font-semibold text-[var(--crm-danger)]" : c.nextCall === t ? "font-semibold" : ""}>{relDay(c.nextCall)}</span></>}
          {team && r.assignee ? " · " + nameOf(data, r.assignee) : ""}
        </div>
      </div>
      <div className="flex items-center gap-1.5"><ContactIcons phone={c.phone} />{action}</div>
    </div>
  );

  return (
    <>
      <PageHeader title={(new Date().getHours() < 12 ? "☀️ صباح الخير" : "🌙 مساء الخير") + (me.name ? "، " + me.name.trim().split(/\s+/)[0] : "")}
        sub={weekdayLong(new Date()) + " — كل ما عليك اليوم بالترتيب"}
        action={<div className="flex flex-wrap items-center gap-2">{attBar}<button type="button" className={"crm-btn" + (adding ? "" : " primary")} onClick={() => setAdding((v) => !v)}>+ إضافة أرقام</button></div>} />

      {/* New numbers: typed, or from Excel; duplicates are refused; they land in «مكالمات العملاء الجدد» below. */}
      {adding && <ContactImport onClose={() => setAdding(false)} />}

      {fresh.length > 0 && (
        <div className="mb-2 rounded-xl bg-[var(--crm-gold-soft)] px-3.5 py-2.5 text-sm">
          <b>{fresh.length}</b> عميل جديد انسند لك:{" "}
          {fresh.slice(0, 3).map((c, i) => <span key={c.id}>{i > 0 && "، "}<span className="link" onClick={() => openClient(c.id)}>{c.name}</span></span>)}
        </div>
      )}
      {escL.length > 0 && (
        <div className="mb-2 rounded-xl bg-[var(--crm-warn-soft)] px-3.5 py-2.5 text-sm text-[var(--crm-warn)]">
          أُعيد إليك <b>{escL.length}</b> عميل لم يتواصل معهم الموظف المسؤول:{" "}
          {escL.slice(0, 3).map((c, i) => <span key={c.id}>{i > 0 && "، "}<span className="link" onClick={() => openClient(c.id)}>{c.name}</span> (من {nameOf(data, c.escalatedFrom)})</span>)}
        </div>
      )}
      {unassigned > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[var(--crm-warn-soft)] px-3.5 py-2.5 text-sm text-[var(--crm-warn)]">
          <span>يوجد <b>{unassigned}</b> عميل غير مسند لأي موظف.</span>
          <button type="button" className="crm-btn sm" onClick={() => { setViewAs("none"); router.push("/admin/clients"); }}>توزيعهم</button>
        </div>
      )}

      {/* Call target */}
      <div className="crm-card mb-3 grid gap-2.5 px-4 py-3.5">
        {ids.map((id) => {
          const n = doneBy(id), pct = Math.min(100, Math.round((n / CALL_TARGET) * 100));
          return (
            <div key={id} className="grid gap-1.5">
              <div className="flex items-baseline gap-2 text-sm">
                {team && <b className="min-w-[90px]">{nameOf(data, id)}</b>}
                <span><b className="num font-heading text-lg">{n}</b> من <b className="num font-heading text-lg">{CALL_TARGET}</b> مكالمات اليوم</span>
                {n >= CALL_TARGET ? <Pill tone="ok">تم تحقيق الهدف</Pill> : <span className="text-[12.5px] text-[var(--crm-ink-3)]">باقي {CALL_TARGET - n}</span>}
              </div>
              <div className={"crm-bar " + (n >= CALL_TARGET ? "ok" : "")}><i style={{ width: pct + "%" }} /></div>
            </div>
          );
        })}
        <span className="text-[12px] text-[var(--crm-ink-3)]">تُحسب المكالمات المسجّلة فقط (رد، لم يرد، مشغول…)، ولا تُحسب رسائل الواتساب.</span>
      </div>

      <Section n={1} title="مكالمات العملاء الجدد" count={newCalls.length} hint="أرقام جديدة وعملاء بدون طلب بعد — سجّل نتيجة كل مكالمة">
        {newCalls.map((c) => {
          const miss = missedStreak(c), l = lastCall(c);
          return (
            <div key={c.id} className="crm-row grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 cursor-pointer" onClick={() => openClient(c.id)}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <b className="font-heading">{c.name}</b><TempPill t={c.temp} />
                  {c.status === TO_CONTACT && <Pill tone="muted">للتواصل</Pill>}
                  {miss > 0 && <Pill tone={miss >= 3 ? "hot" : "warm"}>لم يرد {miss} {miss === 1 ? "مرة" : "مرات"}</Pill>}
                </div>
                <div className="text-xs text-[var(--crm-ink-3)]">
                  <span className="num">{c.phone}</span> · {c.source || "—"} · سُجّل {ageDays(c.createdAt)}
                  {l ? <> · آخر محاولة: {lbl(l.type)} {ageDays(l.at)}</> : " · لم يُتصل به بعد"}
                  {c.nextCall && <> · الموعد: <span className={c.nextCall < t ? "text-[var(--crm-danger)]" : ""}>{relDay(c.nextCall)}</span></>}
                  {team && c.assignee ? " · " + nameOf(data, c.assignee) : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <ContactIcons phone={c.phone} />
                <button type="button" className="crm-btn sm primary" disabled={busy === c.id} onClick={() => openModal({ kind: "update", clientId: c.id, type: "اتصلت عليه" })}>رد</button>
                {MISSED.map((x) => (
                  <button key={x} type="button" className="crm-btn sm" disabled={busy === c.id} onClick={() => quick(c, x)}>{lbl(x)}</button>
                ))}
                <button type="button" className="crm-btn sm danger" disabled={busy === c.id} onClick={() => quick(c, "رقم خاطئ")}>رقم خاطئ</button>
                <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "request", preset: { clientId: c.id } })}>+ طلب</button>
              </div>
            </div>
          );
        })}
      </Section>

      <Section n={2} title="متابعات مجدولة" count={follow.length} hint="عملاء لهم طلب وحان موعد متابعتهم">
        {follow.map((c) => {
          const r = open(c)[0];
          return reqRow({ c, r }, <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "update", clientId: c.id, reqId: r.id })}>تسجيل المتابعة</button>);
        })}
      </Section>

      <Section n={3} title="عروض بانتظار رد العميل" count={props.length + offers.length} hint="أُرسلت لهم عقارات — سجّل رأيهم: مهتم، غير مناسب، أو حدد معاينة">
        {props.map((p) => <ProposalRow key={p.id} p={p} />)}
        {offers.map((x) => reqRow(x, <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "update", clientId: x.c.id, reqId: x.r.id })}>تسجيل رد العميل</button>))}
      </Section>

      <Section n={4} title="المعاينات المجدولة" count={views.length + viewings.length} hint="أكّد الموعد قبلها، وسجّل النتيجة بعدها">
        {views.map((v) => <ViewingRow key={v.id} v={v} />)}
        {viewings.map((c) => {
          const past = c.visitAt!.slice(0, 10) < t, p = propById(data, c.visitProperty);
          return (
            <div key={c.id} className={"crm-row grid-cols-[minmax(0,1fr)_auto] " + (past ? "late" : "")}>
              <div className="min-w-0 cursor-pointer" onClick={() => openClient(c.id)}>
                <div className="flex flex-wrap items-center gap-1.5"><b className="font-heading">{c.name}</b>
                  {past ? <Pill tone="hot">فات موعدها — سجّل النتيجة</Pill> : c.visitConfirmed ? <Pill tone="ok">مؤكدة</Pill> : <Pill tone="warm">بحاجة إلى تأكيد</Pill>}</div>
                <div className="text-xs text-[var(--crm-ink-3)]">{fmtVisit(c.visitAt)}{p ? " · " + p.title : ""}{team && c.assignee ? " · " + nameOf(data, c.assignee) : ""}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <ContactIcons phone={c.phone} />
                {past && <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "update", clientId: c.id, type: "زار العقار", propertyId: c.visitProperty || undefined })}>تسجيل النتيجة</button>}
              </div>
            </div>
          );
        })}
      </Section>

      <Section n={5} title="عملاء في التفاوض" count={neg.length} hint="العملاء الجادون حتى إتمام البيع">
        {neg.map((x) => reqRow(x, <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "update", clientId: x.c.id, reqId: x.r.id })}>تحديث</button>))}
      </Section>

      <Section n={6} title={"المهام" + (overdueTasks ? " — " + overdueTasks + " متأخرة" : "")} count={tasks.length} hint="المتأخرة أولاً، ثم مهام اليوم">
        {tasks.map((x) => <TaskRow key={x.id} t={x} />)}
      </Section>

      {up.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer px-0.5 py-2 font-heading text-[var(--crm-ink-2)]">مكالمات الأيام القادمة <span className="num">({up.length})</span></summary>
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
        <details className="mt-1">
          <summary className="cursor-pointer px-0.5 py-2 font-heading text-[var(--crm-ink-2)]">عملاء نشطون بدون موعد اتصال <span className="num">({nd.length})</span></summary>
          <div className="crm-card mt-1.5 overflow-hidden">
            {nd.map((c) => (
              <div key={c.id} className="flex cursor-pointer justify-between gap-2.5 border-b border-[var(--crm-line)] px-3 py-2.5 last:border-0 hover:bg-[var(--crm-surface-2)]" onClick={() => openModal({ kind: "update", clientId: c.id })}>
                <span>{c.name}</span><span className="muted">تحديد موعد ←</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="crm-hint mt-2">العملاء الذين لم يردوا على 3 مكالمات تُنشأ لهم مهمة «رسالة واتساب»، وإن لم يردوا خلال 48 ساعة يُنقلون إلى «العملاء ← لا يوجد رد».</p>
    </>
  );
}
