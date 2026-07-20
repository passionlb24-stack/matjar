import Link from "next/link";
import { ShoppingBag, Store, UtensilsCrossed, Home, Briefcase, Car } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { HeroSearch } from "@/components/hero-search";
import { CountUp } from "@/components/count-up";

// Floating category pills — decorative, desktop only. Anchored to the hero's
// corners so the headline stays the focus.
const FLOATS = [
  { key: "food", Icon: UtensilsCrossed, tint: "bg-accent-soft text-warning", pos: "start-4 top-28", delay: "0s" },
  { key: "realEstate", Icon: Home, tint: "bg-primary-soft text-primary", pos: "start-16 top-64", delay: "1.1s" },
  { key: "jobs", Icon: Briefcase, tint: "bg-success-soft text-success", pos: "end-6 top-32", delay: "0.6s" },
  { key: "cars", Icon: Car, tint: "bg-primary-soft text-primary", pos: "end-14 top-72", delay: "1.6s" },
] as const;

export function Hero({
  lang,
  dict,
  storeCount = 0,
}: {
  lang: Locale;
  dict: Dictionary;
  storeCount?: number;
}) {
  const popular =
    lang === "ar"
      ? ["مطاعم", "عيادات", "ملابس", "عقارات", "سيارات", "صيانة"]
      : ["Restaurants", "Clinics", "Clothing", "Real estate", "Cars", "Repair"];
  const t = dict.hero;
  const pct = lang === "ar" ? "٪" : "%";

  // Only honest numbers: live store count, the 8 real verticals, and static
  // truths (cash-on-delivery, 100% local). No fabricated figures.
  const stats: { node: React.ReactNode; label: string }[] = [
    {
      node: <CountUp to={Math.max(storeCount, 1)} suffix="+" locale={lang} />,
      label: t.stats.storesLabel,
    },
    { node: <CountUp to={8} locale={lang} />, label: t.stats.sectorsLabel },
    { node: t.stats.codValue, label: t.stats.codLabel },
    {
      node: <CountUp to={100} suffix={pct} locale={lang} />,
      label: lang === "ar" ? "محلي لبناني" : "Local",
    },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Layered premium backdrop (decorative). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-soft/70 via-background to-background" />
        <div className="absolute left-1/2 top-[-7rem] h-[26rem] w-[46rem] max-w-[130vw] -translate-x-1/2 rounded-full bg-primary/25 opacity-70 blur-3xl" />
        <div className="absolute end-[-6rem] bottom-[-6rem] h-[22rem] w-[22rem] rounded-full bg-warning/15 opacity-70 blur-3xl" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
            WebkitMaskImage:
              "radial-gradient(ellipse 62% 55% at 50% 0%, #000 42%, transparent 100%)",
            maskImage:
              "radial-gradient(ellipse 62% 55% at 50% 0%, #000 42%, transparent 100%)",
            opacity: 0.45,
          }}
        />
      </div>

      {/* Floating pills — desktop only, purely decorative. */}
      {FLOATS.map(({ key, Icon, tint, pos, delay }) => (
        <div
          key={key}
          aria-hidden
          style={{ animationDelay: delay }}
          className={`animate-float absolute z-0 hidden items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-bold shadow-lg lg:flex ${pos}`}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tint}`}>
            <Icon className="h-4 w-4" />
          </span>
          {t.floats[key]}
        </div>
      ))}

      <Container className="relative py-16 text-center sm:py-20 lg:py-24">
        <div data-animate className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft/80 px-4 py-1.5 text-sm font-semibold text-primary shadow-xs backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {t.badge}
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]">
            {t.title}{" "}
            <span className="bg-gradient-to-br from-primary via-primary to-warning bg-clip-text text-transparent">
              {t.titleHighlight}
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {t.subtitle}
          </p>

          <HeroSearch lang={lang} dict={dict} popular={popular} />

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${lang}/explore`}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-7 text-[15px] font-bold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary-hover hover:shadow-lg active:scale-[0.97]"
            >
              <ShoppingBag className="h-5 w-5" />
              {t.ctaPrimary}
            </Link>
            <Link
              href={`/${lang}/merchant/new`}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-surface-muted px-7 text-[15px] font-bold text-foreground transition-all duration-200 hover:bg-surface-muted/70 active:scale-[0.97]"
            >
              <Store className="h-5 w-5 text-primary" />
              {t.ctaSecondary}
            </Link>
          </div>

          <div className="mx-auto mt-9 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-surface/70 px-3 py-3.5 backdrop-blur-sm"
              >
                <div className="text-2xl font-extrabold tracking-tight tabular-nums">
                  {s.node}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
