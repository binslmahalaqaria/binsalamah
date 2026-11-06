import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalPage } from "@/components/site/LegalPage";
import { PRIVACY } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  return { title: PRIVACY[(await getLocale()) === "ar" ? "ar" : "en"].title };
}

export default async function Page() {
  const ar = (await getLocale()) === "ar";
  return <LegalPage doc={PRIVACY[ar ? "ar" : "en"]} ar={ar} />;
}
