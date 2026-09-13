"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { getCompanySettings, updateCompanySettings } from "@/lib/settings";

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  lock: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-4V8a6 6 0 1 0-12 0v3m-1 0h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z",
  check: "M20 6 9 17l-5-5",
};

const inputClass =
  "rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold";
const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-navy/70";

export default function AdminSettingsPage() {
  const t = useTranslations("AdminSettings");
  const { user, staff } = useAuth();
  const isAdmin = staff?.role === "admin";

  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getCompanySettings().then((s) => {
      if (s) {
        setWhatsapp(s.whatsapp_number);
        setEmail(s.contact_email ?? "");
        setPhone(s.contact_phone ?? "");
      }
      setLoaded(true);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await updateCompanySettings(
      {
        whatsapp_number: whatsapp.trim(),
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
      },
      user.uid
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 text-navy/40">
          <Icon path={ICONS.lock} className="h-6 w-6" />
        </div>
        <h2 className="font-heading font-bold text-navy">{t("restrictedTitle")}</h2>
        <p className="max-w-xs text-sm text-navy/50">{t("restrictedBody")}</p>
      </div>
    );
  }

  if (!loaded) return <p className="text-sm text-navy/50">{t("loading")}</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-bold text-navy">{t("title")}</h1>

      <form onSubmit={handleSave} className="flex max-w-lg flex-col gap-5">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-heading font-bold text-navy">{t("sectionContact")}</h2>
          <p className="mb-4 text-xs text-navy/50">{t("sectionHint")}</p>

          <div className="flex flex-col gap-4">
            <label className={labelClass}>
              {t("whatsappNumber")}
              <input
                className={inputClass}
                dir="ltr"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
              <span className="text-xs font-normal text-navy/40">{t("whatsappHint")}</span>
            </label>
            <label className={labelClass}>
              {t("contactEmail")}
              <input
                className={inputClass}
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className={labelClass}>
              {t("contactPhone")}
              <input
                className={inputClass}
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-navy transition-opacity hover:opacity-90"
          >
            {t("save")}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <Icon path={ICONS.check} className="h-4 w-4" />
              {t("saved")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
