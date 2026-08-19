import Link from "next/link";
import { jsonLdScript } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/site";
import { ChevronNext } from "@/components/ui/directional-icon";

export type Crumb = { label: string; href?: string };

// Accessible breadcrumb trail + BreadcrumbList structured data (SEO). The last
// item is the current page (no link). Chevron flips for RTL automatically.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const listLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${SITE_URL}${c.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="breadcrumb" className="mb-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(listLd) }}
      />
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="transition-colors hover:text-foreground"
                >
                  {c.label}
                </Link>
              ) : (
                <span className={last ? "font-semibold text-foreground" : ""}>
                  {c.label}
                </span>
              )}
              {/* Forward separator: points right in LTR, left in RTL. This is
                  the app's ONLY breadcrumb — the separator follows its label,
                  which is what distinguishes a crumb trail from the leading
                  chevron the inner pages use for "up a level". */}
              {!last && <ChevronNext className="h-3.5 w-3.5" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
