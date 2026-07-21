import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { HUB_TOOLS, HUB_TOOL_CATEGORIES } from "@/lib/hub-tools";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.hub.toolsTitle,
    description: dict.hub.toolsSubtitle,
    alternates: localeAlternates(lang, "/hub/tools"),
  };
}

export default async function HubToolsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const h = dict.hub;

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <Link
          href={`/${lang}/hub`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {h.backToHub}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{h.toolsTitle}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{h.toolsSubtitle}</p>

        <div className="mt-10 space-y-10">
          {HUB_TOOL_CATEGORIES.map((cat) => {
            const tools = HUB_TOOLS.filter((t) => t.category === cat);
            if (!tools.length) return null;
            return (
              <section key={cat}>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  {h.categories[cat]}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => {
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
              </section>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
