"use client";

/**
 * Saudi mobile field: always starts with «05», digits only, 10 digits max —
 * so every lead reaches the CRM in the same 05xxxxxxxx form. Pasted numbers
 * in +966 / 966 / 5xxxxxxxx form are converted.
 */
export const isSaudiMobile = (v: string) => /^05\d{8}$/.test(v);

export function normalizePhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00966")) d = d.slice(5);
  else if (d.startsWith("966")) d = d.slice(3);
  if (d.startsWith("5")) d = "0" + d;
  if (!d.startsWith("05")) d = "05" + d.replace(/^0*5?/, "");
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
      maxLength={10}
      placeholder={placeholder || "05xxxxxxxx"}
      value={value || "05"}
      onFocus={(e) => { if (!value) onChange("05"); requestAnimationFrame(() => e.target.setSelectionRange(10, 10)); }}
      onChange={(e) => onChange(normalizePhone(e.target.value))}
      style={{ textAlign: "right" }}
    />
  );
}
