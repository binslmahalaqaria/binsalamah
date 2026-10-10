/**
 * Option lists and stage names for the sales CRM (clients, requests,
 * properties, tasks, team). Ported 1:1 from the original artifact CRM so
 * migrated records keep their exact values — these Arabic strings are
 * stored in Firestore as-is, so never rename one without migrating data.
 * See CLAUDE.md §5 "Sales CRM collections".
 */

export const TEMPS = ["ساخن", "دافئ", "بارد"] as const;
export const CSTATUS = ["نشط", "مغلق", "غير مهتم"] as const;
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
export const REQ = ["جديد", "جاري البحث", "أرسلنا خيارات", "معاينة", "تفاوض", "عربون", "تم البيع", "ملغي"] as const;
export const OPEN_STAGES = REQ.filter((x) => x !== "تم البيع" && x !== "ملغي");
export const SOLD_ST = ["عربون", "تم البيع"];
export const CONTRACT = ["دوام كامل", "دوام جزئي", "عمولة فقط", "تدريب"] as const;
export const PRIO = ["عادية", "مهمة", "عاجلة"] as const;

export const DISTRICTS = [
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

/** Client update types: default days until the next call, and an optional status change. */
export const UPD: { k: string; n: number | "none"; status?: string }[] = [
  { k: "اتصلت عليه", n: 3 },
  { k: "ما رد", n: 1 },
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
  ["اتصلت عليه", "رد وتكلمنا", 3],
  ["ما رد", "ما رد", 1],
  ["استفسر", "استفسر", 3],
  ["تم إرسال الموقع", "أرسلت الموقع", 3],
  ["تم إرسال التفاصيل", "أرسلت التفاصيل", 3],
  ["سجّل اهتمام", "سجّل اهتمام", 3],
  ["صرف النظر", "صرف النظر", "none"],
];

/** Which request stage a client update pushes the client's latest open request to. */
export const UPD_STAGE: Record<string, string> = {
  "دفع عربون": "عربون",
  "تم إرسال الموقع": "أرسلنا خيارات",
  "تم إرسال التفاصيل": "أرسلنا خيارات",
  "حدد موعد زيارة": "معاينة",
  "زار العقار": "معاينة",
  "تفاوض": "تفاوض",
  "صرف النظر": "ملغي",
  "تم الإغلاق": "تم البيع",
};

export const SENT_T = ["تم إرسال الموقع", "تم إرسال التفاصيل"];
/** Log types that don't count as a call. */
export const NOCALL = ["تأجيل", "إلغاء موعد"];

/** Monthly goal keys: [key, form label, column label]. */
export const GOALK: [GoalKey, string, string][] = [
  ["calls", "مكالمات في اليوم", "مكالمات (معدل يومي)"],
  ["reqs", "طلبات جديدة في الشهر", "طلبات جديدة"],
  ["visits", "زيارات منفّذة", "زيارات"],
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
