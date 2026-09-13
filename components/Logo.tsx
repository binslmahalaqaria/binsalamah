import Image from "next/image";
import { Link } from "@/i18n/navigation";

/**
 * Brand mark + wordmark. The wordmark is live text (Cairo font), not an
 * extracted image — see CLAUDE.md §2b for why. `variant` picks the icon
 * color/text color pairing for the surface it sits on. Wordmark language
 * follows the current locale (Arabic trademark on `/ar`, an English
 * rendering on `/en` since the brand PDF has no dedicated Latin lockup).
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
        src={isDark ? "/brand/logo-mark-navy.png" : "/brand/logo-mark-cream.png"}
        alt="بن سلمه العقارية"
        width={28}
        height={30}
        priority
      />
      <span
        className={`font-heading text-lg leading-none font-extrabold ${
          isDark ? "text-navy" : "text-cream"
        }`}
      >
        {isArabic ? (
          <>
            بن سلمه <span className="font-bold text-gold">العقارية</span>
          </>
        ) : (
          <>
            Bin Salmah <span className="font-bold text-gold">Real Estate</span>
          </>
        )}
      </span>
    </Link>
  );
}
