"use client";

/**
 * «حالة الموقع» (owner): one switch for the public website. On = the full site; off = «انتظرونا قريباً» with the
 * request form only. Stored in settings/site { open } (public read, admin write); the site reads it on every visit.
 */
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";

export function SiteSwitch() {
  const { data, toast } = useCrm();
  const [open, setOpen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(doc(db, "settings", "site"), (s) => setOpen(s.exists() && s.data().open === true), () => setOpen(false)), []);
  async function flip() {
    if (open === null) return;
    const next = !open;
    if (!confirm(next ? "فتح الموقع للزوار الآن؟" : "إغلاق الموقع وإظهار «انتظرونا قريباً»؟")) return;
    setBusy(true);
    try {
      await setDoc(doc(db, "settings", "site"), { open: next, updatedAt: new Date().toISOString(), by: data.uid }, { merge: true });
      toast(next ? "الموقع مفتوح الآن" : "الموقع الآن «انتظرونا قريباً»");
    } catch { toast("تعذّر الحفظ"); } finally { setBusy(false); }
  }
  return (
    <div className="crm-card flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <b className="font-heading">حالة الموقع</b>
        <div className="muted text-[13px]">
          {open === null ? "جارٍ التحميل…" : open ? "مفتوح للزوار — يظهر الموقع كاملاً." : "مغلق — يظهر «انتظرونا قريباً» مع نموذج تسجيل الطلب فقط."}
        </div>
      </div>
      <button type="button" className={"crm-btn " + (open ? "" : "primary")} disabled={busy || open === null} onClick={flip}>
        {open ? "إغلاق الموقع (انتظرونا قريباً)" : "فتح الموقع"}
      </button>
    </div>
  );
}
