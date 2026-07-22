import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Wallet, BadgeCheck, MessageCircle, AlertCircle, Lock, Ban, Headphones, Check, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  const dict = await getDictionary(lang);
  const t = dict.trustPage;
  return { title: t.metaTitle, description: t.metaDesc, alternates: localeAlternates(lang, "/trust") };
}

const CUSTOMER_ICONS: LucideIcon[] = [Wallet, BadgeCheck, MessageCircle, AlertCircle];
const MERCHANT_ICONS: LucideIcon[] = [Lock, Ban, Headphones, Check];

export default async function TrustPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.trustPage;
  const base = `/${lang}`;

  return (
    <div className="pb-16">
      <div className="border-b border-border bg-surface-muted/30">
        <Container className="py-14 sm:py-18">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <ShieldCheck className="h-4 w-4" /> {t.kicker}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{t.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{t.intro}</p>
          </div>
        </Container>
      </div>

      <Container className="max-w-4xl">
        {/* Customer + Merchant */}
        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          {[
            { title: t.customerTitle, items: t.customer, icons: CUSTOMER_ICONS },
            { title: t.merchantTitle, items: t.merchant, icons: MERCHANT_ICONS },
          ].map((col, ci) => (
            <div key={ci}>
              <h2 className="text-xl font-extrabold tracking-tight">{col.title}</h2>
              <div className="mt-5 grid gap-3">
                {col.items.map((it, i) => {
                  const Icon = col.icons[i] ?? Check;
                  return (
                    <div key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" /></span>
                      <div>
                        <h3 className="font-bold">{it.t}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">{it.d}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Returns */}
        <section className="mt-14 rounded-3xl border border-border bg-surface p-7 shadow-sm sm:p-9">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><RotateCcw className="h-5 w-5 text-primary" /> {t.returnsTitle}</h2>
          <p className="mt-3 max-w-2xl leading-8 text-muted-foreground">{t.returnsBody}</p>
        </section>

        {/* Support */}
        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-bl from-primary/10 to-transparent p-8 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight">{t.supportTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t.supportBody}</p>
          <Link href={`${base}/contact`} className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover">
            {t.contactCta}
          </Link>
        </section>
      </Container>
    </div>
  );
}
