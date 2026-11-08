"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { createOffer, updateOffer } from "@/lib/offers";
import { fillEnglish } from "@/lib/translate-offer";
import { pushOfferToProperty } from "@/lib/crm/web-sync";
import { uploadOfferImage, uploadOfferPdf } from "@/lib/upload-image";
import { WarrantiesEditor } from "@/components/admin/WarrantiesEditor";
import { expandToImages } from "@/lib/extract-images";
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
  "palace",
  "apartment",
  "floor",
  "penthouse",
  "townhouse",
  "building",
  "land",
  "farm",
  "resthouse",
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
    ad_license_no: offer?.ad_license_no ?? "",
    ad_license_expiry: offer?.ad_license_expiry ?? "",
    map_url: offer?.map_url ?? "",
    brochure_url: offer?.brochure_url ?? "",
    video_url: offer?.video_url ?? "",
    ribbon: offer?.ribbon ?? "",
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
  const [pdfBusy, setPdfBusy] = useState(false);

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
  // «✨ اكتب لي الوصف»: drafts a tidy description from the facts typed in this form (and any rough notes in the box).
  const [writing, setWriting] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [beforeAi, setBeforeAi] = useState<string | null>(null);
  async function writeDescription() {
    if (!user) return;
    if (!form.district_ar.trim() && !form.title_ar.trim()) { setAiMsg("اكتب اسم العقار أو الحي أولاً ليعرف المساعد عن ماذا يكتب."); return; }
    setWriting(true); setAiMsg(null);
    const AR_TYPE: Record<string, string> = { villa: "فيلا", palace: "قصر", apartment: "شقة", floor: "دور", penthouse: "بنتهاوس", townhouse: "تاون هاوس", building: "عمارة", land: "أرض", farm: "مزرعة", resthouse: "استراحة", other: "عقار" };
    const range = (a: number, b: number | null | undefined, u: string) => (a && b && b !== a ? a + " – " + b + " " + u : a ? a + " " + u : "");
    const facts: Record<string, unknown> = {
      name: form.title_ar.trim() || undefined, type: AR_TYPE[form.type] || form.type, city: form.city_ar?.trim() || "الرياض", district: form.district_ar.trim() || undefined,
      area: range(Number(form.area_from) || 0, form.area_to, "م²") || undefined,
      rooms: form.rooms || undefined, bathrooms: form.bathrooms || undefined, living_rooms: form.living_rooms || undefined,
      developer: form.developer?.trim() || undefined, handover: form.handover?.trim() || undefined, warranties: form.warranties_text?.trim() || undefined,
      features: (form.features ?? []).length ? form.features : undefined,
      units: units.filter((u) => u.name).map((u) => [u.name, u.area ? u.area + " م²" : "", u.rooms ? u.rooms + " غرف" : ""].filter(Boolean).join(" — ")),
      notes: form.description_ar.trim() || undefined,
    };
    try {
      const res = await fetch("/api/describe-offer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await user.getIdToken()) }, body: JSON.stringify(facts) });
      const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !j.text) { setAiMsg(j.error === "no_key" ? "المساعد الذكي غير مفعّل بعد (مفتاح Claude غير مضاف)." : "تعذّر كتابة الوصف الآن، حاول بعد قليل."); return; }
      setBeforeAi(form.description_ar);
      field("description_ar", j.text);
      setAiMsg("تمت الكتابة — راجع النص وعدّل ما تريد قبل الحفظ.");
    } catch { setAiMsg("تعذّر الاتصال، حاول مرة أخرى."); } finally { setWriting(false); }
  }
  const toggleFeature = (x: string) => field("features", features.includes(x) ? features.filter((y) => y !== x) : [...features, x]);
  const addFeature = () => { const v = newFeature.trim(); if (v && !features.includes(v)) field("features", [...features, v]); setNewFeature(""); };

  const [uploading, setUploading] = useState(0);
  // Upload photos from the device; each becomes an image row (the first one is the cover).
  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const { images: list, empty } = await expandToImages(files);
    if (empty.length) setError("ما لقيت صور داخل: " + empty.join("، "));
    if (!list.length) return;
    setUploading(list.length);
    for (const file of list) {
      try {
        const { url } = await uploadOfferImage(file);
        setImages((rows) => [...rows.filter((r) => r.url.trim()), { url }]);
      } catch (e) {
        setError("تعذّر رفع " + file.name + ": " + (e instanceof Error ? e.message : ""));
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

    // Blank unit rows are ignored; a half-filled one is reported by its number.
    const used = (form.units || []).filter((u) => u.name?.trim() || u.area || u.price);
    const bad = used.findIndex((u) => !u.name?.trim() || !(u.area > 0) || !(u.price > 0));
    if (bad >= 0) {
      const u = used[bad];
      setError("الوحدة رقم " + (bad + 1) + ": " + (!u.name?.trim() ? "اسم الوحدة مطلوب" : !(u.area > 0) ? "المساحة مطلوبة" : "السعر مطلوب") + " — عبّيها أو احذف الوحدة");
      return;
    }
    const parsed = offerFormSchema.safeParse(deriveFromUnits({ ...form, units: used }));
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
      // A listing tied to a CRM property: the shared fields are written to the property too.
      const pid = offer?.property_id || prefill?.property_id;
      if (pid) await pushOfferToProperty(pid, { ...data, images: cleanImages } as never).catch(() => {});
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
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>الوصف</span>
            <span className="flex items-center gap-2">
              {beforeAi !== null && <button type="button" className="text-xs font-normal text-navy/60 underline" onClick={() => { field("description_ar", beforeAi); setBeforeAi(null); setAiMsg(null); }}>↩ تراجع</button>}
              <button type="button" disabled={writing} onClick={writeDescription} className="rounded-full border border-navy/20 px-3 py-1 text-xs font-semibold text-navy transition-colors hover:bg-navy/5 disabled:opacity-50">{writing ? "جارٍ الكتابة…" : "✨ اكتب لي الوصف"}</button>
            </span>
          </span>
          <textarea rows={form.description_ar.includes("\n") ? 9 : 3} className={inputClass} placeholder="سطرين عن العقار وموقعه ومميزاته — أو اترك المساعد يكتبه من البيانات اللي عبّيتها" value={form.description_ar} onChange={(e) => field("description_ar", e.target.value)} />
          {aiMsg && <span className="text-xs font-normal text-navy/60">{aiMsg}</span>}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-navy/70">
          <input type="checkbox" checked={form.featured} onChange={(e) => field("featured", e.target.checked)} className="h-4 w-4 accent-gold" />
          {t("featured")}
        </label>
      </Section>

      <Section title={t("sectionImages")} hint="ارفع الصور من جهازك أو جوالك — الصورة الأولى هي الغلاف. تُصغَّر تلقائياً لتبقى سرعة الموقع عالية.">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy/20 px-4 py-6 text-sm font-medium text-navy transition-colors hover:border-navy/50 hover:bg-navy/[0.02]">
          <input type="file" accept="image/*,.zip,.pdf,.docx,.pptx,application/pdf,application/zip" multiple className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
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

        <WarrantiesEditor value={form.warranties_text ?? ""} onChange={(t) => field("warranties_text", t)} />

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>رقم ترخيص الإعلان (الهيئة العامة للعقار)
            <input className={inputClass} dir="ltr" value={form.ad_license_no ?? ""} onChange={(e) => field("ad_license_no", e.target.value)} />
          </label>
          <label className={labelClass}>تاريخ انتهاء ترخيص الإعلان
            <input type="date" className={inputClass} value={form.ad_license_expiry ?? ""} onChange={(e) => field("ad_license_expiry", e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className={labelClass}>رابط الموقع على الخريطة (للفريق فقط — لا يظهر للعميل)
            <input className={inputClass} dir="ltr" placeholder="https://maps.google.com/…" value={form.map_url ?? ""} onChange={(e) => field("map_url", e.target.value)} />
          </label>
          <label className={labelClass}>ملف المشروع PDF (للفريق فقط — لا يظهر للعميل)
            {form.brochure_url ? (
              <span className="flex flex-wrap items-center gap-2">
                <a href={form.brochure_url} target="_blank" rel="noreferrer" className="rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy hover:bg-navy/5">📄 عرض الملف</a>
                <button type="button" className="text-xs font-normal text-navy/60 underline" onClick={() => field("brochure_url", "")}>إزالة</button>
              </span>
            ) : (
              <input type="file" accept="application/pdf" disabled={pdfBusy} className={inputClass} onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = "";
                if (!file) return;
                if (file.type !== "application/pdf" || file.size > 15 * 1024 * 1024) { alert("اختر ملف PDF أقل من 15 م.ب"); return; }
                setPdfBusy(true);
                try { field("brochure_url", (await uploadOfferPdf(file)).url); } catch { alert("تعذّر رفع الملف"); } finally { setPdfBusy(false); }
              }} />
            )}
            {pdfBusy && <span className="text-xs font-normal text-navy/60">جارٍ الرفع…</span>}
          </label>
          <label className={labelClass}>شريط على العقار (يظهر على صورته في القوائم)
            <input className={inputClass} maxLength={40} placeholder="مثال: حصري — وحدات محدودة — جديد" value={form.ribbon ?? ""} onChange={(e) => field("ribbon", e.target.value)} />
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
