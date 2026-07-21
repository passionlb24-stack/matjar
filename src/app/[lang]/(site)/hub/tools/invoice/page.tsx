import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { HubToolShell } from "@/components/hub/tool-shell";
import { InvoiceGenerator } from "@/components/hub/invoice-generator";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.hub.tools.invoice.name, description: dict.hub.tools.invoice.desc, alternates: localeAlternates(lang, "/hub/tools/invoice") };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <HubToolShell lang={lang} hubLabel={dict.hub.backToHub} title={dict.hub.tools.invoice.name} desc={dict.hub.tools.invoice.desc}>
      <InvoiceGenerator dict={dict} />
    </HubToolShell>
  );
}
