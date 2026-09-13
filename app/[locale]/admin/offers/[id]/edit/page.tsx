"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OfferForm } from "@/components/admin/OfferForm";
import { getOffer } from "@/lib/offers";
import type { Offer } from "@/lib/types";

export default function EditOfferPage() {
  const params = useParams<{ id: string }>();
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined);

  useEffect(() => {
    getOffer(params.id).then(setOffer);
  }, [params.id]);

  if (offer === undefined) return <p className="text-sm text-gray-500">Loading…</p>;
  if (offer === null) return <p className="text-sm text-red-600">Offer not found.</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Edit Offer</h1>
      <OfferForm offer={offer} />
    </div>
  );
}
