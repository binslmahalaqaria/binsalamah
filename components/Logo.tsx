import Image from "next/image";
import { Link } from "@/i18n/navigation";

/**
 * Brand mark + wordmark. The wordmark is live text (Darah Modern font), not
 * an extracted image — see CLAUDE.md §2b. `variant` picks the icon/text
 * color pairing for the surface it sits on. Wordmark language follows the
 * current locale (Arabic on `/ar`, the logo's own Latin lockup — "Bin
 * Slmah", matching the binslmah.com domain spelling — on `/en`).
 */
export function Logo({
  variant = "dark",
  locale,
}: {
  variant?: "dark" | "light";
  locale: string;
}) {
  const isDark = variant === "dark";
  const isArabic = locale === "ar";

  return (
    <Link href="/" className="flex shrink-0 items-center gap-2">
      <Image
        src={isDark ? "/brand/logo-mark-dark.png" : "/brand/logo-mark-white.png"}
        alt="بن سلمه العقارية"
        width={24}
        height={36}
        priority
      />
      <span
        className={`font-heading text-lg leading-none font-extrabold ${
          isDark ? "text-navy" : "text-cream"
        }`}
      >
        {isArabic ? "بن سلمه العقارية" : "Bin Slmah Real Estate"}
      </span>
    </Link>
  );
}
