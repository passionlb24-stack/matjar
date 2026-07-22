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

const ICONS: LucideIcon[] = [ClipboardList, CalendarCheck, Users, BarChart3, Boxes, Wrench];

// Homepage "Business OS" band — the piece the audit found missing: it reframes
// Matjar from a marketplace into an operating system for the merchant. Static
// content (no counts, no fabricated data) surfaced high on the page.
export function BusinessOs({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.businessOs;
  return (
    <section className="border-y border-border bg-surface-muted/30 py-14 sm:py-20">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{t.kicker}</span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground sm:text-lg">{t.subtitle}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.cards.map((c, i) => {
            const Icon = ICONS[i] ?? Wrench;
            return (
              <div key={i} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 flex items-center gap-2 font-bold">
                  {c.t}
                  {c.soon && (
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {t.soon}
                    </span>
                  )}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
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
