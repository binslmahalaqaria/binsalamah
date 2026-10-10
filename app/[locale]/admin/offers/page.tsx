"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listOffers, setOfferStatus, deleteOffer } from "@/lib/offers";
import { useAuth } from "@/lib/auth-context";
import type { Offer, OfferStatus } from "@/lib/types";

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4"}
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  edit: "M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff:
    "M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a15.4 15.4 0 0 1-3.1 4.1M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3.4-.6",
  trash:
    "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z",
  plus: "M12 5v14M5 12h14",
  building: "M3 10.5 12 4l9 6.5M5 9.5V20h5v-6h4v6h5V9.5",
};

const STATUS_STYLES: Record<OfferStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-100 text-green-700",
  archived: "bg-navy/10 text-navy/60",
};

export default function AdminOffersPage() {
  const t = useTranslations("AdminOffers");
  const tType = useTranslations("Offers.types");
  const tStatus = useTranslations("OfferStatus");
  const locale = useLocale();
  const isArabic = locale === "ar";
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
    const title = offer.title_en || offer.title_ar;
    if (!confirm(t("deleteConfirm", { title }))) return;
    await deleteOffer(offer.id);
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-navy">{t("title")}</h1>
        <Link
          href="/admin/offers/new"
          className="flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-medium text-navy transition-opacity hover:opacity-90"
        >
          <Icon path={ICONS.plus} />
          {t("newOffer")}
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {offers === null && !error && <p className="text-sm text-navy/50">{t("loading")}</p>}

      {offers?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 text-navy/40">
            <Icon path={ICONS.building} className="h-6 w-6" />
          </div>
          <h2 className="font-heading font-bold text-navy">{t("emptyTitle")}</h2>
          <p className="max-w-xs text-sm text-navy/50">{t("emptyBody")}</p>
          <Link
            href="/admin/offers/new"
            className="mt-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-navy transition-opacity hover:opacity-90"
          >
            {t("newOffer")}
          </Link>
        </div>
      )}

      {offers && offers.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead>
              <tr className="border-b border-navy/5 text-start text-xs font-medium uppercase tracking-wide text-navy/40">
                <th className="px-5 py-3 text-start font-medium">{t("colOffer")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("colType")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("colPrice")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("colStatus")}</th>
                <th className="px-5 py-3 text-end font-medium">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {offers.map((o) => {
                const title = isArabic ? o.title_ar : o.title_en || o.title_ar;
                const city = isArabic ? o.city_ar : o.city_en || o.city_ar;
                return (
                  <tr key={o.id} className="transition-colors hover:bg-navy/[0.015]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-navy/5">
                          {o.cover_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={o.cover_image}
                              alt={title}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div>
                          <div className="font-medium text-navy">{title}</div>
                          <div className="text-xs text-navy/50">{city}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-navy/70">{tType(o.type)}</td>
                    <td className="px-3 py-3 text-navy/70">
                      {o.price_from.toLocaleString("en-US")}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[o.status]}`}
                      >
                        {tStatus(o.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/offers/${o.id}/edit`}
                          title={t("edit")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/50 transition-colors hover:bg-navy/5 hover:text-navy"
                        >
                          <Icon path={ICONS.edit} />
                        </Link>
                        <button
                          onClick={() => togglePublish(o)}
                          title={o.status === "published" ? t("unpublish") : t("publish")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/50 transition-colors hover:bg-navy/5 hover:text-navy"
                        >
                          <Icon path={o.status === "published" ? ICONS.eyeOff : ICONS.eye} />
                        </button>
                        <button
                          onClick={() => remove(o)}
                          title={t("delete")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/50 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Icon path={ICONS.trash} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
