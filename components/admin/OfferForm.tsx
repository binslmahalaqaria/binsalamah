"use client";

import { useState } from "react";
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

export function OfferForm({ offer }: { offer?: Offer | null }) {
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
      setError(
        "To publish, fill in the English title/city/district/description and add at least one image."
      );
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
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Title (Arabic)
          <input
            className="rounded border px-3 py-2"
            value={form.title_ar}
            onChange={(e) => field("title_ar", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Title (English)
          <input
            className="rounded border px-3 py-2"
            value={form.title_en}
            onChange={(e) => field("title_en", e.target.value)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          className="rounded border px-3 py-2"
          value={form.type}
          onChange={(e) => field("type", e.target.value as OfferType)}
        >
          {OFFER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          City (Arabic)
          <input
            className="rounded border px-3 py-2"
            value={form.city_ar}
            onChange={(e) => field("city_ar", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          City (English)
          <input
            className="rounded border px-3 py-2"
            value={form.city_en}
            onChange={(e) => field("city_en", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          District (Arabic)
          <input
            className="rounded border px-3 py-2"
            value={form.district_ar}
            onChange={(e) => field("district_ar", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          District (English)
          <input
            className="rounded border px-3 py-2"
            value={form.district_en}
            onChange={(e) => field("district_en", e.target.value)}
          />
        </label>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Price from
          <input
            type="number"
            className="rounded border px-3 py-2"
            value={form.price_from}
            onChange={(e) => field("price_from", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Price to
          <input
            type="number"
            className="rounded border px-3 py-2"
            value={form.price_to ?? ""}
            onChange={(e) =>
              field("price_to", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Area from (m²)
          <input
            type="number"
            className="rounded border px-3 py-2"
            value={form.area_from}
            onChange={(e) => field("area_from", Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Area to (m²)
          <input
            type="number"
            className="rounded border px-3 py-2"
            value={form.area_to ?? ""}
            onChange={(e) =>
              field("area_to", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Rooms
          <input
            type="number"
            className="rounded border px-3 py-2"
            value={form.rooms ?? ""}
            onChange={(e) =>
              field("rooms", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bathrooms
          <input
            type="number"
            className="rounded border px-3 py-2"
            value={form.bathrooms ?? ""}
            onChange={(e) =>
              field("bathrooms", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Sold %
          <input
            type="number"
            className="rounded border px-3 py-2"
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

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Description (Arabic)
          <textarea
            rows={4}
            className="rounded border px-3 py-2"
            value={form.description_ar}
            onChange={(e) => field("description_ar", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description (English)
          <textarea
            rows={4}
            className="rounded border px-3 py-2"
            value={form.description_en}
            onChange={(e) => field("description_en", e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.featured}
          onChange={(e) => field("featured", e.target.checked)}
        />
        Featured on homepage
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Image URLs (Storage upload isn&apos;t enabled yet — paste hosted image links for now)
        </span>
        {images.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="https://..."
              value={row.url}
              onChange={(e) => updateImage(i, e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeImageRow(i)}
              className="rounded border px-3 text-sm text-red-600"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addImageRow}
          className="self-start text-sm underline"
        >
          + Add image
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit(false)}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          Save as draft
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit(true)}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Save & publish
        </button>
      </div>
    </div>
  );
}
