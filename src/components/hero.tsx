import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { HeroSearch } from "@/components/hero-search";

export function Hero({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const popular =
    lang === "ar"
      ? ["مطاعم", "عيادات", "ملابس", "عقارات", "صيانة"]
      : ["Restaurants", "Clinics", "Clothing", "Real estate", "Repair"];

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft via-background to-background"
      />
      <Container className="py-16 text-center sm:py-20 lg:py-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {dict.hero.badge}
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
          {dict.hero.title}{" "}
          <span className="text-primary">{dict.hero.titleHighlight}</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {dict.hero.subtitle}
        </p>

        <HeroSearch lang={lang} dict={dict} popular={popular} />
      </Container>
    </section>
  );
}
