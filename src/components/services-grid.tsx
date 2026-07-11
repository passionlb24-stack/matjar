import Link from "next/link";
import { Briefcase, Sparkles, Boxes, Truck, Map as MapIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

export function ServicesGrid({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const v = dict.verticals;
  const items = [
    { href: `/${lang}/jobs`, title: dict.jobs.title, desc: v.jobs, Icon: Briefcase },
    { href: `/${lang}/freelance`, title: dict.freelance.title, desc: v.freelance, Icon: Sparkles },
    { href: `/${lang}/wholesale`, title: dict.wholesale.title, desc: v.wholesale, Icon: Boxes },
    { href: `/${lang}/delivery`, title: dict.delivery.title, desc: v.delivery, Icon: Truck },
    { href: `/${lang}/map`, title: dict.map.title, desc: v.map, Icon: MapIcon },
  ];

  return (
    <section className="bg-surface-muted/30 py-14 sm:py-16">
      <Container>
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">{v.title}</h2>
          <p className="mt-2 text-muted-foreground">{v.subtitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map(({ href, title, desc, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col items-center rounded-2xl border border-border bg-surface p-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
