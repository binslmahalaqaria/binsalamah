import { RIYADH_DISTRICTS } from "@/lib/districts";
/**
 * Option lists and stage names for the sales CRM (clients, requests,
 * properties, tasks, team). Ported 1:1 from the original artifact CRM so
 * migrated records keep their exact values — these Arabic strings are
 * stored in Firestore as-is, so never rename one without migrating data.
 * See CLAUDE.md §5 "Sales CRM collections".
 */

export const TEMPS = ["ساخن", "دافئ", "بارد"] as const;
/** Client status for the re-contact list ("للتواصل"): the team still has to call them and record a request or archive them. */
export const TO_CONTACT = "للتواصل";
/** No reply after three missed calls and a WhatsApp message (48 h) — its own list; reactivated without losing data. */
export const NO_RESP = "لا يوجد رد";
export const CSTATUS = ["نشط", TO_CONTACT, "مغلق", "غير مهتم", NO_RESP] as const;
/** Unanswered call outcomes (count toward the three attempts before the WhatsApp message). */
export const MISSED = ["ما رد", "مشغول"];
/** The fourth contact attempt (not a call; excluded from the daily call target). */
export const WA_LOG = "رسالة واتساب";
/** Minimum calls per employee per day. */
export const CALL_TARGET = 10;
/** Offer statuses (proposals). Still open = waiting on the customer. */
export const PROP_ST = ["أُرسل", "بانتظار الرد", "مهتم", "غير مناسب"] as const;
/** Old offer statuses folded into «مهتم» (a viewing is its own record now). */
export const PROP_LEGACY = ["تم تحديد معاينة", "تمت المعاينة"];
export const PROP_OPEN = ["أُرسل", "بانتظار الرد", "مهتم"];
export const PROP_TONE: Record<string, Tone> = { "أُرسل": "muted", "بانتظار الرد": "warm", "مهتم": "ok", "غير مناسب": "hot", "تم تحديد معاينة": "accent", "تمت المعاينة": "ok" };
/** Viewing statuses. */
export const VIEW_ST = ["مجدولة", "تمت", "مؤجلة", "ملغاة"] as const;
export const VIEW_TONE: Record<string, Tone> = { "مجدولة": "accent", "تمت": "ok", "مؤجلة": "warm", "ملغاة": "muted" };
export const PTYPES = ["فيلا", "تاون هاوس", "دور", "شقة", "أرض", "عمارة", "استراحة", "تجاري"] as const;
export const SOURCES = ["واتساب", "سناب", "تيك توك", "إعلان عقار", "إحالة", "اتصال", "الموقع", "أخرى"] as const;
export const PAY = ["كاش", "بنك", "بنك + كاش"] as const;
export const PSTATUS = ["متاح", "محجوز", "مباع"] as const;
export const OWNERK = ["مالك فرد", "مطور", "مسوق"] as const;
export const FACING = [
  "شمالية", "جنوبية", "شرقية", "غربية", "شمالية شرقية", "شمالية غربية",
  "جنوبية شرقية", "جنوبية غربية", "زاوية (شارعين)", "ثلاث شوارع",
] as const;
export const FLOORS = ["أرضي", "أول", "ثاني", "ثالث", "رابع وأعلى", "روف"] as const;
export const FLOOR_TYPES = ["دور", "شقة"];
export const REQ = ["جديد", "جاري البحث", "أرسلنا خيارات", "تفاوض", "عربون", "تم البيع", "ملغي"] as const;
export const OPEN_STAGES = REQ.filter((x) => x !== "تم البيع" && x !== "ملغي");
export const SOLD_ST = ["عربون", "تم البيع"];
export const CONTRACT = ["دوام كامل", "دوام جزئي", "عمولة فقط", "تدريب"] as const;
export const PRIO = ["عادية", "مهمة", "عاجلة"] as const;

const CRM_DISTRICTS = [
  "النرجس", "الملقا", "الياسمين", "القيروان", "العارض", "حطين", "الصحافة", "الربيع", "الندى", "النفل",
  "العقيق", "الغدير", "الوادي", "المروج", "المرسلات", "الازدهار", "التعاون", "المصيف", "الواحة", "الفلاح",
  "الملك فهد", "الملك عبدالله", "الورود", "السليمانية", "العليا", "المحمدية", "الرحمانية", "الرائد", "النخيل",
  "المعذر", "الشهداء", "الحمراء", "القدس", "غرناطة", "قرطبة", "اشبيلية", "اليرموك", "النهضة", "الروضة",
  "الريان", "الخليج", "المونسية", "الرمال", "النظيم", "المشرق", "الجنادرية", "القادسية", "الأندلس", "السلي",
  "الفيحاء", "الجزيرة", "الربوة", "الملز", "السلام", "النسيم", "الروابي", "العزيزية", "الشفا", "بدر",
  "الدار البيضاء", "المنصورية", "الحزم", "ظهرة لبن", "طويق", "عرقة", "نمار", "السويدي", "العريجاء", "البديعة",
  "الخالدية", "المهدية", "الخير", "الوزارات", "المصانع", "عليشة", "الفاخرية", "أم الحمام", "المعيزلية",
  "ظهرة البديعة", "ديراب", "العمارية",
];
/** The CRM list plus every Riyadh district the public site knows (lib/districts.ts), without duplicates. */
const norm = (d: string) => d.replace(/[إأآ]/g, "ا").replace(/s+/g, " ").trim();
export const DISTRICTS = [...CRM_DISTRICTS, ...RIYADH_DISTRICTS.filter((d) => !CRM_DISTRICTS.some((c) => norm(c) === norm(d)))];

/** Client update types: default days until the next call, and an optional status change. */
export const UPD: { k: string; n: number | "none"; status?: string }[] = [
  { k: "اتصلت عليه", n: 3 },
  { k: "ما رد", n: 1 },
  { k: "مشغول", n: 1 },
  { k: "رقم خاطئ", n: "none", status: "غير مهتم" },
  { k: "استفسر", n: 3 },
  { k: "تم إرسال الموقع", n: 3 },
  { k: "تم إرسال التفاصيل", n: 3 },
  { k: "زار العقار", n: 2 },
  { k: "تفاوض", n: 2 },
  { k: "سجّل اهتمام", n: 3 },
  { k: "دفع عربون", n: 2 },
  { k: "صرف النظر", n: "none", status: "غير مهتم" },
  { k: "تم الإغلاق", n: "none", status: "مغلق" },
];

/** Quick call-log outcomes on the Today screen: [type, label, default next-call days]. */
export const QL_OUT: [string, string, number | "none"][] = [
  ["اتصلت عليه", "تم الاتصال", 3],
  ["ما رد", "لم يرد", 1],
  ["مشغول", "مشغول", 1],
  ["رقم خاطئ", "رقم خاطئ", "none"],
  ["استفسر", "استفسار", 3],
  ["تم إرسال الموقع", "تم إرسال الموقع", 3],
  ["تم إرسال التفاصيل", "تم إرسال التفاصيل", 3],
  ["سجّل اهتمام", "أبدى اهتمامه", 3],
  ["صرف النظر", "غير مهتم", "none"],
];

/** Which request stage a client update pushes the client's latest open request to. */
export const UPD_STAGE: Record<string, string> = {
  "دفع عربون": "عربون",
  "تم إرسال الموقع": "أرسلنا خيارات",
  "تم إرسال التفاصيل": "أرسلنا خيارات",
  "تفاوض": "تفاوض",
  "صرف النظر": "ملغي",
  "رقم خاطئ": "ملغي",
  "تم الإغلاق": "تم البيع",
};

/**
 * Formal display labels for stored values whose saved wording is colloquial.
 * The stored strings never change (old data and comparisons rely on them); render through lbl().
 */
export const LBL: Record<string, string> = {
  "اتصلت عليه": "تم الاتصال",
  "ما رد": "لم يرد",
  "استفسر": "استفسار",
  "سجّل اهتمام": "أبدى اهتمامه",
  "صرف النظر": "غير مهتم",
  "للتواصل": "بانتظار التواصل",
  "زار العقار": "تمت المعاينة",
  "دفع عربون": "دفع العربون",
  "تم الإغلاق": "تمت الصفقة",
  "حدد موعد زيارة": "تحديد موعد معاينة",
  "تأكيد زيارة": "تأكيد موعد المعاينة",
  "ما حضر": "لم يحضر",
  "إلغاء موعد": "إلغاء الموعد",
  "أرسلنا خيارات": "تم إرسال عروض",
  "رجع لمدير المبيعات": "أُعيد إلى مدير المبيعات",
};
export const lbl = (v: string | null | undefined) => (v ? LBL[v] || v : "");

export const SENT_T = ["تم إرسال الموقع", "تم إرسال التفاصيل"];
/** Log types that don't count as a call. */
/**
 * Call outcomes: what «تسجيل المكالمة» (and the update form, the re-contact list) records. Only these
 * count as calls (client 2026-10-21) — recording a deposit/sale, a visit, a confirmation, a transfer or
 * a property sent from the matching screen is not a call.
 */
export const CALL_T = ["اتصلت عليه", "ما رد", "مشغول", "رقم خاطئ", "استفسر", "تم إرسال الموقع", "تم إرسال التفاصيل", "سجّل اهتمام", "صرف النظر", "تفاوض"];
/** Is this log entry a call? New entries carry `call`; older ones are judged by their type. */
export const isCall = (l: { type: string; call?: boolean }) => l.call ?? CALL_T.includes(l.type);
export const NOCALL = ["تأجيل", "إلغاء موعد", "رجع لمدير المبيعات", "أُعيد إلى مدير المبيعات", "تحويل", "إلغاء صفقة"];

/** Monthly goal keys: [key, form label, column label]. */
export const GOALK: [GoalKey, string, string][] = [
  ["calls", "مكالمات في اليوم", "مكالمات (معدل يومي)"],
  ["reqs", "طلبات جديدة في الشهر", "طلبات جديدة"],
  ["visits", "معاينات منفّذة", "معاينات"],
  ["deals", "عربون + بيع", "عربون + بيع"],
  ["commission", "السعي (ريال)", "السعي"],
];
export type GoalKey = "calls" | "reqs" | "visits" | "deals" | "commission";

/* ---------- pill tones ---------- */
export type Tone = "hot" | "warm" | "cold" | "ok" | "muted" | "gold" | "accent";

export const TEMP_TONE: Record<string, Tone> = { "ساخن": "hot", "دافئ": "warm", "بارد": "cold" };
export const PSTATUS_TONE: Record<string, Tone> = { "متاح": "ok", "محجوز": "warm", "مباع": "muted" };
export const OWNERK_TONE: Record<string, Tone> = { "مالك فرد": "accent", "مطور": "gold", "مسوق": "cold" };
export const PRIO_TONE: Record<string, Tone> = { "عادية": "muted", "مهمة": "warm", "عاجلة": "hot" };
export const REQ_TONE: Record<string, Tone> = {
  "جديد": "hot", "جاري البحث": "warm", "أرسلنا خيارات": "cold", "معاينة": "accent",
  "تفاوض": "gold", "عربون": "ok", "تم البيع": "ok", "ملغي": "muted",
};
export const UPD_TONE: Record<string, Tone> = {
  "سجّل اهتمام": "gold", "دفع عربون": "ok", "صرف النظر": "muted", "تم الإغلاق": "ok", "زار العقار": "accent",
  "تفاوض": "gold", "تم إرسال الموقع": "cold", "تم إرسال التفاصيل": "cold", "ما رد": "warm",
};
