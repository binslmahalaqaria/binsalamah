"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Logo } from "@/components/Logo";

export default function AdminLoginPage() {
  const t = useTranslations("Admin.login");
  const router = useRouter();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/admin");
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-6">
      <div className="w-full max-w-sm rounded-2xl bg-cream p-8 shadow-xl">
        <div className="mb-8 flex justify-center">
          <Logo locale={locale} />
        </div>
        <h1 className="mb-6 text-center font-heading text-lg font-bold text-navy">
          {t("title")}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-navy/70">
            {t("email")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-navy outline-none transition-colors focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-navy/70">
            {t("password")}
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-navy outline-none transition-colors focus:border-gold"
            />
          </label>
          {error && <p className="text-sm text-red-600">{t("error")}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full bg-gold px-4 py-2.5 font-medium text-navy transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
