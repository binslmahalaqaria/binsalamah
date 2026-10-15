import Image from "next/image";
import { Link } from "@/i18n/navigation";

/**
 * The official Bin Slmah lockup, cut from the client's brand file (Illustrator
 * PDF, 2026-10-15) into transparent PNGs in /public/brand: the mark, the Arabic
 * wordmark (Darah Modern, outlined) and «Bin Slmah Real Estate» (Rubik) — so it
 * matches the identity exactly in every colour.
 *  - layout "row": mark beside the two wordmark lines (headers).
 *  - layout "stack": mark above the two lines, centred (hero, footer).
 * `variant` picks the colour for the surface: dark ink, white, or gold.
 */
type Variant = "dark" | "light" | "gold";
const file = (part: string, v: Variant) => `/brand/${part}-${v === "light" ? "white" : v}.png`;

export function Logo({
  variant = "dark",
  layout = "row",
  height = 44,
  link = true,
}: {
  variant?: Variant;
  /** Kept for older callers; the lockup is bilingual and does not change with the locale. */
  locale?: string;
  layout?: "row" | "stack";
  /** Height of the mark in px; the wordmarks scale with it. */
  height?: number;
  link?: boolean;
}) {
  const markW = Math.round((height * 534) / 804);
  // Wordmark widths follow the brand file: the Arabic line is ~2.12× the mark width in the stacked lockup.
  const textW = layout === "stack" ? Math.round(markW * 3.2) : Math.round(height * 2.9);
  const arH = Math.round((textW * 249) / 1706);
  const enH = Math.round((textW * 130) / 1689);
  const body = (
    <span className={layout === "stack" ? "flex flex-col items-center gap-[0.35em]" : "flex items-center gap-3"} style={{ fontSize: height / 4 }}>
      <Image src={file("logo-mark-hd", variant)} alt="بن سلمه العقارية" width={markW} height={height} priority />
      <span className="flex flex-col items-center gap-[0.3em]" aria-hidden>
        <Image src={file("wordmark-ar", variant)} alt="" width={textW} height={arH} priority />
        <Image src={file("wordmark-en", variant)} alt="" width={textW} height={enH} priority />
      </span>
      <span className="sr-only">Bin Slmah Real Estate</span>
    </span>
  );
  return link ? <Link href="/" className="flex shrink-0 items-center">{body}</Link> : body;
}
