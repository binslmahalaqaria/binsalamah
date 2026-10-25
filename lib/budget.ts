/**
 * Reads a budget typed freely by a visitor: «مليون ونص», «1.5 مليون», «مليونين», «850 ألف», «من 500 الى 850»
 * (the larger figure, in thousands when no unit is given and it looks small). Returns riyals, or null.
 */
export function parseBudget(raw: string | null | undefined): number | null {
  const s = String(raw || "").replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x))).replace(/[,،]/g, "").trim();
  if (!s) return null;
  if (/مليونين/.test(s)) return 2e6;
  const half = /ونص|ونصف|و ?نص/.test(s);
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => n > 0);
  const million = /مليون|ملايين|m\b/i.test(s), thousand = /ألف|الف|آلاف|k\b/i.test(s);
  if (!nums.length) return million ? (half ? 1.5e6 : 1e6) : null;
  let n = Math.max(...nums);
  if (million) n = n < 1000 ? n * 1e6 : n;
  else if (thousand) n = n * 1e3;
  else if (n < 10000) n = n * 1e3; // «500 الى 850» → thousands
  if (half && million && nums.length === 1 && Number.isInteger(nums[0])) n += 5e5;
  return Math.round(n);
}
