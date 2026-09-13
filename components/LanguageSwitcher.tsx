"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Toggles between "ar" and "en" while staying on the equivalent page,
 * per CLAUDE.md §7/§8/§9 and TESTING.md's i18n test cases.
 */
export function LanguageSwitcher({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const nextLocale = locale === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        variant === "dark"
          ? "border-navy/20 text-navy hover:bg-navy hover:text-cream"
          : "border-cream/30 text-cream hover:bg-cream/10"
      }`}
    >
      {t("language")}
    </button>
  );
}
