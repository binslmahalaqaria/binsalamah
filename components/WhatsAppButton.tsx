"use client";

import { useLocale, useTranslations } from "next-intl";

interface WhatsAppButtonProps {
  whatsappNumber: string;
  message?: string;
  variant?: "floating" | "inline";
  className?: string;
}

function buildWaLink(number: string, message: string) {
  const params = new URLSearchParams({ text: message });
  return `https://wa.me/${number}?${params.toString()}`;
}

/** Server-safe: no hooks, just a link. Used inline (offer cards, footer). */
export function WhatsAppLink({
  whatsappNumber,
  message,
  className,
  children,
}: WhatsAppButtonProps & { children: React.ReactNode }) {
  if (!whatsappNumber) return null;
  return (
    <a
      href={buildWaLink(whatsappNumber, message ?? "")}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

/** Site-wide floating action button, bottom-corner (flips with RTL/LTR). */
export function FloatingWhatsApp({ whatsappNumber }: { whatsappNumber: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const message =
    locale === "ar"
      ? "مرحبًا، أرغب بالاستفسار عن عروضكم العقارية."
      : "Hello, I'd like to ask about your real estate offers.";

  if (!whatsappNumber) return null;

  return (
    <a
      href={buildWaLink(whatsappNumber, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("contact")}
      className="fixed bottom-6 end-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 fill-current">
        <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.699 4.61 1.902 6.484L4 29l7.73-1.865A11.94 11.94 0 0 0 16.001 27C22.63 27 28 21.627 28 15S22.63 3 16.001 3Zm0 21.75a9.7 9.7 0 0 1-4.95-1.354l-.355-.21-4.59 1.108 1.127-4.472-.232-.367A9.71 9.71 0 0 1 5.25 15c0-5.93 4.82-10.75 10.751-10.75S26.75 9.07 26.75 15 21.932 24.75 16.001 24.75Zm5.34-7.29c-.293-.147-1.734-.856-2.003-.954-.269-.098-.465-.147-.66.147-.196.293-.758.954-.929 1.15-.171.196-.342.22-.635.073-.293-.147-1.235-.455-2.353-1.452-.87-.776-1.457-1.734-1.628-2.027-.171-.293-.018-.451.129-.598.132-.132.293-.343.44-.514.147-.171.196-.293.293-.489.098-.196.049-.367-.024-.514-.073-.147-.66-1.592-.905-2.18-.238-.572-.48-.494-.66-.503l-.562-.01c-.196 0-.514.073-.783.367-.269.293-1.027 1.004-1.027 2.448 0 1.444 1.052 2.84 1.199 3.036.147.196 2.07 3.16 5.017 4.432.701.303 1.248.484 1.675.62.704.224 1.344.192 1.85.117.564-.084 1.734-.709 1.978-1.393.245-.685.245-1.272.171-1.394-.073-.122-.269-.196-.562-.343Z" />
      </svg>
    </a>
  );
}
