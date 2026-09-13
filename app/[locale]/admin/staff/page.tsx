"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listStaff, setStaffActive, setStaffRole, createStaffAccount } from "@/lib/staff-client";
import type { Staff, StaffRole } from "@/lib/types";

export default function AdminStaffPage() {
  const { user, staff: currentStaff } = useAuth();
  const isAdmin = currentStaff?.role === "admin";

  const [staffList, setStaffList] = useState<Staff[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("sales");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setStaffList(await listStaff());
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) return;
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Name, email, and a password of at least 6 characters are required");
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      await createStaffAccount(idToken, { name: name.trim(), email: email.trim(), password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("sales");
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create staff account");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) {
    return <p className="text-sm text-gray-500">Staff management is admin-only.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Staff</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          + New staff
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex max-w-md flex-col gap-3 rounded border p-4">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Temporary password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className="rounded border px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            <option value="sales">sales</option>
            <option value="admin">admin</option>
          </select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Create account
          </button>
        </form>
      )}

      {staffList === null && <p className="text-sm text-gray-500">Loading…</p>}

      {staffList && (
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b text-start text-gray-500">
              <th className="py-2 text-start">Name</th>
              <th className="text-start">Email</th>
              <th className="text-start">Role</th>
              <th className="text-start">Active</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="py-2">{s.name}</td>
                <td>{s.email}</td>
                <td>
                  <select
                    className="rounded border px-2 py-1"
                    value={s.role}
                    onChange={async (e) => {
                      await setStaffRole(s.id, e.target.value as StaffRole);
                      reload();
                    }}
                  >
                    <option value="sales">sales</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>
                  <button
                    onClick={async () => {
                      await setStaffActive(s.id, !s.active);
                      reload();
                    }}
                    className="underline"
                  >
                    {s.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
