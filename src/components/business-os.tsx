import Link from "next/link";
import {
  ClipboardList,
  CalendarCheck,
  Users,
  BarChart3,
  Boxes,
  Wrench,
  ArrowLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { FEATURES, OS_BAND, type OsBandId } from "@/lib/feature-availability";

const ICONS: Record<OsBandId, LucideIcon> = {
  whatsappOrders: ClipboardList,
  bookings: CalendarCheck,
  customers: Users,
  reports: BarChart3,
  inventory: Boxes,
  tools: Wrench,
};

// Homepage / merchant-page "Business OS" band — the piece that reframes Matjar
// from a marketplace into an operating system for the merchant.
//
// The six cards were free text carrying a `soon` flag nobody maintained, and
// they said nothing about which plan any of it needed: "Inventory & POS" sat
// beside "Orders" as though both arrived with the store, when inventory is a
// Business screen and orders are on every plan. Each card now names its own
// plan floor from the availability config, which is itself checked against the
// guard on the screen it describes.
export function BusinessOs({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.businessOs;
  const p = dict.pricing;

  const planLabel = (id: OsBandId) => {
    const floor = FEATURES[id].plan;
    return floor === "free" ? t.included : p.tiers[floor].name;
  };

  return (
    <section className="border-y border-border bg-surface-muted/30 py-10 sm:py-20">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{t.kicker}</span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground sm:text-lg">{t.subtitle}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OS_BAND.map((id) => {
            const Icon = ICONS[id];
            const free = FEATURES[id].plan === "free";
            return (
              <div key={id} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 flex flex-wrap items-center gap-2 font-bold">
                  {p.features[id]}
                  <Badge variant={free ? "success" : "primary"}>{planLabel(id)}</Badge>
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.desc[id]}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/${lang}/merchant/new`}
            className="inline-flex h-12 items-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          >
            {t.ctaPrimary}
          </Link>
          <Link
            href={`/${lang}/merchants`}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-surface px-6 text-sm font-bold transition-colors hover:border-primary/40"
          >
            {t.ctaSecondary}
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
