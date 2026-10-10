"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { listStaff, setStaffActive, setStaffRole, createStaffAccount } from "@/lib/staff-client";
import type { Staff, StaffRole } from "@/lib/types";

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
  lock: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-4V8a6 6 0 1 0-12 0v3m-1 0h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z",
  power: "M12 2v10M18.36 6.64a9 9 0 1 1-12.73 0",
};

const inputClass =
  "rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function AdminStaffPage() {
  const t = useTranslations("AdminStaff");
  const tRole = useTranslations("StaffRole");
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
      setError(t("formError"));
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-navy">{t("title")}</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-medium text-navy transition-opacity hover:opacity-90"
        >
          <Icon path={ICONS.plus} className="h-4 w-4" />
          {t("newStaff")}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="flex max-w-md flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm"
        >
          <input
            className={inputClass}
            placeholder={t("formName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder={t("formEmail")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder={t("formPassword")}
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            <option value="sales">{tRole("sales")}</option>
            <option value="manager">{tRole("manager")}</option>
            <option value="admin">{tRole("admin")}</option>
          </select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-navy transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {t("formCreate")}
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

      {staffList === null && <p className="text-sm text-navy/50">{t("loading")}</p>}

      {staffList && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-start text-sm">
            <thead>
              <tr className="border-b border-navy/5 text-start text-xs font-medium uppercase tracking-wide text-navy/40">
                <th className="px-5 py-3 text-start font-medium">{t("colStaff")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("colRole")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("colStatus")}</th>
                <th className="px-5 py-3 text-end font-medium">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {staffList.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-navy/[0.015]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 text-sm font-medium text-navy">
                        {initials(s.name)}
                      </div>
                      <div>
                        <div className="font-medium text-navy">{s.name}</div>
                        <div className="text-xs text-navy/50">{s.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="rounded-lg border border-navy/15 bg-white px-2.5 py-1.5 text-sm text-navy outline-none focus:border-gold"
                      value={s.role}
                      onChange={async (e) => {
                        await setStaffRole(s.id, e.target.value as StaffRole);
                        reload();
                      }}
                    >
                      <option value="sales">{tRole("sales")}</option>
                      <option value="manager">{tRole("manager")}</option>
                      <option value="admin">{tRole("admin")}</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        s.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {s.active ? t("active") : t("inactive")}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={async () => {
                          await setStaffActive(s.id, !s.active);
                          reload();
                        }}
                        title={s.active ? t("deactivate") : t("activate")}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/50 transition-colors hover:bg-navy/5 hover:text-navy"
                      >
                        <Icon path={ICONS.power} className="h-4 w-4" />
                      </button>
                    </div>
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
