"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { OfferForm } from "@/components/admin/OfferForm";
import { getOffer } from "@/lib/offers";
import type { Offer } from "@/lib/types";

export default function EditOfferPage() {
  const t = useTranslations("AdminOfferForm");
  const tOffers = useTranslations("AdminOffers");
  const params = useParams<{ id: string }>();
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined);

  useEffect(() => {
    getOffer(params.id).then(setOffer);
  }, [params.id]);

  if (offer === undefined) return <p className="text-sm text-navy/50">{tOffers("loading")}</p>;
  if (offer === null) return <p className="text-sm text-red-600">{t("notFound")}</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-bold text-navy">{t("editTitle")}</h1>
      <OfferForm offer={offer} />
    </div>
  );
}
