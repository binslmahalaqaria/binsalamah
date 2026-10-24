/**
 * Riyadh districts the public site knows about: approximate centre points for
 * the projects map (one pin per district, sized by how many offers it has)
 * and the order of the "browse by district" chips. Offers match on
 * `district_ar`, with or without a leading «حي». A district missing here simply
 * gets no pin — add it with its rough centre to show it on the map.
 */
export const DISTRICTS: Record<string, { en: string; at: [number, number] }> = {
  الملقا: { en: "Al Malqa", at: [24.807, 46.611] },
  النرجس: { en: "An Narjis", at: [24.86, 46.66] },
  حطين: { en: "Hittin", at: [24.77, 46.6] },
  الياسمين: { en: "Al Yasmin", at: [24.826, 46.641] },
  العارض: { en: "Al Arid", at: [24.88, 46.59] },
  القيروان: { en: "Al Qirawan", at: [24.84, 46.59] },
  الصحافة: { en: "As Sahafah", at: [24.806, 46.64] },
  العقيق: { en: "Al Aqiq", at: [24.775, 46.625] },
  الربيع: { en: "Ar Rabi", at: [24.795, 46.665] },
  الغدير: { en: "Al Ghadir", at: [24.775, 46.655] },
  النفل: { en: "An Nafl", at: [24.782, 46.682] },
  الندى: { en: "An Nada", at: [24.806, 46.68] },
  الوادي: { en: "Al Wadi", at: [24.79, 46.692] },
  التعاون: { en: "At Taawun", at: [24.765, 46.7] },
  المصيف: { en: "Al Masif", at: [24.755, 46.69] },
  النخيل: { en: "An Nakheel", at: [24.745, 46.63] },
  "الملك فهد": { en: "King Fahd", at: [24.74, 46.665] },
  المحمدية: { en: "Al Muhammadiyah", at: [24.735, 46.64] },
  الرحمانية: { en: "Ar Rahmaniyah", at: [24.715, 46.655] },
  الورود: { en: "Al Wurud", at: [24.725, 46.68] },
  المرسلات: { en: "Al Mursalat", at: [24.745, 46.705] },
  النزهة: { en: "An Nuzhah", at: [24.76, 46.715] },
  الفلاح: { en: "Al Falah", at: [24.795, 46.72] },
  قرطبة: { en: "Qurtubah", at: [24.81, 46.735] },
  المونسية: { en: "Al Munsiyah", at: [24.826, 46.765] },
  اليرموك: { en: "Al Yarmuk", at: [24.815, 46.785] },
  الرمال: { en: "Ar Rimal", at: [24.86, 46.84] },
  الحمراء: { en: "Al Hamra", at: [24.775, 46.765] },
  السليمانية: { en: "As Sulimaniyah", at: [24.705, 46.695] },
};

/** Chips shown on the home page (north Riyadh first — where the office works). */
export const FEATURED_DISTRICTS = ["الملقا", "النرجس", "حطين", "الياسمين", "العارض", "القيروان", "الصحافة", "العقيق", "الربيع", "النفل", "الندى", "الملك فهد"];

/** "حي الملقا" → "الملقا", so offers typed either way land on the same district. */
export const districtKey = (s: string | null | undefined) => (s || "").replace(/^حي\s+/, "").trim();

/** Budget steps, in the owner's wording: under a million, a million, two, 3, 4, 5+ (each covers up to the next step). */
export const PRICE_RANGES: { id: string; ar: string; en: string; min: number; max: number }[] = [
  { id: "0", ar: "أقل من مليون", en: "Under 1M", min: 0, max: 1_000_000 },
  { id: "1", ar: "مليون", en: "1M", min: 1_000_000, max: 2_000_000 },
  { id: "2", ar: "مليونين", en: "2M", min: 2_000_000, max: 3_000_000 },
  { id: "3", ar: "3 ملايين", en: "3M", min: 3_000_000, max: 4_000_000 },
  { id: "4", ar: "4 ملايين", en: "4M", min: 4_000_000, max: 5_000_000 },
  { id: "5", ar: "5 ملايين فأكثر", en: "5M+", min: 5_000_000, max: Infinity },
]

/**
 * Riyadh districts by area, like rakez.sa: the visitor picks the area (north,
 * east, …) and then only that area's districts are listed. Used by the search
 * bar, the request form, /offers and (merged) the CRM's district list.
 */
export const RIYADH_ZONES: { id: string; ar: string; en: string; districts: string[] }[] = [
  { id: "centre", ar: "وسط الرياض", en: "Central Riyadh", districts: [
    "العليا", "السليمانية", "الملز", "الوزارات", "المربع", "الفوطة", "المعذر", "المعذر الشمالي", "الضباط", "جرير", "الصناعية",
  "المرقب", "الديرة", "البطحاء", "الوشام", "الناصرية", "عليشة", "الشميسي", "الفيصلية", "اليمامة", "الزهراء",
  "الصالحية", "العود", "الجرادية", "منفوحة", "منفوحة الجديدة", "عتيقة", "غبيرة", "المؤتمرات", "أم سليم", "جبرة", "الخالدية"] },
  { id: "north", ar: "شمال الرياض", en: "North Riyadh", districts: [
    "الملقا", "النرجس", "حطين", "الياسمين", "العارض", "القيروان", "الصحافة", "العقيق", "الربيع", "الغدير", "النفل", "الندى",
  "الوادي", "التعاون", "المصيف", "المروج", "المرسلات", "الازدهار", "الواحة", "صلاح الدين", "الفلاح", "النزهة", "الملك فهد",
  "الملك عبدالعزيز", "الملك عبدالله", "الملك سلمان", "المغرزات", "الورود", "الرحمانية", "المحمدية", "النخيل", "الرائد",
  "الخير", "بنبان", "الصفا"] },
  { id: "east", ar: "شرق الرياض", en: "East Riyadh", districts: [
    "قرطبة", "غرناطة", "اشبيلية", "اليرموك", "المونسية", "الحمراء", "الرمال", "الشهداء", "النهضة", "الأندلس", "الخليج",
  "الروضة", "الريان", "القدس", "الرواد", "النسيم الشرقي", "النسيم الغربي", "السلي", "الجنادرية", "الندوة", "المنار",
  "الربوة", "النظيم", "السعادة", "الفيحاء", "الجزيرة", "الملك فيصل", "الروابي", "القادسية", "السلام", "الأمانة", "المشرق", "المعيزلية"] },
  { id: "west", ar: "غرب الرياض", en: "West Riyadh", districts: [
    "عرقة", "ظهرة لبن", "لبن", "السويدي", "السويدي الغربي", "العريجاء", "العريجاء الوسطى", "العريجاء الغربية", "شبرا",
  "البديعة", "ظهرة البديعة", "نمار", "ظهرة نمار", "الحزم", "ديراب", "طويق", "أم الحمام الشرقي", "أم الحمام الغربي",
  "السفارات", "الخزامى", "المهدية", "هجرة وادي لبن", "الدرعية", "سلطانة", "الزهرة", "العمارية"] },
  { id: "south", ar: "جنوب الرياض", en: "South Riyadh", districts: [
    "الشفا", "العزيزية", "الدار البيضاء", "المنصورية", "الدفاع", "المصانع", "الفاخرية", "الحائر", "عكاظ", "بدر", "المروة",
  "الدريهمية", "النموذجية", "هجرة لبن", "الوسيطاء", "الغنامية", "المصفاة", "طيبة", "الإسكان"] },
];

export const RIYADH_DISTRICTS = RIYADH_ZONES.flatMap((z) => z.districts);

/** The area a district belongs to (by name, ignoring «حي»), or undefined. */
export const zoneOf = (d: string | null | undefined) => RIYADH_ZONES.find((z) => z.districts.includes(districtKey(d)));

/** Every Riyadh district plus any district an offer uses, without duplicates, in Arabic alphabetical order. */
export const allDistricts = (extra: string[] = []) =>
  Array.from(new Set([...RIYADH_DISTRICTS, ...extra].map(districtKey).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));

/** Districts of one area (or all of them when no area is chosen), alphabetical. */
export const districtsIn = (zone: string, all: string[]) => {
  const z = RIYADH_ZONES.find((x) => x.id === zone);
  return z ? all.filter((d) => z.districts.includes(d)) : all;
};
