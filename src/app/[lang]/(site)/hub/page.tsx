import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap, Users, Sparkles } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { HUB_TOOLS } from "@/lib/hub-tools";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.hub.title,
    description: dict.hub.subtitle,
    alternates: localeAlternates(lang, "/hub"),
  };
}

export default async function HubPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const h = dict.hub;

  return (
    <div className="py-12 sm:py-16">
      <Container>
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 sm:p-12">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-bl from-primary/10 via-transparent to-transparent" />
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-4 w-4" /> {h.eyebrow}
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
            {h.title}
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground sm:text-lg">{h.subtitle}</p>
        </div>

        {/* Tools */}
        <div className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">{h.toolsTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{h.toolsSubtitle}</p>
            </div>
            <Link
              href={`/${lang}/hub/tools`}
              className="hidden shrink-0 items-center gap-1 text-sm font-bold text-primary hover:underline sm:inline-flex"
            >
              {h.allTools}
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HUB_TOOLS.map((tool) => {
              const td = h.tools[tool.slug as keyof typeof h.tools];
              const Icon = tool.Icon;
              return (
                <Link
                  key={tool.slug}
                  href={`/${lang}/hub/tools/${tool.slug}`}
                  className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span className={`grid h-12 w-12 place-items-center rounded-xl ${tool.tint}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-bold transition-colors group-hover:text-primary">{td.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{td.desc}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* More hub sections */}
        <div className="mt-14">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{h.moreSoon}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SectionCard lang={lang} href="hub/academy" Icon={GraduationCap} title={h.academyTitle} note={h.academyNote} />
            <SectionCard lang={lang} href="hub/leaders" Icon={Users} title={h.leadersTitle} note={h.leadersNote} />
          </div>
        </div>
      </Container>
    </div>
  );
}

function SectionCard({
  lang,
  href,
  Icon,
  title,
  note,
}: {
  lang: string;
  href: string;
  Icon: typeof GraduationCap;
  title: string;
  note: string;
}) {
  return (
    <Link
      href={`/${lang}/${href}`}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="flex items-center gap-1.5 font-bold transition-colors group-hover:text-primary">
          {title}
          <ArrowLeft className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      </div>
    </Link>
  );
}
