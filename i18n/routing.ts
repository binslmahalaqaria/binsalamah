import { defineRouting } from "next-intl/routing";

/**
 * Central i18n routing config. See CLAUDE.md §2, §4, §7.
 * - Arabic is the default/primary locale (main audience: Saudi clients).
 * - English is secondary.
 * - Both the public website and the CRM (/admin) are bilingual.
 */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
  // Always send "/" to the default locale (Arabic) rather than guessing
  // from the browser's Accept-Language header — see CLAUDE.md §4/§7.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
