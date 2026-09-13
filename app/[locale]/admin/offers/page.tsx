"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { listOffers, setOfferStatus, deleteOffer } from "@/lib/offers";
import { useAuth } from "@/lib/auth-context";
import type { Offer } from "@/lib/types";

export default function AdminOffersPage() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setOffers(await listOffers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offers");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function togglePublish(offer: Offer) {
    if (!user) return;
    const next = offer.status === "published" ? "draft" : "published";
    await setOfferStatus(offer.id, next, user.uid);
    reload();
  }

  async function remove(offer: Offer) {
    if (!confirm(`Delete "${offer.title_en || offer.title_ar}"?`)) return;
    await deleteOffer(offer.id);
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Manage Offers</h1>
        <Link
          href="/admin/offers/new"
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          + New offer
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {offers === null && !error && <p className="text-sm text-gray-500">Loading…</p>}
      {offers?.length === 0 && <p className="text-sm text-gray-500">No offers yet.</p>}

      {offers && offers.length > 0 && (
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b text-start text-gray-500">
              <th className="py-2 text-start">Title</th>
              <th className="text-start">Type</th>
              <th className="text-start">City</th>
              <th className="text-start">Price</th>
              <th className="text-start">Status</th>
              <th className="text-start">Actions</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-b">
                <td className="py-2">{o.title_en || o.title_ar}</td>
                <td>{o.type}</td>
                <td>{o.city_en || o.city_ar}</td>
                <td>{o.price_from.toLocaleString()}</td>
                <td>{o.status}</td>
                <td className="flex gap-3 py-2">
                  <Link href={`/admin/offers/${o.id}/edit`} className="underline">
                    Edit
                  </Link>
                  <button onClick={() => togglePublish(o)} className="underline">
                    {o.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => remove(o)} className="text-red-600 underline">
                    Delete
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
