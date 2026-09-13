"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createPublicLead } from "@/lib/leads";
import { leadFormSchema } from "@/lib/validators";

export function RegisterInterestForm({ offerId }: { offerId: string }) {
  const t = useTranslations("RegisterInterest");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = leadFormSchema.safeParse({
      customer_name: name,
      phone,
      message: message || undefined,
      related_offer_id: offerId,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("error"));
      return;
    }

    setStatus("submitting");
    try {
      await createPublicLead({
        customer_name: parsed.data.customer_name,
        phone: parsed.data.phone,
        message: parsed.data.message,
        related_offer_id: offerId,
      });
      setStatus("success");
      setName("");
      setPhone("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div id="interest" className="rounded-2xl bg-navy/5 p-6 text-navy">
        {t("success")}
      </div>
    );
  }

  return (
    <form
      id="interest"
      onSubmit={handleSubmit}
      className="flex scroll-mt-24 flex-col gap-3 rounded-2xl bg-navy/5 p-6"
    >
      <h3 className="font-heading font-bold text-navy">{t("title")}</h3>
      <input
        className="rounded-lg border border-navy/20 bg-white px-4 py-2 text-sm"
        placeholder={t("name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="rounded-lg border border-navy/20 bg-white px-4 py-2 text-sm"
        placeholder={t("phone")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <textarea
        className="rounded-lg border border-navy/20 bg-white px-4 py-2 text-sm"
        placeholder={t("message")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "error" && !error && <p className="text-sm text-red-600">{t("error")}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-full bg-gold px-5 py-2.5 font-medium text-navy transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === "submitting" ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
