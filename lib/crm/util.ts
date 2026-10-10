/**
 * Formatting and date helpers for the sales CRM. All dates are local
 * calendar days (`YYYY-MM-DD`) so "today" matches the staff member's
 * clock, not UTC.
 */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Parses user-typed numbers, accepting Arabic-Indic digits and thousands separators. */
export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  const s = String(v)
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[,،\s]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export const iso = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const today = () => iso(new Date());
export const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const nowStamp = () => new Date().toISOString();
export const ym = (d?: string) => (d || today()).slice(0, 7);
export const localDay = (s: string | null | undefined) => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : iso(d);
};

export const money = (n: number | null | undefined) => {
  if (n == null || isNaN(+n)) return "—";
  n = +n;
  if (n >= 1e6) return (Math.round(n / 1e4) / 100).toLocaleString("en-US") + " مليون";
  return Math.round(n).toLocaleString("en-US") + " ر.س";
};
export const moneyFull = (n: number | null | undefined) =>
  n == null ? "—" : Math.round(+n).toLocaleString("en-US") + " ر.س";
export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export function dayDiff(d: string | null | undefined): number | null {
  if (!d) return null;
  const a = new Date(d + "T00:00"),
    b = new Date(today() + "T00:00");
  return Math.round((a.getTime() - b.getTime()) / 864e5);
}

export function relDay(d: string | null | undefined) {
  const x = dayDiff(d);
  if (x == null) return "بدون موعد";
  if (x === 0) return "اليوم";
  if (x === 1) return "بكرة";
  if (x === -1) return "أمس";
  if (x < 0) return "متأخر " + -x + " أيام";
  return "بعد " + x + " أيام";
}

export function lateTxt(d: string | null | undefined) {
  const x = dayDiff(d);
  if (x == null) return "";
  if (x === 0) return "اليوم";
  if (x < -30) return "متأخر أكثر من شهر";
  if (x === -1) return "متأخر يوم";
  if (x === -2) return "متأخر يومين";
  if (x < 0) return "متأخر " + -x + " أيام";
  if (x > 14) return d as string;
  return relDay(d);
}

export function ageDays(s: string | null | undefined) {
  if (!s) return "";
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 864e5);
  return d <= 0 ? "اليوم" : d === 1 ? "أمس" : "من " + d + " أيام";
}

export function fmtStamp(s: string | null | undefined) {
  if (!s) return "";
  const d = new Date(s);
  return iso(d) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

const AR_DATE = "ar-SA-u-ca-gregory-nu-latn";
export const weekdayLong = (d: Date) => d.toLocaleDateString(AR_DATE, { weekday: "long", day: "numeric", month: "long" });
export const monthName = (m: string) => new Date(m + "-15").toLocaleDateString(AR_DATE, { month: "long" });
export const hm = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" }) : "—";

export function fmtVisit(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const day = iso(d);
  const rel =
    day === today()
      ? "اليوم"
      : day === addDays(1)
        ? "بكرة"
        : day === addDays(-1)
          ? "أمس"
          : d.toLocaleDateString(AR_DATE, { weekday: "long", day: "numeric", month: "numeric" });
  return rel + " " + d.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" });
}

/** Normalizes a Saudi phone number to international digits (9665XXXXXXXX). */
export function intl(p: string | null | undefined) {
  let d = String(p || "")
    .replace(/[٠-٩]/g, (x) => String(AR_DIGITS.indexOf(x)))
    .replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("05")) d = "966" + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = "966" + d;
  return d;
}
export const normPhone = (p: string | null | undefined) => {
  const d = intl(p);
  return d && d.length >= 9 ? d : null;
};

export function waLink(p: string | null | undefined, text?: string) {
  const d = intl(p);
  if (!d) return null;
  return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "");
}
export const telLink = (p: string | null | undefined) => {
  const d = intl(p);
  return d ? "tel:+" + d : null;
};

/** Normalizes Arabic letter variants for forgiving search. */
export const nz = (x: string) => x.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

export const splitList = (s: string | null | undefined) =>
  String(s || "")
    .split(/[،,]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Downloads rows as a UTF-8 CSV (opens in Excel with Arabic intact). */
export function exportCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]);
  const q = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const data = "﻿" + [keys.map(q).join(",")].concat(rows.map((r) => keys.map((k) => q(r[k])).join(","))).join("\r\n");
  const blob = new Blob([data], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name + "-" + today() + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
