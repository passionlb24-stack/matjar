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
      {/* Layered, premium backdrop (all decorative). A soft brand glow behind
          the headline + a faint grid that fades toward the content — the
          "product landing" signature, token-driven so it holds in dark mode. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-soft/70 via-background to-background" />
        <div className="absolute left-1/2 top-[-7rem] h-[26rem] w-[46rem] max-w-[130vw] -translate-x-1/2 rounded-full bg-primary/25 opacity-70 blur-3xl" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 55% at 50% 0%, #000 45%, transparent 100%)",
            maskImage:
              "radial-gradient(ellipse 60% 55% at 50% 0%, #000 45%, transparent 100%)",
            opacity: 0.45,
          }}
        />
      </div>
      <Container className="py-16 text-center sm:py-20 lg:py-24">
        <div data-animate>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft/80 px-4 py-1.5 text-sm font-semibold text-primary shadow-xs backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {dict.hero.badge}
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {dict.hero.title}{" "}
            <span className="bg-gradient-to-br from-primary to-primary/55 bg-clip-text text-transparent">
              {dict.hero.titleHighlight}
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {dict.hero.subtitle}
          </p>

          <HeroSearch lang={lang} dict={dict} popular={popular} />
        </div>
      </Container>
    </section>
  );
}
