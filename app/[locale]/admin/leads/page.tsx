"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { listLeads, createManualLead } from "@/lib/leads";
import type { Lead } from "@/lib/types";

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLeads(await listLeads());
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required");
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Manage Leads</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          + Log a call
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex max-w-md flex-col gap-3 rounded border p-4">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Customer name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <textarea
            className="rounded border px-3 py-2 text-sm"
            placeholder="Notes (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="self-start rounded bg-black px-4 py-2 text-sm text-white">
            Save lead
          </button>
        </form>
      )}

      {leads === null && <p className="text-sm text-gray-500">Loading…</p>}
      {leads?.length === 0 && <p className="text-sm text-gray-500">No leads yet.</p>}

      {leads && leads.length > 0 && (
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b text-start text-gray-500">
              <th className="py-2 text-start">Name</th>
              <th className="text-start">Phone</th>
              <th className="text-start">Source</th>
              <th className="text-start">Status</th>
              <th className="text-start">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-2">
                  <Link href={`/admin/leads/${l.id}`} className="underline">
                    {l.customer_name}
                  </Link>
                </td>
                <td>{l.phone}</td>
                <td>{l.source}</td>
                <td>{l.status}</td>
                <td>{l.assigned_to ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
