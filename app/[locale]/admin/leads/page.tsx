"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listLeads, createManualLead } from "@/lib/leads";
import { listStaff } from "@/lib/staff-client";
import type { Lead, LeadStatus, Staff } from "@/lib/types";

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
  plus: "M12 5v14M5 12h14",
  leads:
    "M16 11a4 4 0 1 0-4-4M8 11a3 3 0 1 0 0-6M2 20c0-3 2.5-5.5 6-5.5S14 17 14 20M12 20c0-2.5 2-4.5 5-4.5S22 17.5 22 20",
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-navy/10 text-navy",
  contacted: "bg-gold/25 text-navy",
  interested: "bg-gold/50 text-navy",
  not_interested: "bg-gray-200 text-gray-600",
  closed_won: "bg-green-100 text-green-700",
  closed_lost: "bg-red-100 text-red-700",
};

const SOURCE_STYLES: Record<string, string> = {
  website_interest: "bg-navy/10 text-navy",
  whatsapp: "bg-green-100 text-green-700",
  phone_call: "bg-gold/25 text-navy",
  manual: "bg-gray-100 text-gray-600",
  other: "bg-gray-100 text-gray-600",
};

export default function AdminLeadsPage() {
  const t = useTranslations("AdminLeads");
  const tStatus = useTranslations("LeadStatus");
  const tSource = useTranslations("LeadSource");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const staffById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [staff]);

  async function reload() {
    setLeads(await listLeads());
  }

  useEffect(() => {
    reload();
    listStaff().then(setStaff);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError(t("formError"));
      return;
    }
    try {
      await createManualLead({
        customer_name: name.trim(),
        phone: phone.trim(),
        message: message.trim() || undefined,
        source: "phone_call",
      });
      setName("");
      setPhone("");
      setMessage("");
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-navy">{t("title")}</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-medium text-navy transition-opacity hover:opacity-90"
        >
          <Icon path={ICONS.plus} className="h-4 w-4" />
          {t("logCall")}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="flex max-w-md flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm"
        >
          <input
            className="rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold"
            placeholder={t("formName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold"
            placeholder={t("formPhone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <textarea
            className="rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold"
            placeholder={t("formMessage")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-navy transition-opacity hover:opacity-90"
            >
              {t("formSave")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-navy/20 px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      {leads === null && <p className="text-sm text-navy/50">{t("loading")}</p>}

      {leads?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 text-navy/40">
            <Icon path={ICONS.leads} className="h-6 w-6" />
          </div>
          <h2 className="font-heading font-bold text-navy">{t("emptyTitle")}</h2>
          <p className="max-w-sm text-sm text-navy/50">{t("emptyBody")}</p>
        </div>
      )}

      {leads && leads.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead>
              <tr className="border-b border-navy/5 text-start text-xs font-medium uppercase tracking-wide text-navy/40">
                <th className="px-5 py-3 text-start font-medium">{t("colCustomer")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("colSource")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("colStatus")}</th>
                <th className="px-5 py-3 text-start font-medium">{t("colAssigned")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {leads.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-navy/[0.015]">
                  <td className="px-5 py-3">
                    <Link href={`/admin/leads/${l.id}`} className="block">
                      <div className="font-medium text-navy">{l.customer_name}</div>
                      <div className="text-xs text-navy/50" dir="ltr">
                        {l.phone}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${SOURCE_STYLES[l.source]}`}
                    >
                      {tSource(l.source)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[l.status]}`}
                    >
                      {tStatus(l.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-navy/70">
                    {l.assigned_to ? staffById.get(l.assigned_to) ?? "—" : t("unassigned")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
