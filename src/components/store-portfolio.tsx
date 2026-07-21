import { Images, ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export type PortfolioItem = {
  id: string;
  title: string;
  title_en: string | null;
  description: string | null;
  image_url: string | null;
  link: string | null;
};

// Public proof-of-work gallery (services & contractors). A visual trust builder:
// images of past jobs with an optional external link.
export function StorePortfolio({
  items,
  dict,
  lang,
}: {
  items: PortfolioItem[];
  dict: Dictionary;
  lang: Locale;
}) {
  if (!items.length) return null;
  const t = dict.portfolio;

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <Images className="h-5 w-5 text-primary" />
        {t.publicTitle}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const title = lang === "en" ? it.title_en || it.title : it.title;
          const card = (
            <>
              {it.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.image_url}
                  alt={title}
                  className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-surface-muted">
                  <Images className="h-8 w-8 text-black/15" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <h3 className="flex items-center gap-1 font-bold">
                  {title}
                  {it.link && <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
                </h3>
                {it.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{it.description}</p>
                )}
              </div>
            </>
          );
          const cls =
            "group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md";
          return it.link ? (
            <a key={it.id} href={it.link} target="_blank" rel="noopener noreferrer" className={cls}>
              {card}
            </a>
          ) : (
            <div key={it.id} className={cls}>
              {card}
            </div>
          );
        })}
      </div>
    </section>
  );
}
