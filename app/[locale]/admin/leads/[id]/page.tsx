"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [noteText, setNoteText] = useState("");

  async function reload() {
    const l = await getLead(params.id);
    setLead(l);
    if (l?.related_offer_id) setOffer(await getOffer(l.related_offer_id));
  }

  useEffect(() => {
    reload();
    listStaff().then(setStaff);
  }, [params.id]);

  if (lead === undefined) return <p className="text-sm text-gray-500">Loading…</p>;
  if (lead === null) return <p className="text-sm text-red-600">Lead not found.</p>;

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

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-bold">{lead.customer_name}</h1>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Phone: </span>
          {lead.phone}
        </div>
        <div>
          <span className="text-gray-500">Source: </span>
          {lead.source}
        </div>
        <div>
          <span className="text-gray-500">Related offer: </span>
          {offer ? offer.title_en || offer.title_ar : "—"}
        </div>
        <div>
          <span className="text-gray-500">Message: </span>
          {lead.message ?? "—"}
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            className="rounded border px-3 py-2"
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Assigned to
          <select
            className="rounded border px-3 py-2"
            value={lead.assigned_to ?? ""}
            onChange={(e) => handleAssign(e.target.value)}
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Notes</h2>
        {lead.notes.length === 0 && (
          <p className="text-sm text-gray-500">No notes yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {lead.notes.map((n, i) => (
            <li key={i} className="rounded border p-2 text-sm">
              <div>{n.text}</div>
              <div className="text-xs text-gray-500">
                {new Date(n.at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddNote} className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="Add a follow-up note…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
