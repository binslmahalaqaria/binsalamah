"use client";

/**
 * New website offer, optionally started from a CRM property (`?from=<propertyId>`):
 * name, type, district, price, area, rooms, photos, features and units are copied
 * into the form, so a property is entered once and only reviewed before publishing.
 */
import { useSearchParams } from "next/navigation";
import { useCrm } from "@/lib/crm/store";
import { toOffer } from "@/lib/crm/offer-from-property";
import { OfferForm } from "./OfferForm";

export function OfferFromProperty() {
  const id = useSearchParams().get("from");
  const { data, loaded } = useCrm();
  if (!id) return <OfferForm />;
  if (!loaded) return <p className="text-sm text-navy/50">جارٍ تحميل بيانات العقار…</p>;
  const p = data.props.find((x) => x.id === id);
  if (!p) return <OfferForm />;
  return (
    <>
      <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm text-navy">
        نُقلت بيانات «{p.title}» من العقارات. راجعها وأضف الوصف والصور إن لزم، ثم احفظ وانشر.
      </p>
      <OfferForm key={id} prefill={toOffer(p)} />
    </>
  );
}
