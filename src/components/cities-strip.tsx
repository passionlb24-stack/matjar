import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { regions } from "@/lib/catalog";
import { Container } from "@/components/ui/container";

// Region shortcuts — a fast "shop near me" entry point. Uses the real region
// list (links into /explore filtered by region). Gradient tiles keyed by index
// so it looks intentional without needing per-region photography yet.
const GRADIENTS = [
  "from-primary to-primary-hover",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-rose-500 to-red-600",
];

export function CitiesStrip({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.home2;
  return (
    <section className="py-8 sm:py-12">
      <Container>
        <div className="mb-6 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
            {t.citiesTitle}
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t.citiesSubtitle}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {regions.map((r, i) => (
            <Link
              key={r.key}
              href={`/${lang}/explore?region=${r.key}`}
              className={`group relative flex h-28 items-end overflow-hidden rounded-2xl bg-gradient-to-br p-4 shadow-sm transition-transform duration-300 hover:-translate-y-1 ${
                GRADIENTS[i % GRADIENTS.length]
              }`}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"
              />
              <MapPin
                aria-hidden
                className="absolute -end-3 -top-3 h-16 w-16 text-white/15 transition-transform duration-500 group-hover:scale-110"
              />
              <span className="relative font-extrabold text-white">
                {r.name[lang]}
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
