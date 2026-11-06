import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalPage } from "@/components/site/LegalPage";
import { TERMS } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  return { title: TERMS[(await getLocale()) === "ar" ? "ar" : "en"].title };
}

export default async function Page() {
  const ar = (await getLocale()) === "ar";
  return <LegalPage doc={TERMS[ar ? "ar" : "en"]} ar={ar} />;
}
