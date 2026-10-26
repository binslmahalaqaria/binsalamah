"use client";

/**
 * «المميزات» as icon tiles grouped by room, with filter chips (client 2026-10-26, replaces the plain bullet list).
 * Features are free text written by the team, so each one is placed by keywords in its Arabic wording
 * (an icon and a group); anything unrecognised goes to «عام» with a check mark. Chips only list groups that exist.
 */
import { useState, type ReactElement } from "react";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ic = (d: ReactElement) => <svg viewBox="0 0 24 24" className="h-7 w-7" {...S}>{d}</svg>;
const ICONS: Record<string, ReactElement> = {
  door: ic(<><rect x="6" y="3" width="12" height="18" rx="1.5" /><circle cx="15" cy="12.5" r=".8" fill="currentColor" /></>),
  window: ic(<><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M12 4v16M4 12h16" /></>),
  fan: ic(<><circle cx="12" cy="12" r="1.6" /><path d="M12 10.4C12 6 14.5 4 16 5s.5 4-4 5.4M13.6 12c4.4 0 6.4 2.5 5.4 4s-4 .5-5.4-4M12 13.6C12 18 9.5 20 8 19s-.5-4 4-5.4M10.4 12C6 12 4 9.5 5 8s4-.5 5.4 4" /></>),
  car: ic(<><path d="M5 16V11l1.8-4.2A2 2 0 0 1 8.6 5.5h6.8a2 2 0 0 1 1.8 1.3L19 11v5" /><path d="M3.5 16h17M7 11h10" /><circle cx="8" cy="17.5" r="1.4" /><circle cx="16" cy="17.5" r="1.4" /></>),
  sofa: ic(<><path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3v-4zM6 17v2M18 17v2" /></>),
  bed: ic(<><path d="M3 18V7m0 7h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.6" /></>),
  kitchen: ic(<><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M4 9h16M8 6h.01M12 6h.01M8 14h8" /></>),
  bath: ic(<><path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2zM6 12V5a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2" /></>),
  tree: ic(<><path d="M12 21v-6M12 15c-4 0-6-2.5-6-5.5S8.5 4 12 4s6 2.5 6 5.5S16 15 12 15z" /></>),
  pool: ic(<><path d="M3 17c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0M3 21c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0M8 14V6a2 2 0 0 1 4 0M16 14V6a2 2 0 0 0-4 0" /></>),
  lift: ic(<><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9.5 10l2.5-3 2.5 3M9.5 14l2.5 3 2.5-3" /></>),
  shield: ic(<><path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z" /><path d="M9 12l2.2 2.2L15.5 10" /></>),
  snow: ic(<><path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2" /></>),
  plug: ic(<><path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v5" /></>),
  drop: ic(<><path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z" /></>),
  stairs: ic(<><path d="M4 20h4v-4h4v-4h4V8h4" /></>),
  sun: ic(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></>),
  wifi: ic(<><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0" /><circle cx="12" cy="19" r=".8" fill="currentColor" /></>),
  cam: ic(<><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 11l5-3v8l-5-3z" /></>),
  check: ic(<><path d="M5 12.5l4.5 4.5L19 7.5" /></>),
};

/** [keywords in the Arabic text, icon, group]. First match wins. */
const RULES: [RegExp, string, string][] = [
  [/مصعد|اسانسير|أسانسير/, "lift", "common"],
  [/مسبح|سباحة/, "pool", "outside"],
  [/حديقة|حوش|مزروع|تشجير|عشب|ساحة/, "tree", "outside"],
  [/موقف|كراج|مواقف|جراج/, "car", "outside"],
  [/كاميرا|مراقبة/, "cam", "outside"],
  [/حراسة|أمن|امن|حماية|بوابة|ذكي/, "shield", "outside"],
  [/ملحق|سطح|روف|شرفة|بلكونة|بلكون/, "sun", "outside"],
  [/مطبخ|راكب|خزائن مطبخ/, "kitchen", "kitchen"],
  [/شفط|تهوية|مراوح/, "fan", "kitchen"],
  [/حمام|دورة مياه|دورات مياه|جاكوزي|سباكة|مياه|خزان/, "bath", "kitchen"],
  [/غرفة نوم|غرف نوم|ماستر|خزانة|ملابس|دريسنج|نوم/, "bed", "bedroom"],
  [/مجلس|معيشة|صالة|مقلط|ريسبشن|استقبال/, "sofa", "living"],
  [/درج|سلم|دبل|دوبلكس|دورين/, "stairs", "common"],
  [/باب|أبواب|ابواب|سنديان|خشب/, "door", "common"],
  [/نافذة|نوافذ|شباك|شبابيك|ألمنيوم|المنيوم|زجاج|جلاس/, "window", "common"],
  [/تكييف|مكيف|سبليت|مخفي|بارد|تدفئة/, "snow", "common"],
  [/كهرباء|إنارة|اضاءة|إضاءة|عداد|لوحة|توصيلات/, "plug", "common"],
  [/ماء|سباك|صرف/, "drop", "common"],
  [/طاقة شمسية|شمسي/, "sun", "common"],
  [/انترنت|إنترنت|ألياف|واي|شبكة/, "wifi", "common"],
];
const GROUPS: Record<string, { ar: string; en: string }> = {
  living: { ar: "المعيشة", en: "Living" },
  kitchen: { ar: "المطبخ والمرافق", en: "Kitchen & utilities" },
  bedroom: { ar: "النوم", en: "Bedrooms" },
  outside: { ar: "الخارج", en: "Outdoors" },
  common: { ar: "التشطيبات والأنظمة", en: "Finishes & systems" },
  general: { ar: "عام", en: "General" },
};
const ORDER = ["living", "kitchen", "bedroom", "outside", "common", "general"];

export function FeatureTiles({ items, ar }: { items: { text: string; key: string }[]; ar: boolean }) {
  const [group, setGroup] = useState("all");
  const placed = items.map((it) => {
    const r = RULES.find(([re]) => re.test(it.key));
    return { ...it, icon: r ? r[1] : "check", group: r ? r[2] : "general" };
  });
  const present = ORDER.filter((g) => placed.some((p) => p.group === g));
  const shown = group === "all" ? placed : placed.filter((p) => p.group === group);
  const chip = (on: boolean) =>
    "min-h-9 rounded-full border px-3.5 py-1.5 text-sm transition-colors " + (on ? "border-navy bg-navy text-cream" : "border-navy/15 bg-white text-navy hover:border-navy/40");
  return (
    <div className="grid gap-4">
      {present.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist">
          <button type="button" className={chip(group === "all")} onClick={() => setGroup("all")}>{ar ? "الكل" : "All"}</button>
          {present.map((g) => <button key={g} type="button" className={chip(group === g)} onClick={() => setGroup(g)}>{ar ? GROUPS[g].ar : GROUPS[g].en}</button>)}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <li key={p.key} className="flex flex-col items-center gap-2 rounded-2xl border border-navy/10 bg-white px-3 py-4 text-center text-sm leading-snug text-navy/85">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gold/15 text-gold">{ICONS[p.icon]}</span>
            {p.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
