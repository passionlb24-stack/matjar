import { ChevronDown, MapPin, Search } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

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

        <div className="mx-auto mt-8 max-w-2xl">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm sm:flex-row sm:items-center sm:gap-0 sm:rounded-full">
            <div className="flex items-center gap-2 px-3 text-sm sm:border-e sm:border-border">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="whitespace-nowrap font-semibold">
                {dict.hero.locationAll}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                type="text"
                placeholder={dict.hero.searchPlaceholder}
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover sm:rounded-full">
              {dict.hero.searchButton}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">{dict.hero.popular}:</span>
            {popular.map((p) => (
              <button
                key={p}
                className="rounded-full border border-border bg-surface px-3 py-1 font-medium transition-colors hover:border-primary hover:text-primary"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
