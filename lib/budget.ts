/**
 * Reads a budget typed freely by a visitor: «مليون ونص», «1.5 مليون», «مليونين», «850 ألف», «من 500 الى 850»
 * (the larger figure, in thousands when no unit is given and it looks small). Returns riyals, or null.
 */
export function parseBudget(raw: string | null | undefined, rent = false): number | null {
  const s = String(raw || "").replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x))).replace(/[,،]/g, "").trim();
  if (!s) return null;
  if (/مليونين/.test(s)) return 2e6;
  const half = /ونص|ونصف|و ?نص/.test(s);
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => n > 0);
  const million = /مليون|ملايين|m\b/i.test(s), thousand = /ألف|الف|آلاف|k\b/i.test(s);
  if (!nums.length) return million ? (half ? 1.5e6 : 1e6) : null;
  let n = Math.max(...nums);
  // A figure written with separators («8,000») is taken as it stands.
  const exact = /[,،]/.test(String(raw));
  if (million) n = n < 1000 ? n * 1e6 : n;
  else if (thousand) n = n * 1e3;
  else if (exact) n = Math.round(n);
  else if (rent) n = n < 1000 ? n * 1e3 : n; // rent is yearly: «50» → 50,000
  else if (n < 100) n = n * 1e6; // «3» or «1.5» → millions
  else if (n < 10000) n = n * 1e3; // «500 الى 850» → thousands
  if (half && million && nums.length === 1 && Number.isInteger(nums[0])) n += 5e5;
  return Math.round(n);
}

/** Ready amounts on the request forms. */
export const BUDGET_SALE = [5e5, 75e4, 1e6, 15e5, 2e6, 25e5, 3e6, 4e6, 5e6, 6e6, 7e6, 8e6, 9e6, 1e7];
export const BUDGET_RENT = [3e4, 5e4, 8e4, 1e5, 15e4, 2e5, 3e5];

/** A figure the CRM can read and match on, above what could only be a typing slip. */
export function budgetOk(raw: string | null | undefined, rent = false) {
  const n = parseBudget(raw, rent);
  return !!n && n >= (rent ? 5000 : 50000);
}

export function budgetWords(n: number, ar = true) {
  const m = Math.round(n / 1e4) / 100, k = Math.round(n / 1e3);
  if (n >= 1e6) return ar ? (m === 1 ? "مليون" : m + " مليون") : m + "M";
  return ar ? k + " ألف" : k + "K";
}
