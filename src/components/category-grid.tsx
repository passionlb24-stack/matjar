import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { groupCategories, groupKeys, type CategoryKey, type GroupKey } from "@/lib/catalog";
import { groupIcons } from "@/components/category-icon";
import { Container } from "@/components/ui/container";

/**
 * The top-level browse grid.
 *
 * It used to render all nine groups unconditionally. Five of them have no store
 * at all, so more than half the grid was a promise the next page could not keep:
 * tap "Automotive", get an empty screen, conclude the site is broken. A tile now
 * needs a store behind it, and it carries the count so the buyer knows what they
 * are tapping into before they tap.
 *
 * The sub-links are the same rule one level down — only the sectors inside a
 * group that actually have a merchant.
 */
export function CategoryGrid({
  lang,
  dict,
  counts,
}: {
  lang: Locale;
  dict: Dictionary;
  /** Live store counts per group and per sector. */
  counts?: {
    byGroup: Partial<Record<GroupKey, number>>;
    bySector: Partial<Record<CategoryKey, number>>;
  };
}) {
  // Without counts (no data source in hand) nothing is suppressed — this stays
  // a presentation component, not one with an opinion about the database.
  const shown = counts
    ? groupKeys.filter((g) => (counts.byGroup[g] ?? 0) > 0)
    : groupKeys;

  if (!shown.length) return null;

  return (
    <section className="py-10 sm:py-16">
      <Container>
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">
            {dict.categories.title}
          </h2>
          <p className="mt-2 text-muted-foreground">{dict.categories.subtitle}</p>
        </div>

        <div data-animate className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {shown.map((g) => {
            const Icon = groupIcons[g];
            const grp = dict.groups[g];
            const total = counts?.byGroup[g];
            const sectors = counts
              ? groupCategories(g).filter((c) => (counts.bySector[c] ?? 0) > 0)
              : [];
            return (
              <div
                key={g}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <Link
                  href={`/${lang}/explore?group=${g}`}
                  className="group block"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon aria-hidden className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 flex items-center gap-2 font-bold transition-colors group-hover:text-primary">
                    {grp.name}
                    {total != null && (
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                        {total}
                      </span>
                    )}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{grp.desc}</p>
                </Link>

                {/* Only shown when a group holds more than one live sector —
                    one sub-link that duplicates the tile above it is noise. */}
                {sectors.length > 1 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {sectors.map((c) => (
                      <li key={c}>
                        <Link
                          href={`/${lang}/category/${c}`}
                          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-semibold transition-colors hover:border-primary/40"
                        >
                          {dict.catalog[c].name}
                          <span className="text-xs font-medium tabular-nums opacity-70">
                            {counts?.bySector[c]}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
