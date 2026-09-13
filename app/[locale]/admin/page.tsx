"use client";

import { useEffect, useState } from "react";
import { listOffers } from "@/lib/offers";
import { listLeads } from "@/lib/leads";
import type { Lead, LeadStatus } from "@/lib/types";

interface Stats {
  publishedOffers: number;
  draftOffers: number;
  leadsByStatus: Record<LeadStatus, number>;
  recentLeads: Lead[];
}

export default function AdminDashboardPage() {
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

  if (!stats) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Published offers" value={stats.publishedOffers} />
        <StatCard label="Draft offers" value={stats.draftOffers} />
        <StatCard label="New leads" value={stats.leadsByStatus.new} />
        <StatCard
          label="Total leads"
          value={Object.values(stats.leadsByStatus).reduce((a, b) => a + b, 0)}
        />
      </div>

      <div>
        <h2 className="mb-2 font-medium">Leads by status</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {(Object.keys(stats.leadsByStatus) as LeadStatus[]).map((s) => (
            <li key={s}>
              {s}: {stats.leadsByStatus[s]}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Recent leads</h2>
        {stats.recentLeads.length === 0 && (
          <p className="text-sm text-gray-500">No leads yet.</p>
        )}
        <ul className="flex flex-col gap-1 text-sm">
          {stats.recentLeads.map((l) => (
            <li key={l.id}>
              {l.customer_name} — {l.status}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}
