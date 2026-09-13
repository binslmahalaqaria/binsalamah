"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getLead, setLeadStatus, assignLead, addLeadNote } from "@/lib/leads";
import { listStaff } from "@/lib/staff-client";
import { getOffer } from "@/lib/offers";
import { useAuth } from "@/lib/auth-context";
import type { Lead, LeadStatus, Staff, Offer } from "@/lib/types";

const STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "closed_won",
  "closed_lost",
];

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-navy/10 text-navy",
  contacted: "bg-gold/25 text-navy",
  interested: "bg-gold/50 text-navy",
  not_interested: "bg-gray-200 text-gray-600",
  closed_won: "bg-green-100 text-green-700",
  closed_lost: "bg-red-100 text-red-700",
};

const inputClass =
  "rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold";
const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-navy/70";

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 rtl:rotate-180"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function LeadDetailPage() {
  const t = useTranslations("AdminLeadDetail");
  const tStatus = useTranslations("LeadStatus");
  const tSource = useTranslations("LeadSource");
  const locale = useLocale();
  const isArabic = locale === "ar";
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [noteText, setNoteText] = useState("");

  const staffById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [staff]);

  async function reload() {
    const l = await getLead(params.id);
    setLead(l);
    if (l?.related_offer_id) setOffer(await getOffer(l.related_offer_id));
  }

  useEffect(() => {
    reload();
    listStaff().then(setStaff);
  }, [params.id]);

  if (lead === undefined) return <p className="text-sm text-navy/50">…</p>;
  if (lead === null) return <p className="text-sm text-red-600">{t("notFound")}</p>;

  async function handleStatusChange(status: LeadStatus) {
    await setLeadStatus(lead!.id, status);
    reload();
  }

  async function handleAssign(uid: string) {
    await assignLead(lead!.id, uid || null);
    reload();
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim() || !user) return;
    await addLeadNote(lead!.id, { text: noteText.trim(), by: user.uid });
    setNoteText("");
    reload();
  }

  const offerTitle = offer ? (isArabic ? offer.title_ar : offer.title_en || offer.title_ar) : null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href="/admin/leads"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy/60 hover:text-navy"
      >
        <BackIcon />
        {t("back")}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-navy">{lead.customer_name}</h1>
        <span
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${STATUS_STYLES[lead.status]}`}
        >
          {tStatus(lead.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2">
        <div>
          <div className="text-xs text-navy/50">{t("phone")}</div>
          <div className="text-navy" dir="ltr">
            {lead.phone}
          </div>
        </div>
        <div>
          <div className="text-xs text-navy/50">{t("source")}</div>
          <div className="text-navy">{tSource(lead.source)}</div>
        </div>
        <div>
          <div className="text-xs text-navy/50">{t("relatedOffer")}</div>
          <div className="text-navy">
            {offer ? (
              <Link href={`/admin/offers/${offer.id}/edit`} className="text-gold hover:underline">
                {offerTitle}
              </Link>
            ) : (
              t("none")
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-navy/50">{t("message")}</div>
          <div className="text-navy">{lead.message ?? t("none")}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2">
        <label className={labelClass}>
          {t("status")}
          <select
            className={inputClass}
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          {t("assignedTo")}
          <select
            className={inputClass}
            value={lead.assigned_to ?? ""}
            onChange={(e) => handleAssign(e.target.value)}
          >
            <option value="">—</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-heading font-bold text-navy">{t("notes")}</h2>
        {lead.notes.length === 0 && <p className="text-sm text-navy/50">{t("noNotes")}</p>}
        <ul className="flex flex-col gap-3">
          {lead.notes.map((n, i) => (
            <li key={i} className="rounded-lg bg-navy/[0.03] p-3 text-sm">
              <div className="text-navy">{n.text}</div>
              <div className="mt-1 text-xs text-navy/40">
                {staffById.get(n.by) ?? ""} · {new Date(n.at).toLocaleString(locale)}
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddNote} className="mt-4 flex gap-2">
          <input
            className={`${inputClass} flex-1`}
            placeholder={t("addNotePlaceholder")}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-navy transition-opacity hover:opacity-90"
          >
            {t("addNote")}
          </button>
        </form>
      </div>
    </div>
  );
}
