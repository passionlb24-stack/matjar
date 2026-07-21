import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { HubToolShell } from "@/components/hub/tool-shell";
import { QrGenerator } from "@/components/hub/qr-generator";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.hub.tools.qr.name, description: dict.hub.tools.qr.desc, alternates: localeAlternates(lang, "/hub/tools/qr") };
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <HubToolShell lang={lang} hubLabel={dict.hub.backToHub} title={dict.hub.tools.qr.name} desc={dict.hub.tools.qr.desc}>
      <QrGenerator dict={dict} />
    </HubToolShell>
  );
}
