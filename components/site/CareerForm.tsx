"use client";

/**
 * Job application form (/careers). Saved as a website lead with source
 * "other" and a message starting «طلب توظيف», so applications land in the
 * CRM's website enquiries without any new collection or rules. The CV is a
 * link — file uploads would need public Storage writes.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { createManualLead } from "@/lib/leads";
import { JOBS, JOB_AR, type Job } from "@/lib/careers";
import { PhoneInput } from "@/components/site/PhoneInput";

const EXP = ["0", "1-2", "3-5", "6-10", "10+"];
const CITIES = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "القصيم", "أبها", "الطائف", "تبوك", "حائل"];

const saudiMobile = (s: string) => {
  const m = /^(?:966|0)?(5\d{8})$/.exec(s.replace(/[^\d]/g, "").replace(/^00/, ""));
  return m ? "0" + m[1] : null;
};

export function CareerForm() {
  const t = useTranslations("Site");
  const [job, setJob] = useState<Job | "">("");
  const [f, setF] = useState({ name: "", age: "", nationality: "", phone: "", email: "", city: "الرياض", exp: "", cv: "", note: "" });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mobile = saudiMobile(f.phone);
    const age = Number(f.age);
    const check: [boolean, string][] = [
      [f.name.trim().length < 2, "appNeedName"], [!(age >= 16 && age <= 70), "appNeedAge"], [!f.nationality, "appNeedNationality"],
      [!mobile, "appNeedPhone"], [!f.city.trim(), "appNeedCity"], [!job, "appNeedJob"], [!f.exp, "appNeedExp"], [f.note.trim().length < 5, "appNeedNote"],
    ];
    const bad = check.find(([b]) => b);
    if (bad) return setErr(t(bad[1]));
    setErr("");
    setState("sending");
    const message = [
      "طلب توظيف", "الوظيفة: " + JOB_AR[job as Job], "العمر: " + age, "الجنسية: " + f.nationality, "المدينة: " + f.city.trim(),
      "الخبرة: " + (f.exp === "0" ? "بدون خبرة" : f.exp + " سنوات"), f.email.trim() && "البريد: " + f.email.trim(),
      f.cv.trim() && "السيرة: " + f.cv.trim(), "نبذة: " + f.note.trim(),
    ].filter(Boolean).join(" | ").slice(0, 1000);
    try {
      await createManualLead({ customer_name: f.name.trim(), phone: mobile!, message, source: "other" });
      setState("done");
    } catch {
      setState("error");
    }
  }

  const field = "w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy outline-none transition-colors focus:border-navy/50";
  const label = "grid gap-1.5 text-[13px] font-medium text-navy/70";
  const req = <span className="text-red-500">*</span>;

  if (state === "done") return <p className="rounded-3xl border border-navy/10 bg-white px-6 py-14 text-center text-lg font-medium text-navy">{t("appDone")}</p>;
  return (
    <form onSubmit={submit} className="grid gap-5 rounded-3xl border border-navy/10 bg-white p-6 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.4)] sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}><span>{t("appName")} {req}</span><input className={field} value={f.name} onChange={set("name")} autoComplete="name" /></label>
        <label className={label}><span>{t("appAge")} {req}</span><input className={field} value={f.age} onChange={set("age")} inputMode="numeric" /></label>
        <label className={label}><span>{t("appNationality")} {req}</span>
          <select className={field} value={f.nationality} onChange={set("nationality")}>
            <option value="">—</option><option value="سعودي">{t("appSaudi")}</option><option value="غير سعودي">{t("appNonSaudi")}</option>
          </select>
        </label>
        <label className={label}><span>{t("appPhone")} {req}</span><PhoneInput className={field} value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></label>
        <label className={label}><span>{t("appEmail")}</span><input className={field} value={f.email} onChange={set("email")} type="email" dir="ltr" autoComplete="email" /></label>
        <label className={label}><span>{t("appCity")} {req}</span>
          <input className={field} list="career-cities" value={f.city} onChange={set("city")} />
          <datalist id="career-cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className={label}><span>{t("appJob")} {req}</span>
          <select className={field} value={job} onChange={(e) => setJob(e.target.value as Job)}>
            <option value="">—</option>
            {JOBS.map((j) => <option key={j} value={j}>{t(j)}</option>)}
          </select>
        </label>
        <label className={label}><span>{t("appExp")} {req}</span>
          <select className={field} value={f.exp} onChange={set("exp")}>
            <option value="">—</option>
            {EXP.map((x) => <option key={x} value={x}>{x === "0" ? t("appExpNone") : x}</option>)}
          </select>
        </label>
        <label className={label + " sm:col-span-2"}><span>{t("appNote")} {req}</span><textarea className={field} rows={4} value={f.note} onChange={set("note")} /></label>
        <label className={label + " sm:col-span-2"}><span>{t("appCv")}</span><input className={field} value={f.cv} onChange={set("cv")} dir="ltr" placeholder="https://" /></label>
      </div>
      {(err || state === "error") && <p className="text-sm text-red-600">{err || t("appError")}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={state === "sending"} className="min-h-12 rounded-full bg-navy px-10 py-3 font-medium text-cream transition-colors hover:bg-navy/85 disabled:opacity-50">
          {state === "sending" ? t("appSending") : t("appSubmit")}
        </button>
      </div>
    </form>
  );
}
