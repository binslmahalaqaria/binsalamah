"use client";

/** Mobile field: the visitor types whatever number he wants — no format rules, nothing pre-filled, no placeholder. */
export function PhoneInput({ value, onChange, className, placeholder }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string;
}) {
  return (
    <input
      className={className}
      dir="ltr"
      inputMode="tel"
      autoComplete="tel"
      placeholder={placeholder || ""}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ textAlign: "right" }}
    />
  );
}
