/**
 * تفقيط — whole riyal amounts in Arabic words, as written on receipts
 * ("مائة وخمسون ألف ريال سعودي فقط لا غير"). Handles up to the billions;
 * halalas are added when the amount has a fraction.
 */
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

/** 1–999 in words. */
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 10) parts.push(ONES[r]);
    else if (r < 20) parts.push(TEENS[r - 10]);
    else parts.push((r % 10 ? ONES[r % 10] + " و" : "") + TENS[Math.floor(r / 10)]);
  }
  return parts.join(" و");
}

/** A count of thousands/millions/billions with the right noun form. */
function scaled(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return below1000(n) + " " + few;
  return below1000(n) + " " + many;
}

export function tafqit(amount: number): string {
  const whole = Math.floor(Math.abs(amount));
  const halalas = Math.round((Math.abs(amount) - whole) * 100);
  if (!whole && !halalas) return "صفر ريال";
  const b = Math.floor(whole / 1e9), m = Math.floor((whole % 1e9) / 1e6), t = Math.floor((whole % 1e6) / 1e3), u = whole % 1e3;
  const parts: string[] = [];
  if (b) parts.push(scaled(b, "مليار", "ملياران", "مليارات", "مليار"));
  if (m) parts.push(scaled(m, "مليون", "مليونان", "ملايين", "مليون"));
  if (t) parts.push(scaled(t, "ألف", "ألفان", "آلاف", "ألف"));
  if (u) parts.push(below1000(u));
  let s = parts.join(" و");
  s = whole ? s + " ريال سعودي" : "";
  if (halalas) s += (s ? " و" : "") + below1000(halalas) + " هللة";
  return s + " فقط لا غير";
}
