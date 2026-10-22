"use client";

/**
 * Adding numbers to "للتواصل" (managers): phone numbers only, typed one per box or from an
 * Excel file (the one-column template, our WhatsApp review sheet, or any sheet with a
 * phone column). Any format is normalised; numbers already in the CRM or repeated are dropped; the rest are
 * created with status للتواصل and spread over the team (round-robin by default).
 */
import { useState } from "react";
import { collection, doc, setDoc, writeBatch } from "firebase/firestore";
import { readSheet } from "read-excel-file/browser";
import readExcelFile from "read-excel-file/browser";
import writeExcelFile from "write-excel-file/browser";
import { db } from "@/lib/firebase";
import { claimPhone } from "@/lib/crm/actions";
import { useCrm } from "@/lib/crm/store";
import { TO_CONTACT } from "@/lib/crm/constants";
import { members, nameOf } from "@/lib/crm/logic";
import { assertWritable } from "@/lib/crm/preview";
import { normPhone, nowStamp, num } from "@/lib/crm/util";
import { Pill } from "./ui";

/** One client to add, before checks. */
export interface Incoming { name: string; phone: string; types: string[]; districts: string; budget: number | null; notes: string }
type Cell = string | number | boolean | Date | null | undefined;

/** 9665XXXXXXXX → 05XXXXXXXX; other countries keep the + form. */
const toLocal = (d: string) => (d.startsWith("9665") ? "0" + d.slice(3) : "+" + d);
const str = (v: Cell) => (v == null ? "" : v instanceof Date ? v.toLocaleDateString("en-GB") : String(v)).trim();

const TEMPLATE_HEAD = ["الجوال"];

/** Columns we understand, by header text (our template, the WhatsApp review sheet, or similar). */
const COLS: [keyof Incoming | "include" | "extra", RegExp][] = [
  ["include", /إدخال|ادخال/],
  ["phone", /جوال|هاتف|رقم|phone|mobile/i],
  ["name", /^الاسم$|^اسم|name/i],
  ["types", /نوع العقار|^النوع$/],
  ["districts", /^الحي$|الأحياء|الاحياء/],
  ["budget", /ميزاني/],
  ["notes", /ملاحظ/],
  ["extra", /تصنيف|^الطلب$|آخر ما كتبه|تفاصيل/],
];

/** Sheet rows → clients. Finds the header row (the one with a phone column) in the first rows; without one, guesses per row. */
export function rowsToIncoming(rows: Cell[][], propTypes: string[]): { list: Incoming[]; skipped: number } {
  const list: Incoming[] = [];
  let skipped = 0;
  const hi = rows.slice(0, 6).findIndex((r) => r.some((c) => /جوال|هاتف|phone|mobile/i.test(str(c))));
  if (hi >= 0) {
    const head = rows[hi].map(str);
    const at = (k: string) => head.map((h, i) => [h, i] as const).filter(([h]) => COLS.find(([kk]) => kk === k)![1].test(h)).map(([, i]) => i);
    const [inc] = at("include"), [ph] = at("phone"), [nm] = at("name"), [ty] = at("types"), [di] = at("districts"), [bu] = at("budget");
    const extra = [...at("notes"), ...at("extra")];
    for (const r of rows.slice(hi + 1)) {
      if (!r.some((c) => str(c))) continue;
      if (inc != null && str(r[inc]) === "لا") { skipped++; continue; }
      const types = ty != null ? str(r[ty]).split(/[،,]/).map((x) => x.trim()).filter((x) => propTypes.includes(x)) : [];
      list.push({
        name: nm != null ? str(r[nm]) : "", phone: ph != null ? str(r[ph]) : "", types,
        districts: di != null ? str(r[di]).replace(/,/g, "،") : "", budget: bu != null ? num(str(r[bu]).replace(/[^\d.]/g, "")) ?? null : null,
        notes: extra.map((i) => str(r[i])).filter(Boolean).join(" · ").slice(0, 900),
      });
    }
  } else {
    for (const r of rows) {
      const cells = r.map(str).filter(Boolean);
      const pi = cells.findIndex((x) => /^[+\d٠-٩][\d٠-٩\s\-()]{7,}$/.test(x) && normPhone(x));
      if (pi < 0) { if (cells.length) skipped++; continue; }
      const rest = cells.filter((_, i) => i !== pi);
      const ni = rest.findIndex((x) => !/^[\d٠-٩.,\s/+-]+$/.test(x) && x.length <= 50);
      list.push({ name: ni >= 0 ? rest[ni] : "", phone: cells[pi], types: [], districts: "", budget: null, notes: rest.filter((_, i) => i !== ni).join(" · ").slice(0, 900) });
    }
  }
  return { list, skipped };
}

/** Checks numbers: valid, not already a client, not repeated. */
function check(list: Incoming[], taken: Set<string>) {
  const ok: (Incoming & { key: string })[] = [], seen = new Set<string>();
  let dupSys = 0, dupList = 0, bad = 0;
  for (const r of list) {
    const key = normPhone(r.phone);
    // Saudi numbers must come out as 9665 + 8 digits; anything else with +966 is a typo.
    if (!key || (key.startsWith("966") && !/^9665\d{8}$/.test(key))) { if (r.phone || r.name) bad++; continue; }
    if (taken.has(key)) { dupSys++; continue; }
    if (seen.has(key)) { dupList++; continue; }
    seen.add(key);
    ok.push({ ...r, phone: toLocal(key), key });
  }
  return { ok, dupSys, dupList, bad };
}

export function ContactImport({ onClose }: { onClose: () => void }) {
  const { data, toast } = useCrm();
  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [manual, setManual] = useState<Incoming[]>(() => Array.from({ length: 3 }, () => ({ name: "", phone: "", types: [], districts: "", budget: null, notes: "" })));
  const [file, setFile] = useState<{ name: string; list: Incoming[]; skipped: number } | null>(null);
  const [reading, setReading] = useState(false);
  // A manager spreads the numbers over the team (round-robin, one employee, or later); an employee adds numbers for themselves.
  const [assign, setAssign] = useState<string>(data.isMgr ? "rr" : data.uid);
  const [source, setSource] = useState<string>(data.sources.includes("واتساب") ? "واتساب" : "");
  const [busy, setBusy] = useState(false);

  const taken = new Set(data.clients.map((c) => normPhone(c.phone)).filter((x): x is string => !!x));
  const input = mode === "manual" ? manual.filter((r) => r.phone.trim() || r.name.trim()) : file?.list || [];
  const p = check(input, taken);
  const order = (data.rr.order.length ? data.rr.order : members(data)).filter((id) => data.staff.some((s) => s.id === id && s.active));

  const setRow = (i: number, k: "phone", v: string) => setManual((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const rowState = (r: Incoming) => {
    if (!r.phone.trim()) return "";
    const key = normPhone(r.phone);
    if (!key || (key.startsWith("966") && !/^9665\d{8}$/.test(key))) return "رقم غير صحيح";
    if (taken.has(key)) return "مسجّل في النظام";
    if (manual.filter((x) => normPhone(x.phone) === key).length > 1) return "مكرّر";
    return "ok";
  };

  async function template() {
    await writeExcelFile([
      TEMPLATE_HEAD.map((h) => ({ value: h, fontWeight: "bold" as const, backgroundColor: "#333333", color: "#FFFFFF" })),
      ["0551234567"],
      ["+966559876543"],
    ], { columns: [{ width: 20 }], rightToLeft: true, stickyRowsCount: 1, sheet: "الأرقام" })
      .toFile("نموذج-قائمة-التواصل.xlsx");
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setReading(true);
    try {
      // Read every sheet: the WhatsApp review file spreads clients over several sheets, each row marked نعم/لا.
      const sheets = await readExcelFile(f).catch(async () => [{ sheet: "", data: await readSheet(f) }]);
      let list: Incoming[] = [], skipped = 0;
      for (const s of sheets) {
        const r = rowsToIncoming(s.data as Cell[][], data.propTypes);
        list = list.concat(r.list);
        skipped += r.skipped;
      }
      setFile({ name: f.name, list, skipped });
      if (!list.length) toast("لم يُعثر على أرقام في الملف — تأكد أن فيه عمود «الجوال»");
    } catch {
      toast("تعذّرت قراءة الملف — يجب أن يكون بصيغة ‎.xlsx");
      setFile(null);
    } finally {
      setReading(false);
    }
  }

  async function run() {
    assertWritable();
    if (!p.ok.length) return toast("لا توجد أرقام جديدة صالحة");
    if (assign === "rr" && !order.length) return toast("لا يوجد موظفون للتوزيع بالدور");
    setBusy(true);
    try {
      let i = data.rr.last ? order.indexOf(data.rr.last) : -1;
      let last: string | null = null;
      for (let k = 0; k < p.ok.length; k += 400) {
        const batch = writeBatch(db);
        for (const r of p.ok.slice(k, k + 400)) {
          let who: string | null = null;
          if (assign === "rr") { i = (i + 1) % order.length; who = last = order[i]; }
          else if (assign !== "none") who = assign;
          const ref = doc(collection(db, "clients"));
          claimPhone(batch, r.phone, ref.id);
          batch.set(ref, {
            // Number only (client's choice): the employee records the name and request when they call.
            name: r.phone, phone: r.phone, source: source || null, status: TO_CONTACT, temp: "دافئ",
            assignee: who, assignedAt: who ? nowStamp() : null, assignedBy: who ? data.uid : null, unseen: !!who && who !== data.uid,
            nextCall: null, visitAt: null, visitProperty: null, visitConfirmed: false, notes: null,
            log: [], createdAt: nowStamp(), updatedAt: nowStamp(),
          });
        }
        await batch.commit();
      }
      if (assign === "rr" && last) await setDoc(doc(db, "crm", "lists"), { rr: { ...data.rr, last } }, { merge: true }).catch(() => {});
      toast("أُضيف " + p.ok.length + " عميل إلى قائمة التواصل" + (assign === "rr" ? " ووُزّعوا على " + order.length + " موظف" : ""));
      onClose();
    } catch {
      toast("تعذّرت الإضافة، يرجى المحاولة مجدداً");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-card mb-3 grid gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[15.5px]">إضافة عملاء إلى قائمة التواصل</h2>
        <button type="button" className="crm-btn ghost sm" onClick={onClose}>إغلاق</button>
      </div>
      <div className="flex gap-1.5">
        <button type="button" className={"crm-qchip" + (mode === "manual" ? " on" : "")} onClick={() => setMode("manual")}>✍️ إدخال يدوي</button>
        <button type="button" className={"crm-qchip" + (mode === "excel" ? " on" : "")} onClick={() => setMode("excel")}>📄 استيراد من Excel</button>
      </div>

      {mode === "manual" ? (
        <div className="grid gap-2">
          <p className="crm-hint m-0">رقم الجوال فقط، بأي صيغة: <span className="num" dir="ltr">0551234567</span> أو <span className="num" dir="ltr">551234567</span> أو <span className="num" dir="ltr">+966551234567</span> أو <span className="num" dir="ltr">00966551234567</span> — يُضبط تلقائياً. Enter ينقلك لسطر جديد.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {manual.map((r, i) => {
              const st = rowState(r);
              const key = normPhone(r.phone);
              return (
                <div key={i} className="grid">
                  <div className="flex items-center gap-1.5">
                    <input id={"cimp-" + i} dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={r.phone} className={"num flex-1 " + (st && st !== "ok" ? "!border-[var(--crm-danger)]" : "")}
                      onChange={(e) => setRow(i, "phone", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (i === manual.length - 1) setManual((rs) => [...rs, { name: "", phone: "", types: [], districts: "", budget: null, notes: "" }]);
                        setTimeout(() => document.getElementById("cimp-" + (i + 1))?.focus(), 0);
                      }} />
                    <button type="button" className="crm-btn ghost sm" aria-label="حذف" onClick={() => setManual((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}>×</button>
                  </div>
                  {st === "ok" && key ? <span className="num mt-0.5 text-[11.5px] text-[var(--crm-ok)]" dir="ltr">✓ {toLocal(key)}</span>
                    : st ? <span className="mt-0.5 text-[11.5px] text-[var(--crm-danger)]">{st}</span> : null}
                </div>
              );
            })}
          </div>
          <button type="button" className="crm-btn sm justify-self-start"
            onClick={() => setManual((rs) => [...rs, ...Array.from({ length: 3 }, () => ({ name: "", phone: "", types: [], districts: "", budget: null, notes: "" }))])}>+ 3 أرقام</button>
        </div>
      ) : (
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="crm-btn primary cursor-pointer">
              {reading ? "جارٍ القراءة…" : file ? "اختيار ملف آخر" : "اختيار ملف Excel"}
              <input type="file" accept=".xlsx" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button type="button" className="crm-btn" onClick={template}>⬇ تحميل النموذج</button>
            {file && <span className="text-[13px] text-[var(--crm-ink-2)]">{file.name}</span>}
          </div>
          <p className="crm-hint m-0">
            ضع الأرقام في عمود واحد عنوانه «الجوال» (كما في النموذج)، بأي صيغة — تُضبط تلقائياً. يُقرأ الرقم فقط. ملف مراجعة عملاء الواتساب يُقبل كما هو: تُؤخذ أرقام الصفوف المعلّمة «نعم» ويُتجاهل «لا».
          </p>
          {file && p.ok.length > 0 && (
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--crm-line)] p-2.5">
              {p.ok.slice(0, 24).map((r) => <span key={r.key} className="num rounded-md bg-[var(--crm-surface-2)] px-2 py-0.5 text-[12.5px]" dir="ltr">{r.phone}</span>)}
              {p.ok.length > 24 && <span className="muted self-center text-[12.5px]">و{p.ok.length - 24} رقم آخر…</span>}
            </div>
          )}
        </div>
      )}

      {input.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-[13px]">
          <Pill tone="ok">جاهز للإضافة: {p.ok.length}</Pill>
          {p.dupSys > 0 && <Pill tone="muted">مسجّل في النظام: {p.dupSys}</Pill>}
          {p.dupList > 0 && <Pill tone="muted">مكرّر: {p.dupList}</Pill>}
          {p.bad > 0 && <Pill tone="warm">رقم غير صحيح: {p.bad}</Pill>}
          {mode === "excel" && file && file.skipped > 0 && <Pill tone="muted">مستبعد («لا» أو بلا رقم): {file.skipped}</Pill>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="crm-field">
          <label>التوزيع على الموظفين</label>
          {data.isMgr ? (
            <select value={assign} onChange={(e) => setAssign(e.target.value)}>
              <option value="rr">تلقائي بالدور ({order.length} موظف)</option>
              <option value="none">بدون إسناد (أوزّعهم لاحقاً)</option>
              {members(data).map((id) => <option key={id} value={id}>كلهم إلى {nameOf(data, id)}</option>)}
            </select>
          ) : (
            <select value={data.uid} disabled><option value={data.uid}>لي أنا</option></select>
          )}
        </div>
        <div className="crm-field">
          <label>المصدر</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">—</option>
            {data.sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" className="crm-btn primary w-full" disabled={busy || !p.ok.length} onClick={run}>
            {busy ? "جارٍ الإضافة…" : "إضافة " + p.ok.length + " عميل"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Excel export of the contact list as shown (filters applied). */
export async function exportContactList(rows: { name: string; phone: string; assignee: string; tries: number; last: string; notes: string }[]) {
  await writeExcelFile([
    ["الاسم", "الجوال", "المسؤول", "محاولات لم يرد", "آخر محاولة", "ملاحظات"].map((h) => ({ value: h, fontWeight: "bold" as const, backgroundColor: "#333333", color: "#FFFFFF" })),
    ...rows.map((r) => [r.name, r.phone, r.assignee, r.tries, r.last, r.notes]),
  ], { columns: [{ width: 22 }, { width: 14 }, { width: 16 }, { width: 13 }, { width: 18 }, { width: 50 }], rightToLeft: true, stickyRowsCount: 1, sheet: "للتواصل" })
    .toFile("قائمة-التواصل-" + new Date().toISOString().slice(0, 10) + ".xlsx");
}
