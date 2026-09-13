"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getCompanySettings, updateCompanySettings } from "@/lib/settings";

export default function AdminSettingsPage() {
  const { user, staff } = useAuth();
  const isAdmin = staff?.role === "admin";

  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getCompanySettings().then((s) => {
      if (s) {
        setWhatsapp(s.whatsapp_number);
        setEmail(s.contact_email ?? "");
        setPhone(s.contact_phone ?? "");
      }
      setLoaded(true);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await updateCompanySettings(
      {
        whatsapp_number: whatsapp.trim(),
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
      },
      user.uid
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!isAdmin) {
    return <p className="text-sm text-gray-500">Settings are admin-only.</p>;
  }
  if (!loaded) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <form onSubmit={handleSave} className="flex max-w-md flex-col gap-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <label className="flex flex-col gap-1 text-sm">
        WhatsApp number (e.g. 9665XXXXXXXX)
        <input
          className="rounded border px-3 py-2"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contact email
        <input
          className="rounded border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contact phone
        <input
          className="rounded border px-3 py-2"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      <button type="submit" className="self-start rounded bg-black px-4 py-2 text-sm text-white">
        Save
      </button>
      {saved && <p className="text-sm text-green-600">Saved.</p>}
    </form>
  );
}
