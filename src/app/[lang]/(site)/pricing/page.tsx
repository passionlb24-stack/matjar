import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Crown } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const title = lang === "ar" ? "الأسعار والخطط" : "Pricing & plans";
  const description =
    lang === "ar"
      ? "خطة مجانية للبداية وخطة Pro بمزايا أقوى — افتح متجرك على متجر وابدأ البيع في لبنان."
      : "A free plan to start and a Pro plan with more power — open your store on Matjar and start selling in Lebanon.";
  return { title, description, alternates: localeAlternates(lang, "/pricing") };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const freeFeatures = dict.pricing.freeFeatures;
  const proFeatures = dict.pricing.proFeatures;

  return (
    <div className="py-14 sm:py-16">
      <Container>
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            {dict.pricing.title}
          </h1>
          <p className="mt-3 text-muted-foreground">{dict.pricing.subtitle}</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl items-start gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface p-8">
            <h2 className="text-lg font-bold">{dict.pricing.free}</h2>
            <p className="mt-3">
              <span className="text-4xl font-extrabold">$0</span>
              <span className="text-muted-foreground">
                {dict.pricing.perMonth}
              </span>
            </p>
            <ul className="mt-6 space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/${lang}/signup`}
              className="mt-8 block rounded-xl border border-border px-5 py-3 text-center font-bold transition-colors hover:border-primary hover:text-primary"
            >
              {dict.pricing.startFree}
            </Link>
          </div>

          <div className="relative rounded-3xl border-2 border-primary bg-surface p-8">
            <span className="absolute -top-3 start-8 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
              {dict.pricing.popular}
            </span>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Crown className="h-5 w-5 text-amber-500" />
              {dict.pricing.pro}
            </h2>
            <p className="mt-3">
              <span className="text-4xl font-extrabold">$12</span>
              <span className="text-muted-foreground">
                {dict.pricing.perMonth}
              </span>
            </p>
            <ul className="mt-6 space-y-3">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/${lang}/merchant/new`}
              className="mt-8 block rounded-xl bg-primary px-5 py-3 text-center font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {dict.pricing.goPro}
            </Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {dict.pricing.contactNote}
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
