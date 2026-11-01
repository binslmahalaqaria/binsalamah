"use client";

/**
 * Mobile field: the visitor types the whole number himself (nothing is pre-filled).
 * Saudi numbers: digits only, 10 max (+966 / 966 pasted are converted; 5xxxxxxxx gets its leading 0 when the field is left).
 * International numbers: start with + (or 00), e.g. +44 7911 123456 — kept as «+<digits>» (15 digits max).
 */
export const isSaudiMobile = (v: string) => /^05\d{8}$/.test(v);

export function normalizePhone(raw: string) {
  const t = raw.trim();
  const digits = t.replace(/\D/g, "");
  const foreign = t.startsWith("+") || t.startsWith("00");
  if (foreign) {
    const d = t.startsWith("00") ? digits.slice(2) : digits;
    if (d.startsWith("966")) return d.slice(3, 13);
    return "+" + d.slice(0, 15);
  }
  if (digits.startsWith("966")) return digits.slice(3, 13);
  return digits.slice(0, 10);
}

export function PhoneInput({ value, onChange, className, placeholder }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string;
}) {
  return (
    <input
      className={className}
      dir="ltr"
      inputMode="tel"
      autoComplete="tel"
      maxLength={18}
      placeholder={placeholder || "05xxxxxxxx — أو +44…"}
      value={value}
      onChange={(e) => onChange(normalizePhone(e.target.value))}
      onBlur={() => { if (/^5\d{8}$/.test(value)) onChange("0" + value); }}
      style={{ textAlign: "right" }}
    />
  );
}
