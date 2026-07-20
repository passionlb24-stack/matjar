import Link from "next/link";
import {
  ShoppingBag,
  UtensilsCrossed,
  Wrench,
  Briefcase,
  Sparkles,
  Home,
  Car,
  Tags,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

// The platform's thesis, made visible: MatjarLB is 8 worlds under one roof.
// This leads the page right after the hero so a first-time visitor instantly
// grasps the breadth (not "a shop" — a local super-app).
type WorldKey =
  | "stores"
  | "food"
  | "services"
  | "jobs"
  | "freelance"
  | "realEstate"
  | "automotive"
  | "market";

const WORLDS: {
  key: WorldKey;
  href: (lang: string) => string;
  Icon: LucideIcon;
  tint: string;
}[] = [
  { key: "stores", href: (l) => `/${l}/explore`, Icon: ShoppingBag, tint: "bg-primary-soft text-primary" },
  { key: "food", href: (l) => `/${l}/category/food`, Icon: UtensilsCrossed, tint: "bg-accent-soft text-warning" },
  { key: "services", href: (l) => `/${l}/category/services`, Icon: Wrench, tint: "bg-success-soft text-success" },
  { key: "jobs", href: (l) => `/${l}/jobs`, Icon: Briefcase, tint: "bg-primary-soft text-primary" },
  { key: "freelance", href: (l) => `/${l}/freelance`, Icon: Sparkles, tint: "bg-accent-soft text-warning" },
  { key: "realEstate", href: (l) => `/${l}/category/realEstate`, Icon: Home, tint: "bg-primary-soft text-primary" },
  { key: "automotive", href: (l) => `/${l}/category/automotive`, Icon: Car, tint: "bg-success-soft text-success" },
  { key: "market", href: (l) => `/${l}/market`, Icon: Tags, tint: "bg-accent-soft text-warning" },
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
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          {WORLDS.map(({ key, href, Icon, tint }) => (
            <Link
              key={key}
              href={href(lang)}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-xs transition-transform duration-300 group-hover:scale-110 ${tint}`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-base font-extrabold">{t.items[key].title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t.items[key].desc}
              </p>
              <ArrowLeft className="absolute end-4 top-5 h-4 w-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100 ltr:rotate-180" />
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
