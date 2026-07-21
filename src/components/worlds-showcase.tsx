import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { groupKeys } from "@/lib/catalog";
import { groupIcons } from "@/components/category-icon";
import { Container } from "@/components/ui/container";

// The platform's thesis, made visible: MatjarLB is many worlds under one roof.
// Renders the top-level GROUPS (shopping, food, services, health, sports,
// bookings, real estate, automotive, education) — the clean navigation layer
// above the granular sectors. Each links into /explore filtered by group.
const TINTS = [
  "bg-primary-soft text-primary",
  "bg-accent-soft text-warning",
  "bg-success-soft text-success",
];

export function WorldsShowcase({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.worlds;
  return (
    <section className="py-14 sm:py-20">
      <Container>
        <div className="mb-8 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
            {t.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
            {t.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {t.subtitle}
          </p>
        </div>

        <div
          data-animate
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
        >
          {groupKeys.map((g, i) => {
            const Icon = groupIcons[g];
            const grp = dict.groups[g];
            return (
              <Link
                key={g}
                href={`/${lang}/explore?group=${g}`}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-xs transition-transform duration-300 group-hover:scale-110 ${TINTS[i % TINTS.length]}`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-base font-extrabold">{grp.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {grp.desc}
                </p>
                <ArrowLeft className="absolute end-4 top-5 h-4 w-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100 ltr:rotate-180" />
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
