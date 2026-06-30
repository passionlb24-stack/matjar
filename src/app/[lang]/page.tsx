import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  const features = [
    dict.landing.features.modular,
    dict.landing.features.easy,
    dict.landing.features.local,
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-foreground/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            م
          </div>
          <span className="text-lg font-bold">{dict.common.brand}</span>
        </div>
        <LanguageSwitcher currentLocale={lang} pathname={`/${lang}`} />
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <span className="mb-4 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          {dict.common.tagline}
        </span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          {dict.landing.heroTitle}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-foreground/60">
          {dict.landing.heroSubtitle}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="#"
            className="rounded-full bg-primary px-7 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {dict.landing.ctaMerchant}
          </a>
          <a
            href="#"
            className="rounded-full border border-foreground/15 px-7 py-3 font-semibold transition-colors hover:bg-foreground/5"
          >
            {dict.landing.ctaCustomer}
          </a>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-foreground/10 bg-foreground/[0.02] px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold">
          {dict.landing.featuresTitle}
        </h2>
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-foreground/10 bg-background p-6"
            >
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-foreground/60">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-foreground/10 px-6 py-6 text-center text-sm text-foreground/50">
        © 2026 {dict.common.brand} — {dict.common.tagline}
      </footer>
    </div>
  );
}
