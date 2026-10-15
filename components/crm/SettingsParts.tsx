"use client";

/**
 * Sections of the CRM "الإعدادات" page: editable option lists (property
 * types, client sources), round-robin assignment of new requests, per-employee
 * permissions, and overdue-client escalation. Lists and round-robin live in
 * `crm/lists`; escalation in `crm/settings`; permissions on each `staff` doc.
 */
import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { useRouter } from "@/i18n/navigation";
import { PTYPES, SOURCES } from "@/lib/crm/constants";
import { members, nameOf, PERM_DEFAULT, PERMS, typesOf, type PermKey } from "@/lib/crm/logic";
import { write } from "@/lib/crm/actions";
import { assertWritable } from "@/lib/crm/preview";
import { nowStamp } from "@/lib/crm/util";
import { Icon } from "./ui";

const saveLists = (body: object) => (assertWritable(), setDoc(doc(db, "crm", "lists"), { ...body, updatedAt: nowStamp() }, { merge: true }));
const NO_RULE = "تعذّر الحفظ — هذه الصلاحية تحتاج تحديث قواعد قاعدة البيانات";

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="crm-card grid content-start gap-3 p-4">
      <div>
        <h2 className="text-[15.5px]">{title}</h2>
        {hint && <p className="crm-hint m-0 mt-1">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/* ---------- editable lists ---------- */
export function ListEditor({ field }: { field: "propTypes" | "sources" }) {
  const { data, toast } = useCrm();
  const cfg = field === "propTypes"
    ? { title: "أنواع العقارات", defaults: [...PTYPES], placeholder: "نوع جديد، مثال: مزرعة",
        hint: "تظهر في نماذج الطلبات والعقارات وفي الفلاتر. حذف نوع لا يغيّر الطلبات أو العقارات المسجّلة به مسبقاً.",
        used: (t: string) => data.props.filter((p) => p.type === t || (p.units || []).some((u) => u?.type === t)).length + data.requests.filter((r) => typesOf(r).includes(t)).length }
    : { title: "مصادر العملاء", defaults: [...SOURCES], placeholder: "مصدر جديد، مثال: إنستقرام",
        hint: "تظهر في نموذج العميل والطلب. حذف مصدر لا يغيّر العملاء المسجّلين به مسبقاً.",
        used: (t: string) => data.clients.filter((c) => c.source === t).length + data.requests.filter((r) => r.source === t).length };
  const saved = data[field];
  const [list, setList] = useState<string[]>(saved);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = list.join("|") !== saved.join("|");

  function add() {
    const t = name.trim();
    if (!t) return;
    if (list.includes(t)) return toast("هذه القيمة موجودة مسبقاً");
    setList([...list, t]);
    setName("");
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const xs = [...list];
    [xs[i], xs[j]] = [xs[j], xs[i]];
    setList(xs);
  };
  async function save() {
    if (!list.length) return toast("يجب أن تحتوي القائمة على قيمة واحدة على الأقل");
    setBusy(true);
    try {
      await saveLists({ [field]: list, by: data.uid });
      toast("تم حفظ " + cfg.title);
    } catch {
      toast(NO_RULE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={cfg.title} hint={cfg.hint}>
      <ul className="grid gap-1.5">
        {list.map((t, i) => {
          const n = cfg.used(t);
          return (
            <li key={t} className="flex items-center gap-2 rounded-lg border border-[var(--crm-line)] px-3 py-1.5 text-sm">
              <b className="flex-1">{t}</b>
              {n > 0 && <span className="muted text-xs">مستخدم في <span className="num">{n}</span></span>}
              <button type="button" className="crm-btn ghost sm icon" title="للأعلى" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
              <button type="button" className="crm-btn ghost sm icon" title="للأسفل" disabled={i === list.length - 1} onClick={() => move(i, 1)}>▼</button>
              <button type="button" className="crm-btn ghost sm icon" title="حذف" aria-label={"حذف " + t} onClick={() => setList(list.filter((x) => x !== t))}>
                <Icon k="close" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input className="crm-input min-w-[160px] flex-1" placeholder={cfg.placeholder} value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button type="button" className="crm-btn" onClick={add}>إضافة</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--crm-line)] pt-3">
        <button type="button" className="crm-btn primary" disabled={busy || !dirty} onClick={save}>حفظ التغييرات</button>
        {dirty && <button type="button" className="crm-btn ghost" onClick={() => setList(saved)}>تراجع</button>}
        <button type="button" className="crm-btn ghost ms-auto" onClick={() => setList(cfg.defaults)}>استعادة القائمة الافتراضية</button>
      </div>
    </Card>
  );
}

/* ---------- round-robin ---------- */
export function AutoAssign() {
  const { data, toast } = useCrm();
  const all = members(data);
  const [on, setOn] = useState(data.rr.on);
  const [order, setOrder] = useState<string[]>(data.rr.order.filter((id) => all.includes(id)));
  const [busy, setBusy] = useState(false);
  const dirty = on !== data.rr.on || order.join("|") !== data.rr.order.filter((id) => all.includes(id)).join("|");
  const upNext = order.length ? order[((data.rr.last ? order.indexOf(data.rr.last) : -1) + 1) % order.length] : null;

  const toggle = (id: string) => setOrder(order.includes(id) ? order.filter((x) => x !== id) : [...order, id]);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const xs = [...order];
    [xs[i], xs[j]] = [xs[j], xs[i]];
    setOrder(xs);
  };
  async function save() {
    if (on && !order.length) return toast("اختر موظفاً واحداً على الأقل للتوزيع");
    setBusy(true);
    try {
      await saveLists({ rr: { on, order, last: order.includes(data.rr.last || "") ? data.rr.last : null }, by: data.uid });
      toast(on ? "تم تفعيل التوزيع التلقائي" : "تم إيقاف التوزيع التلقائي");
    } catch {
      toast(NO_RULE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="التوزيع التلقائي للطلبات"
      hint="عند إضافة المدير أو المالك طلباً جديداً، يُسند تلقائياً إلى الموظف التالي في الدور: الأول ثم الثاني وهكذا، ثم يعود إلى الأول. يمكن دائماً اختيار موظف آخر يدوياً في نموذج الطلب.">
      <label className="crm-check justify-self-start"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /><span>تفعيل التوزيع التلقائي</span></label>
      <div className="grid gap-1.5">
        <span className="text-[13px] text-[var(--crm-ink-2)]">ترتيب الدور:</span>
        {order.length === 0 && <span className="muted text-sm">لم يُختر أي موظف بعد.</span>}
        {order.map((id, i) => (
          <div key={id} className="flex items-center gap-2 rounded-lg border border-[var(--crm-line)] px-3 py-1.5 text-sm">
            <span className="num grid h-6 w-6 place-items-center rounded-full bg-[var(--crm-surface-2)] text-xs font-bold">{i + 1}</span>
            <b className="flex-1">{nameOf(data, id)}</b>
            {on && id === upNext && <span className="crm-pill tone-gold">التالي</span>}
            <button type="button" className="crm-btn ghost sm icon" title="للأعلى" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
            <button type="button" className="crm-btn ghost sm icon" title="للأسفل" disabled={i === order.length - 1} onClick={() => move(i, 1)}>▼</button>
            <button type="button" className="crm-btn ghost sm icon" title="إزالة من الدور" onClick={() => toggle(id)}><Icon k="close" size={16} /></button>
          </div>
        ))}
      </div>
      {all.some((id) => !order.includes(id)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] text-[var(--crm-ink-2)]">إضافة إلى الدور:</span>
          {all.filter((id) => !order.includes(id)).map((id) => (
            <button key={id} type="button" className="crm-btn sm" onClick={() => toggle(id)}>+ {nameOf(data, id)}</button>
          ))}
        </div>
      )}
      <div className="border-t border-[var(--crm-line)] pt-3">
        <button type="button" className="crm-btn primary" disabled={busy || !dirty} onClick={save}>حفظ</button>
      </div>
    </Card>
  );
}

/* ---------- permissions ---------- */
export function PermsEditor() {
  const { data, toast, realMe, startPreview } = useCrm();
  const router = useRouter();
  const staff = data.staff.filter((s) => s.active).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  const value = (id: string, k: PermKey) => {
    const s = data.staff.find((x) => x.id === id);
    return s?.perms?.[k] ?? PERM_DEFAULT[k];
  };
  async function set(id: string, k: PermKey, v: boolean) {
    const s = data.staff.find((x) => x.id === id);
    try {
      await write("staff", id, { perms: { ...(s?.perms || {}), [k]: v } }, "update");
      toast("تم تحديث صلاحيات " + nameOf(data, id));
    } catch {
      toast("تعذّر الحفظ، يرجى المحاولة مجدداً");
    }
  }
  return (
    <Card title="صلاحيات الموظفين"
      hint="تُطبَّق على موظفي المبيعات. المالك ومدير المبيعات يملكان جميع الصلاحيات. التغيير يُحفظ مباشرة ويظهر عند الموظف فوراً.">
      <div className="overflow-x-auto">
        <table className="crm-table min-w-[720px]">
          <thead>
            <tr>
              <th>الموظف</th>
              {PERMS.map(([k, l, h]) => <th key={k} title={h}>{l}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const full = s.role === "admin" || s.role === "manager";
              return (
                <tr key={s.id}>
                  <td><b>{s.name}</b><div className="muted text-[11.5px]">{s.role === "admin" ? "المالك" : s.role === "manager" ? "مدير مبيعات" : "موظف مبيعات"}</div></td>
                  {PERMS.map(([k]) => (
                    <td key={k} className="text-center">
                      {full ? <span className="muted text-xs">كاملة</span> : (
                        <input type="checkbox" aria-label={k} className="h-4 w-4 cursor-pointer accent-[var(--crm-gold)]"
                          checked={value(s.id, k)} onChange={(e) => set(s.id, k, e.target.checked)} />
                      )}
                    </td>
                  ))}
                  <td>
                    {s.id !== realMe?.id && s.role !== "admin" && (
                      <button type="button" className="crm-btn sm" title="تصفح النظام كما يراه هذا الموظف بصلاحياته (للاطلاع فقط)"
                        onClick={() => { startPreview(s.id); router.push("/admin"); }}>الدخول كموظف</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="crm-hint m-0">
        تغيير الدور (موظف مبيعات / مدير مبيعات) يتم من صفحة حسابات الموظفين. ملاحظة: هذه الصلاحيات تتحكم في ما يظهر في النظام، ولا تمنع الوصول المباشر إلى قاعدة البيانات.
      </p>
    </Card>
  );
}

/* ---------- escalation (moved from Team) ---------- */
export function Escalation() {
  const { data, settings, toast } = useCrm();
  const ids = members(data);
  const [sm, setSm] = useState(settings.salesManager || data.staff.find((s) => s.role === "admin")?.id || "");
  const [days, setDays] = useState(String(settings.escalateDays || 2));
  const [off, setOff] = useState(!!settings.escalateOff);
  return (
    <Card title="إعادة العميل إلى مدير المبيعات"
      hint="إذا لم يتواصل الموظف مع العميل وتجاوز موعد الاتصال بعدد الأيام المحدد، يُعاد العميل وطلبه تلقائياً إلى مدير المبيعات، ويُسجَّل ذلك في سجل العميل.">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="crm-field"><label htmlFor="set-sm">مدير المبيعات</label>
          <select id="set-sm" value={sm} onChange={(e) => setSm(e.target.value)}>{ids.map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}</select></div>
        <div className="crm-field"><label htmlFor="set-days">عدد أيام التأخير قبل الإعادة</label>
          <select id="set-days" value={days} onChange={(e) => setDays(e.target.value)}>{[1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n}{n === 1 ? " يوم" : n === 2 ? " يومين" : " أيام"}</option>)}</select></div>
        <label className="crm-check sm:col-span-2"><input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} /><span>إيقاف الإعادة التلقائية</span></label>
      </div>
      <div><button type="button" className="crm-btn primary" onClick={async () => {
        assertWritable();
        await setDoc(doc(db, "crm", "settings"), { salesManager: sm || null, escalateDays: Number(days) || 2, escalateOff: off });
        toast("تم حفظ الإعدادات");
      }}>حفظ</button></div>
      <p className="crm-hint m-0">تتم الإعادة عندما يكون المدير أو المالك مسجّلاً في النظام.</p>
    </Card>
  );
}
