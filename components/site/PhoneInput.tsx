"use client";

/**
 * Saudi mobile field: the visitor types the whole number himself (nothing is pre-filled), digits only, 10 digits max.
 * Pasted numbers in +966 / 966 form are converted; a number typed as 5xxxxxxxx gets its leading 0 when the field is left,
 * so every lead reaches the CRM in the same 05xxxxxxxx form.
 */
export const isSaudiMobile = (v: string) => /^05\d{8}$/.test(v);

export function normalizePhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00966")) d = d.slice(5);
  else if (d.startsWith("966")) d = d.slice(3);
  return d.slice(0, 10);
}

export function PhoneInput({ value, onChange, className, placeholder }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string;
}) {
  return (
    <input
      className={className}
      dir="ltr"
      inputMode="numeric"
      autoComplete="tel"
      maxLength={14}
      placeholder={placeholder || "05xxxxxxxx"}
      value={value}
      onChange={(e) => onChange(normalizePhone(e.target.value))}
      onBlur={() => { if (/^5\d{8}$/.test(value)) onChange("0" + value); }}
      style={{ textAlign: "right" }}
    />
  );
}
