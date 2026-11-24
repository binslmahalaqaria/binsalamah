"use client";

/**
 * «طلبات التوظيف» (client 2026-11-24): job applications sent from the website's /careers page, newest first.
 * Managers only (owner and sales managers). Applications are leads whose message starts «طلب توظيف»; they are
 * never turned into clients and no longer show in «نماذج الموقع».
 */
import { useEffect, useState } from "react";
import { deleteLead, listLeads } from "@/lib/leads";
import { isJobApp } from "@/lib/careers";
import { useCrm } from "@/lib/crm/store";
import { ageDays, fmtStamp } from "@/lib/crm/util";
import { ContactIcons, Empty, PageHeader } from "@/components/crm/ui";
import type { Lead } from "@/lib/types";

/** "طلب توظيف | الوظيفة: … | العمر: … | …" → { الوظيفة: …, العمر: …, … } */
function fields(message: string | null | undefined) {
  const out: Record<string, string> = {};
  for (const p of String(message || "").split(" | ")) {
    const i = p.indexOf(":");
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return out;
}

export default function CareersPage() {
  const { data, toast } = useCrm();
  const [apps, setApps] = useState<Lead[] | null>(null);
  const [job, setJob] = useState("");
  useEffect(() => {
    if (!data.isMgr) return;
    listLeads().then((l) => setApps(l.filter(isJobApp))).catch(() => setApps([]));
  }, [data.isMgr]);

  if (!data.isMgr) return <Empty>هذا القسم للمدير فقط.</Empty>;
  const jobs = Array.from(new Set((apps || []).map((a) => fields(a.message)["الوظيفة"]).filter(Boolean)));
  const list = (apps || []).filter((a) => !job || fields(a.message)["الوظيفة"] === job);

  return (
    <>
      <PageHeader title="طلبات التوظيف" sub="الطلبات المرسلة من صفحة «التوظيف» في الموقع — تظهر للمدير فقط."
        action={jobs.length > 1 ? (
          <select className="crm-quiet" aria-label="الوظيفة" value={job} onChange={(e) => setJob(e.target.value)}>
            <option value="">كل الوظائف ({apps?.length || 0})</option>
            {jobs.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        ) : undefined} />
      {apps === null ? <Empty>جارٍ التحميل…</Empty> : !list.length ? <Empty>لم يصل أي طلب توظيف بعد.</Empty> : (
        <div className="grid gap-3">
          {list.map((a) => {
            const f = fields(a.message);
            const at = new Date(a.created_at).toISOString();
            const cv = f["السيرة"];
            return (
              <div key={a.id} className="crm-card grid gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="font-heading text-[16px]">{a.customer_name || "—"}</b>
                  <span className="num text-[13px] text-[var(--crm-ink-3)]" dir="ltr">{a.phone}</span>
                  <ContactIcons phone={a.phone} text={"السلام عليكم " + (a.customer_name || "") + "، معك بن سلمه العقارية بخصوص طلب التوظيف المرسل لنا."} />
                  <span className="ms-auto text-[12.5px] text-[var(--crm-ink-3)]">{ageDays(at)} · {fmtStamp(at)}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-[var(--crm-ink-2)]">
                  {["الوظيفة", "العمر", "الجنسية", "المدينة", "الخبرة", "البريد"].map((k) => f[k] ? <span key={k}><b className="text-[var(--crm-ink)]">{k}:</b> {f[k]}</span> : null)}
                </div>
                {f["نبذة"] && <p className="m-0 whitespace-pre-line text-[13.5px] leading-relaxed">{f["نبذة"]}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {cv && (/^https?:\/\//.test(cv)
                    ? <a href={cv} target="_blank" rel="noopener noreferrer" className="crm-btn sm">فتح السيرة الذاتية</a>
                    : <span className="text-[13px]"><b>السيرة:</b> {cv}</span>)}
                  {/* Delete (client 2026-11-24): the Firestore rules allow it for the owner (admin) only. */}
                  {data.isAdmin && (
                    <button type="button" className="crm-btn sm danger ms-auto" onClick={async () => {
                      if (!window.confirm("حذف طلب التوظيف «" + (a.customer_name || "") + "» نهائياً؟ ما يرجع بعد الحذف.")) return;
                      try { await deleteLead(a.id); setApps((xs) => (xs || []).filter((x) => x.id !== a.id)); toast("تم حذف الطلب"); }
                      catch { toast("تعذّر الحذف"); }
                    }}>🗑 حذف</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
