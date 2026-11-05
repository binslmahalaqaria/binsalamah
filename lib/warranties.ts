/**
 * Warranties are typed as free text. Every «item … N years» pair becomes its own entry, whether they are on
 * separate lines or all in one sentence: «أفياش 20 سنة ومواسير 30 سنة», «المواسير: 30 سنة», «20 سنة على الأفياش».
 */
export interface Warranty { years: string | null; label: string }

const DIG = "٠١٢٣٤٥٦٧٨٩";
const UNIT = "(?:سنة|سنه|سنوات|سنين|years?|yrs?)";
const EDGE = /^[\s:：\-–—،,.؛;/]+|[\s:：\-–—،,.؛;/]+$/g;
const clean = (s: string) =>
  s.replace(EDGE, "")
    .replace(/^(?:و|and)\s+/i, "")
    .replace(/^(?:على|عن|ل|لل|for|on)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

export function parseWarranties(lines: string[]): Warranty[] {
  const out: Warranty[] = [];
  for (const raw of lines) {
    const line = raw.replace(/[٠-٩]/g, (d) => String(DIG.indexOf(d)));
    const re = new RegExp("(\\d+)\\s*" + UNIT, "gi");
    const found = Array.from(line.matchAll(re)).map((m) => ({ years: m[1], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
    if (!found.length) {
      const label = clean(line);
      if (label) out.push({ years: null, label });
      continue;
    }
    let prev = 0;
    found.forEach((f, i) => {
      const before = clean(line.slice(prev, f.start));
      if (before) { out.push({ years: f.years, label: before }); prev = f.end; return; }
      // number first: «20 سنة على الأفياش» — the item follows, up to the next number
      const next = found[i + 1]?.start ?? line.length;
      const after = clean(line.slice(f.end, next));
      out.push({ years: f.years, label: after || clean(line) });
      prev = next;
    });
    const rest = clean(line.slice(prev));
    if (rest.length > 2) out.push({ years: null, label: rest });
  }
  return out;
}
