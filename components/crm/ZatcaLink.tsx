"use client";

/**
 * "الربط مع الهيئة" (owner only, Settings → أدوات): links the CRM to ZATCA's
 * Fatoora platform (e-invoicing Phase 2). The owner picks the environment and
 * types the OTP from fatoora.zatca.gov.sa; the server creates the device key,
 * passes ZATCA's six compliance checks and gets the production certificate
 * (lib/zatca/server.ts). From then on every issued invoice is signed and sent.
 */
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { write } from "@/lib/crm/actions";
import { ZATCA_ENV_LABEL, zatcaOnboard, type ZatcaEnv } from "@/lib/crm/zatca";

interface Egs { status?: string; env?: ZatcaEnv; onboardedAt?: string; icv?: number; lastInvoice?: string; checks?: { name: string; ok: boolean; info: string }[] }

export function ZatcaLink() {
  const { settings, toast } = useCrm();
  const [egs, setEgs] = useState<Egs | null>(null);
  const [env, setEnv] = useState<ZatcaEnv>("sandbox");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  const load = () => getDoc(doc(db, "zatca", "egs")).then((s) => setEgs(s.exists() ? (s.data() as Egs) : {})).catch(() => setEgs({}));
  useEffect(() => { load(); }, [settings.zatcaOn]);

  const missing = [!settings.vatNo && "الرقم الضريبي", !settings.crNo && "السجل التجاري", !(settings.addrStreet && settings.addrBuilding && settings.addrDistrict && settings.addrCity && settings.addrPostal) && "العنوان الوطني"].filter(Boolean) as string[];
  const linked = settings.zatcaOn && egs?.status === "مربوط";

  async function link() {
    if (env !== "sandbox" && missing.length) return setErr("أكمل أولاً في «بيانات المنشأة»: " + missing.join("، "));
    if (env === "production" && !window.confirm("الربط على بيئة الإنتاج: كل فاتورة تصدر بعدها تُرسل للهيئة فعلياً. متابعة؟")) return;
    setBusy(true);
    setErr("");
    try {
      const r = await zatcaOnboard(env, otp);
      toast("تم الربط مع الهيئة — " + ZATCA_ENV_LABEL[r.env]);
      setOtp("");
      setOpen(false);
      await load();
    } catch (e) {
      setErr((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-card grid gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <b className="flex-1">الربط مع هيئة الزكاة والضريبة والجمارك (الفوترة الإلكترونية — المرحلة الثانية)</b>
        {linked ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[12px] text-emerald-800">مربوط — {ZATCA_ENV_LABEL[(settings.zatcaEnv || egs?.env || "sandbox") as ZatcaEnv]}</span>
          : <span className="rounded-full bg-[var(--crm-line,#eee)] px-2.5 py-0.5 text-[12px]">غير مربوط</span>}
      </div>

      {linked && (
        <div className="grid gap-1 text-[13px]">
          <span>تاريخ الربط: <b className="num">{egs?.onboardedAt ? new Date(egs.onboardedAt).toLocaleString("ar-SA-u-nu-latn") : "—"}</b></span>
          <span>الفواتير المرسلة: <b className="num">{egs?.icv || 0}</b>{egs?.lastInvoice ? " — آخرها " + egs.lastInvoice : ""}</span>
          {settings.zatcaEnv !== "production" && <span className="crm-hint">هذا ربط تجريبي: الفواتير تُرسل لبيئة الاختبار ولا تُحتسب فعلياً. للربط الفعلي استخدم بيئة الإنتاج برمز جديد.</span>}
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" className="crm-btn sm" onClick={() => setOpen((o) => !o)}>إعادة الربط / تغيير البيئة</button>
            <button type="button" className="crm-btn ghost sm" onClick={async () => {
              if (!window.confirm("إيقاف الإرسال التلقائي للهيئة؟ (تبقى الشهادة محفوظة ويمكن التفعيل لاحقاً بإعادة الربط)")) return;
              await write("crm", "settings", { zatcaOn: false }, "update");
              toast("أُوقف الإرسال للهيئة");
            }}>إيقاف الإرسال</button>
          </div>
        </div>
      )}

      {(!linked || open) && (
        <div className="grid gap-2 text-[13px]">
          <ol className="m-0 grid gap-0.5 ps-5 text-[var(--crm-ink-2,#555)]">
            <li>ادخل على بوابة فاتورة <a className="link" href="https://fatoora.zatca.gov.sa" target="_blank" rel="noreferrer">fatoora.zatca.gov.sa</a> بحساب المنشأة (منصة الهيئة).</li>
            <li>اختر «إضافة جهاز جديد / Onboard new solution unit» واطلب رمز التحقق (OTP) — صالح لمدة ساعة.</li>
            <li>اكتب الرمز هنا واضغط «ربط». النظام يجتاز فحوصات الهيئة الستة تلقائياً.</li>
          </ol>
          {env === "sandbox" && <span className="crm-hint">البيئة التجريبية لا تحتاج حساباً: رمزها الثابت 123345.</span>}
          {env !== "sandbox" && missing.length > 0 && <span className="text-amber-700">ناقص في «بيانات المنشأة»: {missing.join("، ")}</span>}
          <div className="flex flex-wrap items-end gap-2">
            <div className="crm-field"><label>البيئة</label>
              <select value={env} onChange={(e) => setEnv(e.target.value as ZatcaEnv)}>
                {(Object.keys(ZATCA_ENV_LABEL) as ZatcaEnv[]).map((k) => <option key={k} value={k}>{ZATCA_ENV_LABEL[k]}</option>)}
              </select>
            </div>
            <div className="crm-field"><label>رمز التحقق OTP</label><input dir="ltr" inputMode="numeric" className="num !w-32" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} /></div>
            <button type="button" className="crm-btn primary" disabled={busy || otp.length !== 6} onClick={link}>{busy ? "جارٍ الربط والفحص… (دقيقة تقريباً)" : "ربط"}</button>
          </div>
        </div>
      )}

      {err && <p className="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{err}</p>}
      {!!egs?.checks?.length && (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer">نتيجة فحوصات الامتثال</summary>
          <ul className="m-0 grid gap-0.5 ps-5">
            {egs.checks.map((c) => <li key={c.name}>{c.ok ? "✅" : "❌"} {c.name}{c.ok ? "" : " — " + c.info}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
