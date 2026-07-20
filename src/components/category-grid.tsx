import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { categoryKeys, categoryStyles } from "@/lib/catalog";
import { categoryIcons } from "@/components/category-icon";
import { Container } from "@/components/ui/container";

export function CategoryGrid({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <section className="py-14 sm:py-16">
      <Container>
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">
            {dict.categories.title}
          </h2>
          <p className="mt-2 text-muted-foreground">{dict.categories.subtitle}</p>
        </div>

        <div data-animate className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {categoryKeys.map((key) => {
            const Icon = categoryIcons[key];
            const cat = dict.catalog[key];
            return (
              <Link
                key={key}
                href={`/${lang}/category/${key}`}
                className="group rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-xs transition-transform duration-300 group-hover:scale-110 ${categoryStyles[key].iconWrap}`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-bold">{cat.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{cat.desc}</p>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
