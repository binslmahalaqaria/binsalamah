import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation helpers. Always use these instead of the plain
 * `next/link` / `next/navigation` equivalents anywhere under app/[locale],
 * so the current locale is preserved automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
