"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { listOffers } from "@/lib/offers";
import { listLeads } from "@/lib/leads";
import type { Lead, LeadStatus } from "@/lib/types";

interface Stats {
  publishedOffers: number;
  draftOffers: number;
  leadsByStatus: Record<LeadStatus, number>;
  recentLeads: Lead[];
}

const STATUS_ORDER: LeadStatus[] = [
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

export default function AdminDashboardPage() {
  const t = useTranslations("Dashboard");
  const tStatus = useTranslations("LeadStatus");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [offers, leads] = await Promise.all([listOffers(), listLeads()]);
      const leadsByStatus: Record<LeadStatus, number> = {
        new: 0,
        contacted: 0,
        interested: 0,
        not_interested: 0,
        closed_won: 0,
        closed_lost: 0,
      };
      for (const l of leads) leadsByStatus[l.status]++;

      setStats({
        publishedOffers: offers.filter((o) => o.status === "published").length,
        draftOffers: offers.filter((o) => o.status === "draft").length,
        leadsByStatus,
        recentLeads: leads.slice(0, 5),
      });
    })();
  }, []);

  if (!stats) return <p className="text-sm text-navy/50">{t("loading")}</p>;

  const totalLeads = Object.values(stats.leadsByStatus).reduce((a, b) => a + b, 0);
  const maxStatusCount = Math.max(1, ...Object.values(stats.leadsByStatus));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-2xl font-bold text-navy">{t("title")}</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon="M3 10.5 12 4l9 6.5M5 9.5V20h5v-6h4v6h5V9.5"
          label={t("publishedOffers")}
          value={stats.publishedOffers}
        />
        <StatCard
          icon="M4 6h16M4 12h16M4 18h10"
          label={t("draftOffers")}
          value={stats.draftOffers}
        />
        <StatCard
          icon="M12 5v14M5 12h14"
          label={t("newLeads")}
          value={stats.leadsByStatus.new}
          highlight
        />
        <StatCard
          icon="M16 11a4 4 0 1 0-4-4M8 11a3 3 0 1 0 0-6M2 20c0-3 2.5-5.5 6-5.5S14 17 14 20M12 20c0-2.5 2-4.5 5-4.5S22 17.5 22 20"
          label={t("totalLeads")}
          value={totalLeads}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-heading font-bold text-navy">{t("leadsByStatus")}</h2>
          <div className="flex flex-col gap-3">
            {STATUS_ORDER.map((s) => (
              <div key={s} className="flex items-center gap-3">
                <span
                  className={`w-32 shrink-0 rounded-full px-2.5 py-1 text-center text-xs font-medium ${STATUS_STYLES[s]}`}
                >
                  {tStatus(s)}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy/5">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{
                      width: `${(stats.leadsByStatus[s] / maxStatusCount) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-6 shrink-0 text-end text-sm font-medium text-navy">
                  {stats.leadsByStatus[s]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-heading font-bold text-navy">{t("recentLeads")}</h2>
          {stats.recentLeads.length === 0 ? (
            <p className="text-sm text-navy/50">{t("noLeadsYet")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-navy/5">
              {stats.recentLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-navy">{l.customer_name}</div>
                    <div className="text-xs text-navy/50">{l.phone}</div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[l.status]}`}
                  >
                    {tStatus(l.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: string;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          highlight ? "bg-gold text-navy" : "bg-navy/5 text-navy"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d={icon} />
        </svg>
      </div>
      <div>
        <div className="font-heading text-2xl font-bold text-navy">{value}</div>
        <div className="text-xs text-navy/50">{label}</div>
      </div>
    </div>
  );
}
