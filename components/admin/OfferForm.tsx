"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { createOffer, updateOffer } from "@/lib/offers";
import { offerFormSchema, canPublishOffer, type OfferFormInput } from "@/lib/validators";
import type { Offer, OfferType } from "@/lib/types";

const OFFER_TYPES: OfferType[] = [
  "apartment",
  "villa",
  "floor",
  "townhouse",
  "land",
  "other",
];

type ImageRow = { url: string };

function toFormInput(offer?: Offer | null): OfferFormInput {
  return {
    title_ar: offer?.title_ar ?? "",
    title_en: offer?.title_en ?? "",
    type: offer?.type ?? "apartment",
    city_ar: offer?.city_ar ?? "",
    city_en: offer?.city_en ?? "",
    district_ar: offer?.district_ar ?? "",
    district_en: offer?.district_en ?? "",
    price_from: offer?.price_from ?? 0,
    price_to: offer?.price_to ?? null,
    area_from: offer?.area_from ?? 0,
    area_to: offer?.area_to ?? null,
    rooms: offer?.rooms ?? null,
    bathrooms: offer?.bathrooms ?? null,
    description_ar: offer?.description_ar ?? "",
    description_en: offer?.description_en ?? "",
    sold_percentage: offer?.sold_percentage ?? null,
    featured: offer?.featured ?? false,
  };
}

const inputClass =
  "rounded-lg border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-gold";
const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-navy/70";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 font-heading font-bold text-navy">{title}</h2>
      {hint && <p className="mb-4 text-xs text-navy/50">{hint}</p>}
      <div className={hint ? "flex flex-col gap-4" : "mt-4 flex flex-col gap-4"}>{children}</div>
    </div>
  );
}

export function OfferForm({ offer }: { offer?: Offer | null }) {
  const t = useTranslations("AdminOfferForm");
  const tType = useTranslations("Offers.types");
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<OfferFormInput>(toFormInput(offer));
  const [images, setImages] = useState<ImageRow[]>(
    offer?.images?.length ? offer.images.map((i) => ({ url: i.url })) : [{ url: "" }]
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function field<K extends keyof OfferFormInput>(key: K, value: OfferFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateImage(index: number, url: string) {
    setImages((rows) => rows.map((r, i) => (i === index ? { url } : r)));
  }

  function addImageRow() {
    setImages((rows) => [...rows, { url: "" }]);
  }

  function removeImageRow(index: number) {
    setImages((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit(publish: boolean) {
    if (!user) return;
    setError(null);

    const parsed = offerFormSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid form data");
      return;
    }

    const cleanImages = images
      .map((r, i) => ({ url: r.url.trim(), order: i }))
      .filter((r) => r.url);

    if (publish && !canPublishOffer({ ...parsed.data, images: cleanImages })) {
      setError(t("publishBlocked"));
      return;
    }

    setSubmitting(true);
    try {
      const status = publish ? "published" : "draft";
      if (offer) {
        await updateOffer(offer.id, { ...parsed.data, images: cleanImages }, status, user.uid);
      } else {
        await createOffer({ ...parsed.data, images: cleanImages }, status, user.uid);
      }
      router.push("/admin/offers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save offer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Section title={t("sectionBasics")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {t("titleAr")}
            <input
              className={inputClass}
              value={form.title_ar}
              onChange={(e) => field("title_ar", e.target.value)}
            />
          </label>
          <label className={labelClass}>
            {t("titleEn")}
            <input
              className={inputClass}
              value={form.title_en}
              onChange={(e) => field("title_en", e.target.value)}
            />
          </label>
        </div>
        <label className={labelClass}>
          {t("type")}
          <select
            className={inputClass}
            value={form.type}
            onChange={(e) => field("type", e.target.value as OfferType)}
          >
            {OFFER_TYPES.map((ot) => (
              <option key={ot} value={ot}>
                {tType(ot)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-navy/70">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => field("featured", e.target.checked)}
            className="h-4 w-4 accent-gold"
          />
          {t("featured")}
        </label>
      </Section>

      <Section title={t("sectionLocation")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {t("cityAr")}
            <input
              className={inputClass}
              value={form.city_ar}
              onChange={(e) => field("city_ar", e.target.value)}
            />
          </label>
          <label className={labelClass}>
            {t("cityEn")}
            <input
              className={inputClass}
              value={form.city_en}
              onChange={(e) => field("city_en", e.target.value)}
            />
          </label>
          <label className={labelClass}>
            {t("districtAr")}
            <input
              className={inputClass}
              value={form.district_ar}
              onChange={(e) => field("district_ar", e.target.value)}
            />
          </label>
          <label className={labelClass}>
            {t("districtEn")}
            <input
              className={inputClass}
              value={form.district_en}
              onChange={(e) => field("district_en", e.target.value)}
            />
          </label>
        </div>
      </Section>

      <Section title={t("sectionPricing")}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label className={labelClass}>
            {t("priceFrom")}
            <input
              type="number"
              className={inputClass}
              value={form.price_from}
              onChange={(e) => field("price_from", Number(e.target.value))}
            />
          </label>
          <label className={labelClass}>
            {t("priceTo")}
            <input
              type="number"
              className={inputClass}
              value={form.price_to ?? ""}
              onChange={(e) =>
                field("price_to", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </label>
          <label className={labelClass}>
            {t("areaFrom")}
            <input
              type="number"
              className={inputClass}
              value={form.area_from}
              onChange={(e) => field("area_from", Number(e.target.value))}
            />
          </label>
          <label className={labelClass}>
            {t("areaTo")}
            <input
              type="number"
              className={inputClass}
              value={form.area_to ?? ""}
              onChange={(e) =>
                field("area_to", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </label>
          <label className={labelClass}>
            {t("rooms")}
            <input
              type="number"
              className={inputClass}
              value={form.rooms ?? ""}
              onChange={(e) =>
                field("rooms", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </label>
          <label className={labelClass}>
            {t("bathrooms")}
            <input
              type="number"
              className={inputClass}
              value={form.bathrooms ?? ""}
              onChange={(e) =>
                field("bathrooms", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </label>
          <label className={labelClass}>
            {t("soldPercentage")}
            <input
              type="number"
              className={inputClass}
              value={form.sold_percentage ?? ""}
              onChange={(e) =>
                field(
                  "sold_percentage",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            />
          </label>
        </div>
      </Section>

      <Section title={t("sectionDescription")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {t("descriptionAr")}
            <textarea
              rows={4}
              className={inputClass}
              value={form.description_ar}
              onChange={(e) => field("description_ar", e.target.value)}
            />
          </label>
          <label className={labelClass}>
            {t("descriptionEn")}
            <textarea
              rows={4}
              className={inputClass}
              value={form.description_en}
              onChange={(e) => field("description_en", e.target.value)}
            />
          </label>
        </div>
      </Section>

      <Section title={t("sectionImages")} hint={t("imagesHint")}>
        {images.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={`${inputClass} flex-1`}
              placeholder="https://..."
              value={row.url}
              onChange={(e) => updateImage(i, e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeImageRow(i)}
              className="rounded-lg border border-navy/15 px-3 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              {t("removeImage")}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addImageRow}
          className="self-start text-sm font-medium text-gold hover:underline"
        >
          + {t("addImage")}
        </button>
      </Section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pb-4">
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit(false)}
          className="rounded-full border border-navy/20 px-5 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5 disabled:opacity-50"
        >
          {t("saveDraft")}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit(true)}
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-navy transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("savePublish")}
        </button>
      </div>
    </div>
  );
}
