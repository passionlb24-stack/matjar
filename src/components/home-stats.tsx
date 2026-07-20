import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";
import { Container } from "@/components/ui/container";
import { CountUp } from "@/components/count-up";

// Real-number proof band. Every figure is live (store & listing counts) or a
// hard fact (8 verticals, the regions we cover) — nothing invented.
export function HomeStats({
  lang,
  dict,
  storeCount,
  productCount,
}: {
  lang: Locale;
  dict: Dictionary;
  storeCount: number;
  productCount: number;
}) {
  const t = dict.homeStats;
  const items: { to: number; suffix?: string; label: string }[] = [
    { to: Math.max(storeCount, 1), suffix: "+", label: t.storesLabel },
    { to: Math.max(productCount, 1), suffix: "+", label: t.productsLabel },
    { to: 8, label: t.sectorsLabel },
    { to: regions.length, label: t.citiesLabel },
  ];

  return (
    <section className="py-6 sm:py-10">
      <Container>
        <div
          data-animate
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-hover px-6 py-10 shadow-xl sm:px-10 sm:py-12"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.18), transparent 45%)",
            }}
          />
          <div className="relative grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
            {items.map((it, i) => (
              <div key={i}>
                <div className="text-3xl font-extrabold tracking-tight text-primary-foreground tabular-nums sm:text-4xl">
                  <CountUp to={it.to} suffix={it.suffix} locale={lang} />
                </div>
                <div className="mt-1 text-sm font-semibold text-primary-foreground/80">
                  {it.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
