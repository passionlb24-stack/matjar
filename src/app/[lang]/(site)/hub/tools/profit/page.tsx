import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { HubToolShell } from "@/components/hub/tool-shell";
import { ProfitCalculator } from "@/components/hub/profit-calculator";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.hub.tools.profit.name, description: dict.hub.tools.profit.desc, alternates: localeAlternates(lang, "/hub/tools/profit") };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <HubToolShell lang={lang} hubLabel={dict.hub.backToHub} title={dict.hub.tools.profit.name} desc={dict.hub.tools.profit.desc}>
      <ProfitCalculator dict={dict} />
    </HubToolShell>
  );
}
