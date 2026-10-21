"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { createOffer, updateOffer } from "@/lib/offers";
import { fillEnglish } from "@/lib/translate-offer";
import { uploadOfferImage } from "@/lib/upload-image";
import { allDistricts } from "@/lib/districts";
import { offerFormSchema, canPublishOffer, deriveFromUnits, type OfferFormInput } from "@/lib/validators";
import type { Offer, OfferType, OfferUnit, ProjectStage, UnitStatus } from "@/lib/types";

const UNIT_STATUS: { v: UnitStatus; ar: string }[] = [{ v: "available", ar: "متاح" }, { v: "reserved", ar: "محجوز" }, { v: "sold", ar: "مباع" }];
/** Quick names for common units — the owner can still type any name. */
const UNIT_NAMES = ["دور أرضي", "دور أول", "دور ثاني", "ملحق", "شقة", "فيلا", "تاون هاوس", "بنتهاوس"];
const emptyUnit = (): OfferUnit => ({ name: "", area: 0, price: 0, rooms: null, living_rooms: null, bathrooms: null, status: "available" });
const STAGES: { v: ProjectStage; ar: string }[] = [{ v: "ready", ar: "جاهز للسكن" }, { v: "under_construction", ar: "تحت الإنشاء" }, { v: "off_plan", ar: "بيع على الخارطة" }];
const FEATURE_PRESETS = ["نظام منزل ذكي", "مصعد خاص", "مسبح خاص", "مدخل مستقل", "سطح خاص", "حديقة خاصة", "غرفة سائق", "غرفة خادمة", "موقف خاص", "مواقف مظللة", "تكييف مركزي", "عزل حراري", "كاميرات مراقبة", "مطبخ راكب", "قريب من الخدمات", "واجهة حجر"];

const OFFER_TYPES: OfferType[] = [
  "villa",
  "apartment",
  "floor",
  "penthouse",
  "townhouse",
  "land",
  "other",
];

type ImageRow = { url: string };

/**
 * When an Arabic field was edited but its English was not, the old English no longer matches:
 * clear it so it is translated again on save. English the owner edited is kept.
 */
function staleEnglishCleared(o: OfferFormInput, prev?: Offer | null): OfferFormInput {
  if (!prev) return o;
  const pairs = [["title_ar", "title_en"], ["city_ar", "city_en"], ["district_ar", "district_en"], ["description_ar", "description_en"],
    ["developer", "developer_en"], ["handover", "handover_en"], ["warranties_text", "warranties_text_en"]] as const;
  const out = { ...o } as Record<string, unknown>;
  const was = prev as unknown as Record<string, unknown>;
  for (const [ar, en] of pairs) if ((o[ar] ?? "") !== (was[ar] ?? "") && (o[en] ?? "") === (was[en] ?? "")) out[en] = "";
  if (JSON.stringify(o.features) !== JSON.stringify(prev.features ?? [])) out.features_en = [];
  out.units = (o.units ?? []).map((u) => {
    const old = (prev.units ?? []).find((x) => x.name === u.name);
    return old ? { ...u, name_en: u.name_en || old.name_en || "" } : { ...u, name_en: "" };
  });
  return out as OfferFormInput;
}

function toFormInput(offer?: Offer | null): OfferFormInput {
  return {
    title_ar: offer?.title_ar ?? "",
    title_en: offer?.title_en ?? "",
    type: offer?.type ?? "villa",
    city_ar: offer?.city_ar ?? "الرياض",
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
    units: offer?.units ?? [],
    living_rooms: offer?.living_rooms ?? null,
    developer: offer?.developer ?? "",
    developer_en: offer?.developer_en ?? "",
    stage: offer?.stage ?? null,
    handover: offer?.handover ?? "",
    handover_en: offer?.handover_en ?? "",
    warranties_text: offer?.warranties_text ?? (offer?.warranties?.length ? offer.warranties.map((w) => w.item + ": " + w.years + " سنوات").join("\n") : ""),
    warranties_text_en: offer?.warranties_text_en ?? "",
    features: offer?.features ?? [],
    features_en: offer?.features_en ?? [],
    map_url: offer?.map_url ?? "",
    brochure_url: offer?.brochure_url ?? "",
    video_url: offer?.video_url ?? "",
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

/** `prefill`: a new offer started from a CRM property (العقارات → «اعرضه في الموقع»); still saved as a new offer. */
export function OfferForm({ offer, prefill }: { offer?: Offer | null; prefill?: Offer | null }) {
  const t = useTranslations("AdminOfferForm");
  const tType = useTranslations("Offers.types");
  const router = useRouter();
  const { user } = useAuth();
  const start = offer ?? prefill;
  const [form, setForm] = useState<OfferFormInput>(toFormInput(start));
  const [images, setImages] = useState<ImageRow[]>(
    start?.images?.length ? start.images.map((i) => ({ url: i.url })) : [{ url: "" }]
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function field<K extends keyof OfferFormInput>(key: K, value: OfferFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const units = form.units ?? [];
  const setUnit = (i: number, p: Partial<OfferUnit>) => field("units", units.map((u, j) => (j === i ? { ...u, ...p } : u)));
  // Digits only (Arabic-Indic ٠-٩ accepted); empty means 0.
  const num = (v: string) => {
    const d = v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[^\d.]/g, "");
    return d === "" ? 0 : Number(d);
  };
  const derived = deriveFromUnits(form);
  const features = form.features ?? [];
  const [newFeature, setNewFeature] = useState("");
  const toggleFeature = (x: string) => field("features", features.includes(x) ? features.filter((y) => y !== x) : [...features, x]);
  const addFeature = () => { const v = newFeature.trim(); if (v && !features.includes(v)) field("features", [...features, v]); setNewFeature(""); };

  const [uploading, setUploading] = useState(0);
  // Upload photos from the device; each becomes an image row (the first one is the cover).
  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files);
    setUploading(list.length);
    for (const file of list) {
      try {
        const { url } = await uploadOfferImage(file);
        setImages((rows) => [...rows.filter((r) => r.url.trim()), { url }]);
      } catch (e) {
        setError("تعذّر رفع الصورة " + file.name + (e instanceof Error && /unauthorized|permission/i.test(e.message) ? " — صلاحيات التخزين غير مفعّلة" : ""));
      } finally {
        setUploading((n) => n - 1);
      }
    }
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

    const parsed = offerFormSchema.safeParse(deriveFromUnits(form));
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
      // English for the English site: empty English fields are translated from the Arabic before saving.
      const data = await fillEnglish(staleEnglishCleared(parsed.data, offer), await user.getIdToken());
      if (offer) {
        await updateOffer(offer.id, { ...data, images: cleanImages }, status, user.uid);
      } else {
        await createOffer({ ...data, images: cleanImages, ...(prefill?.property_id ? { property_id: prefill.property_id } : {}) }, status, user.uid);
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
      {/* Essentials only; everything optional sits in «تفاصيل إضافية» below (owner asked for a shorter form). */}
      <Section title="بيانات العقار">
        <label className={labelClass}>
          اسم العقار
          <input className={inputClass} placeholder="مثال: فلل الملقا 7" value={form.title_ar} onChange={(e) => field("title_ar", e.target.value)} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {t("type")}
            <select className={inputClass} value={form.type} onChange={(e) => field("type", e.target.value as OfferType)}>
              {OFFER_TYPES.map((ot) => <option key={ot} value={ot}>{tType(ot)}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            {t("districtAr")}
            <input className={inputClass} value={form.district_ar} onChange={(e) => field("district_ar", e.target.value)} list="offer-districts" placeholder="مثال: الملقا" />
            <datalist id="offer-districts">{allDistricts().map((d) => <option key={d} value={d} />)}</datalist>
          </label>
        </div>
        <label className={labelClass}>
          الوصف
          <textarea rows={3} className={inputClass} placeholder="سطرين عن العقار وموقعه ومميزاته" value={form.description_ar} onChange={(e) => field("description_ar", e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-navy/70">
          <input type="checkbox" checked={form.featured} onChange={(e) => field("featured", e.target.checked)} className="h-4 w-4 accent-gold" />
          {t("featured")}
        </label>
      </Section>

      <Section title={t("sectionImages")} hint="ارفع الصور من جهازك أو جوالك — الصورة الأولى هي الغلاف. تُصغَّر تلقائياً لتبقى سرعة الموقع عالية.">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy/20 px-4 py-6 text-sm font-medium text-navy transition-colors hover:border-navy/50 hover:bg-navy/[0.02]">
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
          {uploading ? "جارٍ رفع " + uploading + " صورة…" : "📷 رفع صور"}
        </label>
        {images.some((r) => r.url.trim()) && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {images.filter((r) => r.url.trim()).map((r, i) => (
              <div key={r.url + i} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-navy/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute start-1 top-1 rounded bg-navy/80 px-1.5 text-[10px] text-cream">الغلاف</span>}
                <button type="button" aria-label="حذف" onClick={() => setImages((rows) => rows.filter((x) => x.url !== r.url))} className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs text-red-600 shadow">×</button>
                {i > 0 && <button type="button" onClick={() => setImages((rows) => { const rest = rows.filter((x) => x.url !== r.url); return [r, ...rest]; })} className="absolute bottom-1 start-1 rounded bg-white/90 px-1.5 text-[10px] text-navy shadow">اجعلها الغلاف</button>}
              </div>
            ))}
          </div>
        )}
        <details className="text-xs text-navy/60">
          <summary className="cursor-pointer">أو ألصق رابط صورة</summary>
          <div className="mt-2 grid gap-2">
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
          </div>
        </details>
      </Section>


      <Section title="الوحدات" hint="أضف كل وحدة بسعرها ومساحتها وحالتها (مثال: دور أرضي، دور أول، ملحق). عند إضافة وحدات تُحسب الأسعار والمساحات ونسبة البيع تلقائياً.">
        {units.map((u, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-navy/10 p-3 sm:grid-cols-[1.4fr_1fr_1.2fr_.6fr_.6fr_.6fr_1fr_auto]">
            <input className={inputClass} list="unit-names" placeholder="اسم الوحدة" value={u.name} onChange={(e) => setUnit(i, { name: e.target.value })} />
            <input className={inputClass} inputMode="decimal" placeholder="المساحة م²" value={u.area || ""} onChange={(e) => setUnit(i, { area: num(e.target.value) })} />
            <input className={inputClass} inputMode="decimal" placeholder="السعر (ريال)" value={u.price || ""} onChange={(e) => setUnit(i, { price: num(e.target.value) })} />
            <input className={inputClass} inputMode="numeric" placeholder="غرف" value={u.rooms ?? ""} onChange={(e) => setUnit(i, { rooms: num(e.target.value) || null })} />
            <input className={inputClass} inputMode="numeric" placeholder="صالات" value={u.living_rooms ?? ""} onChange={(e) => setUnit(i, { living_rooms: num(e.target.value) || null })} />
            <input className={inputClass} inputMode="numeric" placeholder="دورات" value={u.bathrooms ?? ""} onChange={(e) => setUnit(i, { bathrooms: num(e.target.value) || null })} />
            <select className={inputClass} value={u.status} onChange={(e) => setUnit(i, { status: e.target.value as UnitStatus })}>
              {UNIT_STATUS.map((x) => <option key={x.v} value={x.v}>{x.ar}</option>)}
            </select>
            <button type="button" onClick={() => field("units", units.filter((_, j) => j !== i))} className="rounded-lg border border-navy/15 px-3 text-sm text-red-600 hover:bg-red-50">حذف</button>
          </div>
        ))}
        <datalist id="unit-names">{UNIT_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => field("units", [...units, emptyUnit()])} className="text-sm font-medium text-gold hover:underline">+ إضافة وحدة</button>
          {units.length > 0 && (
            <span className="text-xs text-navy/50">
              {units.filter((u) => u.status === "available").length} متاحة من {units.length} — السعر من {derived.price_from.toLocaleString("en-US")}{derived.price_to ? " إلى " + derived.price_to.toLocaleString("en-US") : ""} — مباع {derived.sold_percentage ?? 0}%
            </span>
          )}
        </div>
      </Section>

      {units.length === 0 && (
        <Section title="السعر والمساحة" hint="عند إضافة وحدات أعلاه تُحسب تلقائياً ولا تحتاج تعبئتها.">
          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              السعر (ريال)
              <input className={inputClass} inputMode="decimal" value={form.price_from || ""} onChange={(e) => field("price_from", num(e.target.value))} />
            </label>
            <label className={labelClass}>
              المساحة (م²)
              <input className={inputClass} inputMode="decimal" value={form.area_from || ""} onChange={(e) => field("area_from", num(e.target.value))} />
            </label>
          </div>
        </Section>
      )}

      <details className="group rounded-2xl bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between p-6 font-heading font-bold text-navy">
          تفاصيل إضافية (اختياري)
          <span className="text-sm font-normal text-navy/50 group-open:hidden">المطوّر، الضمانات، المميزات، الروابط، الإنجليزي…</span>
        </summary>
        <div className="flex flex-col gap-5 px-2 pb-4">
      <Section title="تفاصيل المشروع" hint="تظهر في صفحة العقار على الموقع.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>المطوّر
            <input className={inputClass} value={form.developer ?? ""} onChange={(e) => field("developer", e.target.value)} />
          </label>
          <label className={labelClass}>حالة المشروع
            <select className={inputClass} value={form.stage ?? ""} onChange={(e) => field("stage", (e.target.value || null) as ProjectStage | null)}>
              <option value="">—</option>
              {STAGES.map((x) => <option key={x.v} value={x.v}>{x.ar}</option>)}
            </select>
          </label>
          <label className={labelClass}>موعد التسليم
            <input className={inputClass} placeholder="مثال: الربع الثاني 2027" value={form.handover ?? ""} onChange={(e) => field("handover", e.target.value)} />
          </label>
          <label className={labelClass}>عدد الصالات (عند عدم إضافة وحدات)
            <input className={inputClass} inputMode="numeric" value={derived.living_rooms ?? ""} disabled={units.length > 0} onChange={(e) => field("living_rooms", num(e.target.value) || null)} />
          </label>
        </div>

        <label className={labelClass}>الضمانات
          <textarea rows={5} className={inputClass} value={form.warranties_text ?? ""} onChange={(e) => field("warranties_text", e.target.value)}
            placeholder={"اكتب الضمانات كما تريد، كل ضمان في سطر. مثال:\nضمان الهيكل الإنشائي 10 سنوات\nضمان العزل المائي 10 سنوات\nضمان السباكة والكهرباء 5 سنوات"} />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium text-navy/70">المميزات</span>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...FEATURE_PRESETS, ...features])).map((x) => (
              <button key={x} type="button" onClick={() => toggleFeature(x)}
                className={"rounded-full border px-3 py-1 text-xs transition-colors " + (features.includes(x) ? "border-navy bg-navy text-cream" : "border-navy/20 text-navy/70 hover:border-navy/50")}>
                {features.includes(x) ? "✓ " : ""}{x}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inputClass + " flex-1"} placeholder="ميزة أخرى…" value={newFeature} onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }} />
            <button type="button" onClick={addFeature} className="rounded-lg border border-navy/15 px-3 text-sm text-navy hover:bg-navy/5">إضافة</button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className={labelClass}>رابط الموقع على الخريطة
            <input className={inputClass} dir="ltr" placeholder="https://maps.google.com/…" value={form.map_url ?? ""} onChange={(e) => field("map_url", e.target.value)} />
          </label>
          <label className={labelClass}>رابط الملف التعريفي (PDF)
            <input className={inputClass} dir="ltr" placeholder="https://…" value={form.brochure_url ?? ""} onChange={(e) => field("brochure_url", e.target.value)} />
          </label>
          <label className={labelClass}>رابط الفيديو
            <input className={inputClass} dir="ltr" placeholder="https://youtube.com/…" value={form.video_url ?? ""} onChange={(e) => field("video_url", e.target.value)} />
          </label>
        </div>
      </Section>

      <Section title={t("sectionPricing")} hint={units.length ? "تُحسب تلقائياً من الوحدات أعلاه" : undefined}>
        <fieldset disabled={units.length > 0} className="grid grid-cols-2 gap-4 disabled:opacity-60 sm:grid-cols-4">
          <label className={labelClass}>
            {t("priceFrom")}
            <input
              type="number"
              className={inputClass}
              value={derived.price_from}
              onChange={(e) => field("price_from", Number(e.target.value))}
            />
          </label>
          <label className={labelClass}>
            {t("priceTo")}
            <input
              type="number"
              className={inputClass}
              value={derived.price_to ?? ""}
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
              value={derived.area_from}
              onChange={(e) => field("area_from", Number(e.target.value))}
            />
          </label>
          <label className={labelClass}>
            {t("areaTo")}
            <input
              type="number"
              className={inputClass}
              value={derived.area_to ?? ""}
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
              value={derived.rooms ?? ""}
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
              value={derived.bathrooms ?? ""}
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
              value={derived.sold_percentage ?? ""}
              onChange={(e) =>
                field(
                  "sold_percentage",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            />
          </label>
        </fieldset>
      </Section>


          <Section title="المدينة والإنجليزي">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className={labelClass}>{t("cityAr")}<input className={inputClass} value={form.city_ar} onChange={(e) => field("city_ar", e.target.value)} /></label>
              <label className={labelClass}>{t("cityEn")}<input className={inputClass} value={form.city_en} onChange={(e) => field("city_en", e.target.value)} /></label>
              <label className={labelClass}>{t("titleEn")}<input className={inputClass} value={form.title_en} onChange={(e) => field("title_en", e.target.value)} /></label>
              <label className={labelClass}>{t("districtEn")}<input className={inputClass} value={form.district_en} onChange={(e) => field("district_en", e.target.value)} /></label>
              <label className={labelClass + " sm:col-span-2"}>{t("descriptionEn")}<textarea rows={3} className={inputClass} value={form.description_en} onChange={(e) => field("description_en", e.target.value)} /></label>
            </div>
          </Section>
        </div>
      </details>

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
