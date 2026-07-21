import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { groupKeys } from "@/lib/catalog";
import { groupIcons } from "@/components/category-icon";
import { Container } from "@/components/ui/container";

// Top-level groups (the clean navigation layer above the ~17 granular sectors).
// Each links into /explore filtered by group.
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
          {groupKeys.map((g) => {
            const Icon = groupIcons[g];
            const grp = dict.groups[g];
            return (
              <Link
                key={g}
                href={`/${lang}/explore?group=${g}`}
                className="group rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-bold">{grp.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{grp.desc}</p>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
