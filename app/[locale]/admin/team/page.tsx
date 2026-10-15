"use client";

/**
 * "الفريق" — performance cards, monthly goals, and (owner only) HR files,
 * attendance, payroll, and CRM settings. Staff accounts and website
 * settings keep their own screens (/admin/staff, /admin/settings), linked
 * from here.
 */
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { GOALK } from "@/lib/crm/constants";
import {
  absentDays, actualsFor, dailyHoursOf, earlyMin, fmtDur, overtimeMin, workDaysOf, fmtK, goalOf, goalVals, hoursOf, hrOf, isMgrId, lateMin, shiftOf, members, nameOf, pace, payFor, planFor, statsFor,
  type Pace,
} from "@/lib/crm/logic";
import { write } from "@/lib/crm/actions";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assertWritable } from "@/lib/crm/preview";
import { fmtDist, getFix, mapLink, officeOf, parsePoint } from "@/lib/crm/geo";
import { dayDiff, exportCsv, fmtInt, fmtStamp, hm, iso, money, monthName, num, nowStamp, today, ym } from "@/lib/crm/util";
import { ContactIcons, Empty, PageHeader, Pill } from "@/components/crm/ui";

const ROLE_AR: Record<string, string> = { admin: "المالك", manager: "مدير مبيعات", sales: "موظف" };

export default function TeamPage() {
  const { data, loaded, me } = useCrm();
  const [tab, setTab] = useState("perf");
  if (!loaded || !me) return <Empty>جارٍ تحميل البيانات…</Empty>;
  const tabs: [string, string][] = data.isAdmin
    ? [["perf", "الأداء"], ["goals", "الأهداف"], ["staff", "الملفات"], ["att", "الحضور"], ["pay", "الرواتب"]]
    : data.isMgr ? [["perf", "الأداء"], ["goals", "الأهداف"]] : [];
  return (
    <>
      <PageHeader eyebrow="الفريق" title="الفريق" sub="الأداء والأهداف والملفات والحضور والرواتب" />
      {tabs.length > 0 && (
        <div className="crm-seg mb-4">
          {tabs.map(([k, l]) => <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      )}
      {tab === "perf" && <Perf />}
      {tab === "goals" && <Goals />}
      {tab === "staff" && <HrFiles />}
      {tab === "att" && <Attendance />}
      {tab === "pay" && <Payroll />}
    </>
  );
}

function Perf() {
  const { data, me, realMe, previewAs, startPreview, setViewAs, openModal, toast } = useCrm();
  const router = useRouter();
  const self = data.staff.find((s) => s.id === data.uid);
  // "الدخول كموظف": managers preview sales staff; the owner may also preview managers.
  const canPreview = (s: { id: string; role: string }) =>
    !previewAs && !!realMe && s.id !== realMe.id && s.role !== "admin" &&
    (realMe.role === "admin" || (realMe.role === "manager" && s.role === "sales"));
  const [nick, setNick] = useState(self?.name || "");
  const [phone, setPhone] = useState(self?.phone || "");
  const ids = members(data);
  return (
    <>
      {data.isMgr && (
        <div className="crm-card mb-3 p-4">
          <h2 className="mb-1.5 text-base">إضافة موظف</h2>
          <p className="m-0 text-sm text-[var(--crm-ink-2)]">
            {data.isAdmin ? <>من صفحة <Link href="/admin/staff" className="font-semibold text-[var(--crm-gold-ink)] underline">حسابات الموظفين</Link> يمكنك إنشاء حساب له (بريد إلكتروني وكلمة مرور مؤقتة) وتحديد دوره. </> : "يتولى المالك إنشاء حسابات الموظفين. "}
            يطّلع الموظف على عملائه فقط، بينما يطّلع مدير المبيعات والمالك على جميع العملاء ويتولّيان إسنادهم.
          </p>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2.5">
        {ids.map((id) => {
          const s = data.staff.find((x) => x.id === id)!;
          const st = data.isMgr ? statsFor(data, id) : null;
          const plan = data.isMgr ? planFor(data, id, hm) : [];
          const pd = plan.filter((x) => x.done).length;
          return (
            <article key={id} className="crm-card grid gap-2.5 p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--crm-surface-2)] font-semibold">{(s.name || "؟").slice(0, 1)}</div>
                <div className="min-w-0">
                  <b>{s.name}{id === data.uid && <span className="muted"> (أنا)</span>}</b>
                  {s.phone && <div className="num muted text-[13px]">{s.phone}</div>}
                  {data.isMgr && <div className="muted text-[12.5px]" dir="ltr">{s.email}</div>}
                </div>
                <span className="ms-auto"><Pill tone={s.role === "sales" ? "accent" : "gold"}>{ROLE_AR[s.role]}</Pill></span>
              </div>
              {st && (
                <>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[[st.active, "عملاء نشطون", false], [st.due, "اتصالات اليوم" + (st.late ? " (" + st.late + " متأخر)" : ""), st.late > 0], [st.tasks, "مهام مفتوحة", st.tlate > 0], [st.deals, "صفقات مفتوحة", false]].map(([v, l, red], i) => (
                      <div key={i} className="rounded-lg bg-[var(--crm-surface-2)] px-0.5 py-1.5">
                        <b className={"num block font-heading text-lg " + (red ? "text-[var(--crm-danger)]" : "")}>{String(v)}</b>
                        <span className="text-[11.5px] text-[var(--crm-ink-3)]">{String(l)}</span>
                      </div>
                    ))}
                  </div>
                  {plan.length > 0 && (
                    <div className="flex items-center justify-between gap-1.5 text-[13px]">
                      <span className="muted">روتين اليوم: <b className={"num " + (pd === plan.length ? "text-[var(--crm-ok)]" : "text-[var(--crm-ink)]")}>{pd} من {plan.length}</b></span>
                      <span className="crm-bar ok max-w-40 flex-1"><i style={{ width: Math.round((pd / plan.length) * 100) + "%" }} /></span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[13px]">
                    <span className="muted">سعي محصّل: <b className="text-[var(--crm-gold-ink)]">{money(st.closed)}</b></span>
                    {s.lastSeen && <span className="muted">آخر دخول: {fmtStamp(s.lastSeen)}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" className="crm-btn sm" onClick={() => { setViewAs(id); router.push("/admin"); }}>عرض أعماله</button>
                    {s && canPreview(s) && (
                      <button type="button" className="crm-btn sm" title="تصفح النظام كما يراه هذا الموظف (للاطلاع فقط)"
                        onClick={() => { startPreview(id); router.push("/admin"); }}>الدخول كموظف</button>
                    )}
                    <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "task", preset: { assignee: id } })}>+ مهمة له</button>
                    <ContactIcons phone={s.phone} />
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
      {me && (
        <div className="crm-card mt-3 p-4">
          <h2 className="mb-2 text-base">ملفي</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="crm-field"><label htmlFor="pf-nick">الاسم الظاهر للفريق</label><input id="pf-nick" value={nick} onChange={(e) => setNick(e.target.value)} /></div>
            <div className="crm-field"><label htmlFor="pf-phone">جوالي</label><input id="pf-phone" dir="ltr" value={phone} placeholder="05xxxxxxxx" onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <button type="button" className="crm-btn primary mt-2.5" onClick={async () => {
            if (!nick.trim()) return toast("اكتب اسمك");
            await write("staff", data.uid, { name: nick.trim(), phone: phone.trim() || null }, "update");
            toast("تم حفظ ملفك");
          }}>حفظ</button>
        </div>
      )}
    </>
  );
}

function Goals() {
  const { data, openModal, setViewAs } = useCrm();
  const router = useRouter();
  const months = [-2, -1, 0].map((o) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + o); return iso(d).slice(0, 7); });
  const [month, setMonth] = useState(ym());
  const ids = members(data);
  const rank: Record<Pace, number> = { ok: 0, warn: 1, bad: 2 };
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {months.map((m) => <button key={m} type="button" className={"crm-btn " + (m === month ? "primary" : "")} onClick={() => setMonth(m)}>{monthName(m)}</button>)}
        <span className="flex-1" />
        {data.isMgr && <button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "goal", uid: ids.find((id) => !isMgrId(data, id)) || ids[0], month })}>تحديد الأهداف</button>}
      </div>
      <div className="crm-card overflow-x-auto px-2 py-1.5">
        <table className="crm-table min-w-[820px]">
          <thead><tr><th>الموظف</th>{GOALK.map((x) => <th key={x[0]}>{x[2]}</th>)}<th>الوضع</th>{data.isMgr && <th />}</tr></thead>
          <tbody>
            {ids.map((id) => {
              const g = goalOf(data, id, month);
              const v = goalVals(actualsFor(data, id, month));
              let worst: Pace | null = null;
              const cells = GOALK.map(([k]) => {
                const target = g ? num(g[k]) : null;
                const val = v[k];
                if (!target) return <td key={k}><div className="grid gap-1 text-[13px]"><b className="num">{fmtK(k, val)}</b><span className="muted text-[11.5px]">بدون هدف</span></div></td>;
                const st: Pace = k === "calls" ? (val >= target * 0.9 ? "ok" : val >= target * 0.6 ? "warn" : "bad") : pace(val, target, month) || "ok";
                if (worst == null || rank[st] > rank[worst]) worst = st;
                return (
                  <td key={k}><div className="grid min-w-[92px] gap-1 text-[13px]"><span><b className="num">{fmtK(k, val)}</b> / {fmtK(k, target)}</span>
                    <div className={"crm-bar h-1.5 " + st}><i style={{ width: Math.min(100, Math.round((val / target) * 100)) + "%" }} /></div></div></td>
                );
              });
              const w = worst as Pace | null;
              return (
                <tr key={id}>
                  <td><b className="link" onClick={() => { setViewAs(id); router.push("/admin"); }}>{nameOf(data, id)}</b>{isMgrId(data, id) && <span className="muted text-xs"> مدير</span>}{g?.note && <div className="muted text-xs">{g.note}</div>}</td>
                  {cells}
                  <td>{!g ? <Pill tone="muted">لم تُحدَّد له أهداف</Pill> : w === "bad" ? <Pill tone="hot">متأخر</Pill> : w === "warn" ? <Pill tone="warm">يحتاج إلى متابعة</Pill> : <Pill tone="ok">على المسار الصحيح</Pill>}</td>
                  {data.isMgr && <td><button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "goal", uid: id, month })}>{g ? "تعديل" : "حدد"}</button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="crm-hint mt-2.5">تُحتسب الأرقام تلقائياً من أعمال الموظف: المكالمات من التحديثات التي يسجّلها، والزيارات من «زار العقار»، والعربون والبيع والسعي من قسم الطلبات. وتعني «على المسار الصحيح» أنه بلغ النسبة المتوقعة وفق الأيام المنقضية من الشهر. اضغط على اسم الموظف لعرض أعماله.</p>
    </>
  );
}

function HrFiles() {
  const { data, openModal } = useCrm();
  const [now] = useState(() => Date.now());
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2.5">
        {members(data).map((id) => {
          const x = hrOf(data, id);
          const has = data.hr.some((h) => h.id === id);
          const end = x.contractEnd ? dayDiff(x.contractEnd) : null;
          const total = (num(x.salary) || 0) + (num(x.housing) || 0) + (num(x.transport) || 0) + (num(x.otherAllow) || 0);
          const tenure = x.hireDate ? Math.max(0, Math.floor((now - new Date(x.hireDate).getTime()) / (864e5 * 30.44))) : null;
          return (
            <article key={id} className="crm-card grid gap-2.5 p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--crm-surface-2)] font-semibold">{nameOf(data, id).slice(0, 1)}</div>
                <div><b>{nameOf(data, id)}</b><div className="muted text-[13px]">{x.jobTitle || "بدون مسمى"}{x.contractType ? " · " + x.contractType : ""}</div></div>
                <button type="button" className="crm-btn sm ms-auto" onClick={() => openModal({ kind: "hr", uid: id })}>{has ? "تعديل الملف" : "إنشاء ملف"}</button>
              </div>
              {has ? (
                <>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[[total ? money(total) : "—", "الراتب الشامل"], [x.commissionPct != null ? x.commissionPct + "%" : "—", "عمولة من السعي"], [tenure != null ? (tenure >= 12 ? Math.floor(tenure / 12) + " سنة" : tenure + " شهر") : "—", "مدة الخدمة"], [String((x.docs || []).length), "مستندات"]].map(([v, l]) => (
                      <div key={l} className="rounded-lg bg-[var(--crm-surface-2)] px-0.5 py-1.5"><b className="num block font-heading text-[15px]">{v}</b><span className="text-[11.5px] text-[var(--crm-ink-3)]">{l}</span></div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[13px]">
                    {x.hireDate && <span className="muted">المباشرة: {x.hireDate}</span>}
                    {x.contractEnd && (end != null && end <= 30 ? <Pill tone="hot">نهاية العقد: {x.contractEnd}{end < 0 ? " (منتهي)" : " (باقي " + end + " يوم)"}</Pill> : <span className="muted">نهاية العقد: {x.contractEnd}</span>)}
                    <span className="muted">الدوام: {x.workStart || "09:00"} – {x.workEnd || "17:00"}</span>
                  </div>
                </>
              ) : <p className="crm-hint m-0">لا يوجد ملف موارد بشرية لهذا الموظف.</p>}
            </article>
          );
        })}
      </div>
      <p className="crm-hint mt-2.5">ملفات الموظفين والرواتب والحضور متاحة للمالك فقط، ويطّلع كل موظف على حضوره.</p>
    </>
  );
}

function Attendance() {
  const { data, openModal } = useCrm();
  const [month, setMonth] = useState(ym());
  const [open, setOpen] = useState<string | null>(null);
  const ids = members(data);
  const t = today();
  return (
    <>
      <OfficeLocation />
      <ShiftTimes />
      <div className="mb-3 flex items-center gap-2"><label className="muted" htmlFor="attM">الشهر:</label><input id="attM" type="month" value={month} onChange={(e) => setMonth(e.target.value || ym())} /></div>
      <div className="crm-card mb-2.5 flex flex-wrap gap-1.5 p-3.5">
        <b className="me-1">اليوم:</b>
        {ids.map((id) => {
          const r = (data.att[id] || []).find((x) => x.id === t);
          const lm = lateMin(data, r, id), em = earlyMin(data, r, id);
          return (
            <span key={id} className={"crm-chip " + (r ? "" : "warn")}>
              {nameOf(data, id)}: {r ? hm(r.in) + (r.out ? " – " + hm(r.out) : "") + (lm ? " (متأخر " + fmtDur(lm) + ")" : "") + (em ? " (خرج مبكراً " + fmtDur(em) + ")" : "") : "ما حضر"}
            </span>
          );
        })}
      </div>
      <div className="crm-card overflow-x-auto p-1.5">
        <table className="crm-table min-w-[860px]">
          <thead><tr><th>الموظف</th><th>الدوام</th><th>أيام الحضور</th><th>مرات التأخير</th><th>مجموع التأخير</th><th>انصراف مبكر</th><th>ساعات العمل</th><th>الفائض</th><th>غياب</th><th>بدون انصراف</th><th /></tr></thead>
          <tbody>
            {ids.flatMap((id) => {
              const rs = (data.att[id] || []).filter((x) => x.id.slice(0, 7) === month);
              const late = rs.map((r) => lateMin(data, r, id)).filter(Boolean);
              const early = rs.map((r) => earlyMin(data, r, id)).filter(Boolean);
              const extra = rs.reduce((m, r) => m + overtimeMin(data, r, id), 0);
              const [y, mo] = month.split("-").map(Number);
              const absent = absentDays(data, id, month + "-01", month + "-" + String(new Date(y, mo, 0).getDate()).padStart(2, "0"));
              const sh = shiftOf(data, id);
              const rows = [
                <tr key={id}>
                  <td><b>{nameOf(data, id)}</b></td>
                  <td className="num text-[12.5px]">{sh.start} – {sh.end}<div className="muted text-[11px]">{dailyHoursOf(data, id)} س × {workDaysOf(data, id).length} أيام</div></td>
                  <td className="num">{rs.length}</td>
                  <td className="num">{late.length}</td>
                  <td className={"num " + (late.length ? "text-[var(--crm-warn)]" : "")}>{late.length ? fmtDur(late.reduce((a, b) => a + b, 0)) : "—"}</td>
                  <td className="num">{early.length ? early.length + " مرة · " + fmtDur(early.reduce((a, b) => a + b, 0)) : "—"}</td>
                  <td className="num">{fmtDur(Math.round(rs.reduce((a, r) => a + hoursOf(r), 0) * 60))}</td>
                  <td className={"num " + (extra ? "font-semibold text-[var(--crm-ok)]" : "")}>{extra ? fmtDur(extra) : "—"}</td>
                  <td className={"num " + (absent ? "text-[var(--crm-danger)]" : "")}>{absent || "—"}</td>
                  <td className="num">{rs.filter((r) => r.in && !r.out).length}</td>
                  <td><button type="button" className="crm-btn ghost sm" onClick={() => setOpen(open === id ? null : id)}>التفاصيل</button></td>
                </tr>,
              ];
              if (open === id)
                rows.push(
                  <tr key={id + "-d"}><td colSpan={11}>
                    <div className="grid gap-1 rounded-lg bg-[var(--crm-surface-2)] p-2">
                      {rs.length ? rs.sort((a, b) => b.id.localeCompare(a.id)).map((r) => {
                        const lm = lateMin(data, r, id), em = earlyMin(data, r, id), om = overtimeMin(data, r, id);
                        return (
                          <div key={r.id} className="grid grid-cols-[100px_1fr_1fr_80px_auto_auto_auto] items-center gap-2 text-[13px]">
                            <span className="num">{r.id}</span>
                            <span>حضور {hm(r.in)}{r.inLoc && <a className="link ms-1 text-[11.5px]" href={mapLink(r.inLoc)} target="_blank" rel="noopener">📍{r.inLoc.dist != null ? fmtDist(r.inLoc.dist) : "الموقع"}</a>}</span>
                            <span>انصراف {hm(r.out)}{r.outLoc && <a className="link ms-1 text-[11.5px]" href={mapLink(r.outLoc)} target="_blank" rel="noopener">📍{r.outLoc.dist != null ? fmtDist(r.outLoc.dist) : "الموقع"}</a>}</span><span>{fmtDur(Math.round(hoursOf(r) * 60))}</span>
                            {lm ? <Pill tone="warm">متأخر {fmtDur(lm)}</Pill> : <span />}
                            {em ? <Pill tone="muted">خرج مبكراً {fmtDur(em)}</Pill> : om ? <Pill tone="ok">فائض {fmtDur(om)}</Pill> : <span />}
                            <button type="button" className="crm-btn ghost sm" onClick={() => openModal({ kind: "attEdit", uid: id, date: r.id })}>تعديل</button>
                          </div>
                        );
                      }) : <span className="crm-hint">لا توجد سجلات لهذا الشهر.</span>}
                      <button type="button" className="crm-btn sm justify-self-start" onClick={() => openModal({ kind: "attEdit", uid: id, date: "" })}>+ إضافة يوم</button>
                    </div>
                  </td></tr>
                );
              return rows;
            })}
          </tbody>
        </table>
      </div>
      <p className="crm-hint mt-2.5">التأخير يُحسب من بداية دوام كل موظف بعد سماح 15 دقيقة، والانصراف المبكر من نهاية الدوام — في أيام الدوام فقط. الفائض: ما زاد على ساعات العمل المطلوبة، وكل العمل في أيام الإجازة. الغياب: أيام دوام مضت بلا تسجيل حضور.</p>
    </>
  );
}

/** "موقع الدوام": the office point and allowed radius for check-in/out, and whether the rule is enforced (owner). */
function OfficeLocation() {
  const { data, settings, toast } = useCrm();
  const office = officeOf(settings);
  const [txt, setTxt] = useState("");
  const [radius, setRadius] = useState(String(settings.officeRadius || 200));
  const [busy, setBusy] = useState(false);
  if (!data.isAdmin) return null;
  async function save(patch: Record<string, unknown>, msg: string) {
    assertWritable();
    setBusy(true);
    try {
      await setDoc(doc(db, "crm", "settings"), patch, { merge: true });
      toast(msg);
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }
  async function here() {
    setBusy(true);
    try {
      const f = await getFix();
      setBusy(false);
      await save({ officeLat: f.lat, officeLng: f.lng }, "تم تحديد موقع المكتب من موقعك الحالي (دقة ±" + f.acc + " م)");
    } catch {
      setBusy(false);
      toast("تعذّر تحديد موقعك — اسمح للمتصفح بالوصول إلى الموقع");
    }
  }
  return (
    <div className="crm-card mb-3 grid gap-2.5 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <b className="flex-1 text-[14.5px]">موقع الدوام</b>
        <label className="flex items-center gap-1.5 text-[13.5px]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={!!settings.geoOn} disabled={busy || !office}
            onChange={(e) => save({ geoOn: e.target.checked }, e.target.checked ? "تم تفعيل التحقق من الموقع" : "تم إيقاف التحقق من الموقع")} />
          التسجيل من موقع العمل فقط
        </label>
      </div>
      <p className="crm-hint m-0">عند التفعيل لا يُقبل تسجيل الحضور أو الانصراف إلا داخل النطاق المحدد حول المكتب (من جوال الموظف أو جهازه). يُحفظ موقع كل تسجيل وبُعده عن المكتب. يمكن استثناء موظف من «مواعيد الدوام» (للعمل الميداني).</p>
      <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
        {office ? (
          <span>المكتب: <a className="link num" href={mapLink(office)} target="_blank" rel="noopener" dir="ltr">{office.lat.toFixed(5)}, {office.lng.toFixed(5)}</a></span>
        ) : <span className="text-[var(--crm-warn)]">لم يُحدَّد موقع المكتب بعد</span>}
        <button type="button" className="crm-btn sm primary" disabled={busy} onClick={here}>📍 موقعي الحالي هو المكتب</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="min-w-[220px] flex-1" dir="ltr" placeholder="أو الصق رابط خرائط قوقل / الإحداثيات: 24.71, 46.67" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button type="button" className="crm-btn sm" disabled={busy || !txt.trim()} onClick={() => {
          const pt = parsePoint(txt);
          if (!pt) return toast("لم أتعرّف على الإحداثيات — الصق رابطاً فيه الإحداثيات أو اكتبها مثل 24.71, 46.67");
          save({ officeLat: pt.lat, officeLng: pt.lng }, "تم حفظ موقع المكتب").then(() => setTxt(""));
        }}>حفظ الموقع</button>
        <label className="flex items-center gap-1 text-[13px] text-[var(--crm-ink-3)]">النطاق المسموح
          <select className="!w-auto" value={radius} onChange={(e) => { setRadius(e.target.value); save({ officeRadius: Number(e.target.value) }, "النطاق: " + e.target.value + " م"); }}>
            {["100", "150", "200", "300", "500", "1000"].map((r) => <option key={r} value={r}>{r} م</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

/** "مواعيد الدوام": the owner sets each employee's shift, working days and required daily hours (stored on their HR file). */
const WEEK: [number, string][] = [[0, "أحد"], [1, "إثنين"], [2, "ثلاثاء"], [3, "أربعاء"], [4, "خميس"], [5, "جمعة"], [6, "سبت"]];
function ShiftTimes() {
  const { data, toast } = useCrm();
  const ids = members(data);
  type V = { start: string; end: string; days: number[]; hours: string };
  const [edit, setEdit] = useState<Record<string, V>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const val = (id: string): V => edit[id] || { ...shiftOf(data, id), days: workDaysOf(data, id), hours: String(hrOf(data, id).dailyHours || "") };
  const change = (id: string, p: Partial<V>) => setEdit((x) => ({ ...x, [id]: { ...val(id), ...p } }));
  async function save(id: string) {
    assertWritable();
    const v = val(id);
    if (!v.start || !v.end || v.end <= v.start) return toast("وقت نهاية الدوام يجب أن يكون بعد بدايته");
    if (!v.days.length) return toast("اختر يوم دوام واحداً على الأقل");
    const h = num(v.hours);
    if (v.hours && (!h || h <= 0 || h > 16)) return toast("عدد ساعات العمل غير صحيح");
    setBusy(id);
    try {
      await setDoc(doc(db, "hr", id), { workStart: v.start, workEnd: v.end, workDays: [...v.days].sort(), dailyHours: h || null }, { merge: true });
      setEdit((e) => { const n = { ...e }; delete n[id]; return n; });
      toast("تم حفظ دوام " + nameOf(data, id));
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="crm-card mb-3 grid gap-2 p-3.5">
      <b className="text-[14.5px]">مواعيد الدوام</b>
      <p className="crm-hint m-0">لكل موظف: وقت الدوام، أيام الدوام، وعدد ساعات العمل المطلوبة يومياً (إن تُرك فارغاً تُحسب من وقت الدوام). ما يزيد على الساعات المطلوبة يُحسب فائضاً، والعمل في يوم الإجازة كله فائض.</p>
      <div className="grid gap-2 lg:grid-cols-2">
        {ids.map((id) => {
          const v = val(id), dirty = !!edit[id];
          const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
          const autoH = Math.max(0, Math.round(((toMin(v.end) - toMin(v.start)) / 60) * 10) / 10); // shown as the default when no hours are typed
          return (
            <div key={id} className="grid gap-2 rounded-lg border border-[var(--crm-line)] px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <b className="min-w-[90px] flex-1 text-[13.5px]">{nameOf(data, id)}</b>
                <label className="flex items-center gap-1 text-[12.5px] text-[var(--crm-ink-3)]">من
                  <input type="time" className="!w-auto" value={v.start} onChange={(e) => change(id, { start: e.target.value })} />
                </label>
                <label className="flex items-center gap-1 text-[12.5px] text-[var(--crm-ink-3)]">إلى
                  <input type="time" className="!w-auto" value={v.end} onChange={(e) => change(id, { end: e.target.value })} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {WEEK.map(([n, l]) => {
                  const on = v.days.includes(n);
                  return (
                    <button key={n} type="button" className={"crm-qchip !px-2 !py-0.5 !text-[12px]" + (on ? " on" : "")}
                      onClick={() => change(id, { days: on ? v.days.filter((x) => x !== n) : [...v.days, n] })}>{l}</button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--crm-ink-3)]">
                <label className="flex items-center gap-1">ساعات العمل يومياً
                  <input className="!w-16 num" inputMode="decimal" placeholder={String(autoH)} value={v.hours} onChange={(e) => change(id, { hours: e.target.value.replace(/[^\d.]/g, "") })} />
                </label>
                <span>· {v.days.length} أيام أسبوعياً</span>
                <label className="flex items-center gap-1">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--crm-gold)]" checked={!!data.staff.find((x) => x.id === id)?.anyLocation}
                    onChange={async (e) => { try { await write("staff", id, { anyLocation: e.target.checked }, "update"); toast(e.target.checked ? nameOf(data, id) + ": يسجّل من أي مكان" : nameOf(data, id) + ": من موقع العمل فقط"); } catch { toast("تعذّر الحفظ"); } }} />
                  من أي مكان
                </label>
                {dirty && <button type="button" className="crm-btn primary sm ms-auto" disabled={busy === id} onClick={() => save(id)}>حفظ</button>}
              </div>
            </div>
          );
        })}
        {!ids.length && <span className="crm-hint">لا يوجد موظفون.</span>}
      </div>
    </div>
  );
}

function Payroll() {
  const { data, toast } = useCrm();
  const [month, setMonth] = useState(ym());
  const ids = members(data);
  const tot = ids.reduce((a, id) => a + payFor(data, id, month).net, 0);
  const savePay = async (id: string, field: string, value: unknown) => {
    const k = month + "_" + id;
    const cur = data.payroll.find((x) => x.id === k) || {};
    const body = { ...cur, [field]: field === "note" || field === "paid" ? value : num(value), month, member: id, updatedAt: nowStamp() } as Record<string, unknown>;
    delete body.id;
    await write("payroll", k, body);
    toast("تم الحفظ");
  };
  const exportPay = () =>
    exportCsv("رواتب " + month, ids.map((id) => {
      const p = payFor(data, id, month), x = hrOf(data, id);
      return {
        "الموظف": nameOf(data, id), "المسمى": x.jobTitle || "", "الآيبان": x.iban || "", "الأساسي": p.basic, "البدلات": p.allow, "مبيعات": p.deals,
        "السعي المحصّل": Math.round(p.sa3y), "نسبة العمولة %": p.cpct, "العمولة": p.commission, "مكافأة": p.bonus, "خصم": p.deduction,
        "الصافي": p.net, "ملاحظة": p.note, "صُرف": p.paid ? "نعم" : "لا",
      };
    }));
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="muted" htmlFor="payM">الشهر:</label><input id="payM" type="month" value={month} onChange={(e) => setMonth(e.target.value || ym())} />
        <span className="flex-1" />
        <button type="button" className="crm-btn" onClick={exportPay}>تصدير Excel</button>
      </div>
      <div className="crm-card overflow-x-auto p-1.5">
        <table className="crm-table min-w-[760px]">
          <thead><tr><th>الموظف</th><th>الأساسي</th><th>البدلات</th><th>العمولة</th><th>مكافأة</th><th>خصم</th><th>الصافي</th><th>ملاحظة</th><th>صُرف</th></tr></thead>
          <tbody>
            {ids.map((id) => {
              const p = payFor(data, id, month);
              return (
                <tr key={id + month}>
                  <td><b>{nameOf(data, id)}</b></td>
                  <td className="num">{fmtInt(p.basic)}</td>
                  <td className="num">{fmtInt(p.allow)}</td>
                  <td className="num">{fmtInt(p.commission)}{p.deals > 0 && <div className="crm-hint">{p.deals} صفقة × {p.cpct}%</div>}</td>
                  <td><input inputMode="decimal" className="min-w-[70px]" defaultValue={p.bonus || ""} placeholder="0" onBlur={(e) => e.target.value !== String(p.bonus || "") && savePay(id, "bonus", e.target.value)} /></td>
                  <td><input inputMode="decimal" className="min-w-[70px]" defaultValue={p.deduction || ""} placeholder="0" onBlur={(e) => e.target.value !== String(p.deduction || "") && savePay(id, "deduction", e.target.value)} /></td>
                  <td className="num"><b>{fmtInt(p.net)}</b></td>
                  <td><input defaultValue={p.note} placeholder="—" onBlur={(e) => e.target.value !== p.note && savePay(id, "note", e.target.value)} /></td>
                  <td><input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={p.paid} aria-label="تم الصرف" onChange={(e) => savePay(id, "paid", e.target.checked)} /></td>
                </tr>
              );
            })}
            <tr className="font-semibold"><td>الإجمالي</td><td colSpan={5} /><td className="num"><b>{fmtInt(tot)} ر.س</b></td><td colSpan={2} /></tr>
          </tbody>
        </table>
      </div>
      <p className="crm-hint mt-2.5">العمولة = مجموع سعي طلبات الموظف التي أصبحت &quot;تم البيع&quot; هذا الشهر × نسبة عمولته في ملفه. تُحفظ المكافأة والخصم والملاحظة عند الخروج من الحقل.</p>
    </>
  );
}
