"use client";

/**
 * "تصفير النظام" (owner only, Settings → أدوات): wipes working data so the CRM can
 * start clean for real use. Shows what exists, lets the owner keep chosen
 * properties (anything in Al-Malqa is pre-ticked), and deletes only after the
 * owner types «تصفير». Staff accounts, permissions, lists and settings stay.
 * Permanent — there is no undo.
 */
import { useEffect, useState } from "react";
import { collection, doc, getDocs, writeBatch, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { assertWritable } from "@/lib/crm/preview";
import { waApi, type WaSource } from "@/lib/crm/wa";
import { nowStamp } from "@/lib/crm/util";

const WORK = ["clients", "phones", "requests", "properties", "tasks", "chat", "goals", "hr", "payroll"] as const;
const AR: Record<string, string> = {
  clients: "العملاء", requests: "الطلبات", properties: "العقارات", tasks: "المهام", chat: "رسائل الدردشة", goals: "الأهداف",
  hr: "ملفات الموظفين", payroll: "الرواتب", attendance: "أيام الحضور", leads: "استفسارات الموقع", offers: "عروض الموقع", demoStaff: "موظفون تجريبيون", realStaff: "حسابات موظفين",
};
const isDemo = (id: string) => id.startsWith("demo_");
type Found = Record<string, DocumentReference[]>;
interface PropRow { ref: DocumentReference; title: string; district: string }

export function ResetData() {
  const { data, toast } = useCrm();
  const [found, setFound] = useState<Found | null>(null);
  const [props, setProps] = useState<PropRow[]>([]);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [opt, setOpt] = useState({ work: true, demoStaff: true, realStaff: false, site: true, wa: true, freeKept: true });
  const [realStaff, setRealStaff] = useState<{ ref: DocumentReference; name: string; email: string }[]>([]);
  const [sources, setSources] = useState<WaSource[]>([]);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function scan() {
    const f: Found = {};
    for (const c of [...WORK, "leads", "offers"]) f[c] = (await getDocs(collection(db, c)).catch(() => null))?.docs.map((d) => d.ref) || [];
    const staff = await getDocs(collection(db, "staff"));
    f.demoStaff = staff.docs.filter((d) => isDemo(d.id)).map((d) => d.ref);
    // Real staff accounts other than the person running the reset.
    const others = staff.docs.filter((d) => !isDemo(d.id) && d.id !== data.uid);
    f.realStaff = others.map((d) => d.ref);
    setRealStaff(others.map((d) => ({ ref: d.ref, name: String(d.data().name || ""), email: String(d.data().email || "") })));
    f.attendance = [];
    for (const s of staff.docs) f.attendance.push(...(await getDocs(collection(db, "attendance", s.id, "days")).catch(() => null))?.docs.map((d) => d.ref) || []);
    const ps = await getDocs(collection(db, "properties"));
    const rows = ps.docs.map((d) => ({ ref: d.ref, title: String(d.data().title || ""), district: String(d.data().district || "") }));
    setProps(rows);
    setKeep(new Set(rows.filter((r) => /الملقا/.test(r.title + " " + r.district)).map((r) => r.ref.id)));
    setFound(f);
    waApi<{ sources: WaSource[] }>("/api/sources").then((r) => setSources(r.sources.filter((s) => s.canManage))).catch(() => setSources([]));
  }
  useEffect(() => {
    scan().catch(() => toast("تعذّر قراءة البيانات"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data.isAdmin) return null;
  if (!found) return <div className="crm-card p-4 text-sm text-[var(--crm-ink-3)]">جارٍ حصر البيانات…</div>;

  const plan: [string, DocumentReference[]][] = [
    ...(opt.work ? WORK.map((c) => [c, c === "properties" ? found.properties.filter((r) => !keep.has(r.id)) : found[c]] as [string, DocumentReference[]]) : []),
    ...(opt.work ? [["attendance", found.attendance] as [string, DocumentReference[]]] : []),
    ...(opt.site ? [["leads", found.leads], ["offers", found.offers]] as [string, DocumentReference[]][] : []),
    ...(opt.demoStaff ? [["demoStaff", found.demoStaff] as [string, DocumentReference[]]] : []),
    ...(opt.realStaff ? [["realStaff", found.realStaff] as [string, DocumentReference[]]] : []),
  ];
  const total = plan.reduce((n, [, r]) => n + r.length, 0);
  const waChats = sources.reduce((n, s) => n + (s.chats || 0), 0);

  async function run() {
    assertWritable();
    if (typed.trim() !== "تصفير") return toast("اكتب كلمة «تصفير» للتأكيد");
    setBusy("جارٍ الحذف…");
    try {
      const refs = plan.flatMap(([, r]) => r);
      for (let k = 0; k < refs.length; k += 400) {
        const b = writeBatch(db);
        refs.slice(k, k + 400).forEach((r) => b.delete(r));
        await b.commit();
        setBusy("جارٍ الحذف… " + Math.min(k + 400, refs.length) + " من " + refs.length);
      }
      // Kept properties lose their deals with the requests, so put them (and their units) back on the market.
      if (opt.work && opt.freeKept && keep.size) {
        const b = writeBatch(db);
        for (const p of data.props.filter((x) => keep.has(x.id)))
          b.update(doc(db, "properties", p.id), { status: "متاح", units: (p.units || []).map((u) => ({ ...u, status: "متاح" })), updatedAt: nowStamp() });
        await b.commit();
      }
      let wa = 0;
      if (opt.wa) for (const s of sources) { await waApi("/api/sources/" + s.id + "/clear", {}).catch(() => {}); wa += s.chats || 0; }
      setDone("تم: حُذف " + refs.length + " سجل" + (wa ? " و" + wa + " محادثة واتساب محفوظة" : "") + (keep.size ? "، وأُبقي " + keep.size + " عقار" : "") + ".");
      setTyped("");
      await scan();
    } catch {
      toast("توقف الحذف بسبب خطأ — ما حُذف قبل الخطأ لا يمكن استرجاعه، أعد المحاولة لإكمال الباقي");
    } finally {
      setBusy(null);
    }
  }

  const box = (k: keyof typeof opt, label: string, hint?: string) => (
    <label className="flex items-start gap-2 text-[14px]">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--crm-gold)]" checked={opt[k]} onChange={(e) => setOpt((o) => ({ ...o, [k]: e.target.checked }))} />
      <span>{label}{hint && <span className="block text-[12.5px] text-[var(--crm-ink-3)]">{hint}</span>}</span>
    </label>
  );

  return (
    <div className="crm-card grid gap-3 border-[var(--crm-danger)]/40 p-4">
      <h2 className="text-[15.5px] text-[var(--crm-danger)]">تصفير النظام</h2>
      <p className="crm-hint m-0">يحذف البيانات نهائياً ليبدأ النظام نظيفاً. <b>لا يمكن التراجع.</b> تبقى حسابات الموظفين وصلاحياتهم، والقوائم (أنواع العقارات والمصادر)، والإعدادات.</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {box("work", "بيانات العمل", "العملاء، الطلبات، العقارات، المهام، الدردشة، الأهداف، الحضور، الرواتب، ملفات الموظفين")}
        {box("demoStaff", "الموظفون التجريبيون", found.demoStaff.length + " حساب وهمي (خالد، سارة، نورة…)")}
        {realStaff.length > 0 && box("realStaff", "حسابات الموظفين الحقيقية", realStaff.map((x) => x.name).join("، ") + " — يبقى حسابك فقط")}
        {box("site", "استفسارات وعروض الموقع", found.leads.length + " استفسار · " + found.offers.length + " عرض")}
        {box("wa", "محادثات واتساب المحفوظة", sources.length ? waChats + " محادثة — يبقى الرقم مربوطاً والجوال لا يتأثر" : "خدمة واتساب غير متصلة أو لا يوجد رقم")}
      </div>

      {opt.work && props.length > 0 && (
        <div className="grid gap-1.5 rounded-xl border border-[var(--crm-line)] p-3">
          <b className="text-[13.5px]">العقارات — اختر ما يبقى</b>
          <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
            {props.map((p) => (
              <label key={p.ref.id} className="flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={keep.has(p.ref.id)}
                  onChange={(e) => setKeep((s) => { const n = new Set(s); if (e.target.checked) n.add(p.ref.id); else n.delete(p.ref.id); return n; })} />
                <span className="truncate">{p.title}{p.district ? " — " + p.district : ""}{isDemo(p.ref.id) ? " (تجريبي)" : ""}</span>
              </label>
            ))}
          </div>
          {keep.size > 0 && box("freeKept", "إرجاع العقارات المُبقاة إلى «متاح»", "لأن العرابين والمبيعات المرتبطة بها ستُحذف مع الطلبات")}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 text-[12.5px]">
        {plan.filter(([, r]) => r.length).map(([k, r]) => <span key={k} className="crm-chip">{AR[k]}: <span className="num">{r.length}</span></span>)}
        {!total && <span className="muted">لا يوجد ما يُحذف بهذه الاختيارات.</span>}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="crm-field min-w-[200px] flex-1">
          <label>للتأكيد اكتب: <b>تصفير</b></label>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="تصفير" />
        </div>
        <button type="button" className="crm-btn" style={{ background: "var(--crm-danger)", color: "#fff", borderColor: "var(--crm-danger)" }}
          disabled={!!busy || typed.trim() !== "تصفير" || (!total && !(opt.wa && waChats))} onClick={run}>
          {busy || "حذف " + total + " سجل نهائياً"}
        </button>
      </div>
      {opt.realStaff && realStaff.length > 0 && (
        <p className="crm-hint m-0">حذف الموظف هنا يمنعه من دخول النظام فوراً، لكن بريده يبقى مسجّلاً في Firebase. لإعادة استخدام البريد لاحقاً احذفه أيضاً من Firebase ← Authentication: {realStaff.map((x) => x.email).filter(Boolean).join("، ")}.</p>
      )}
      {done && <p className="m-0 rounded-lg bg-[var(--crm-surface-2)] px-3 py-2 text-[13.5px]">{done}</p>}
    </div>
  );
}
