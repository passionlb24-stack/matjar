import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { jsonLdScript } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/site";

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
        // eslint-disable-next-line react/no-danger
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
              {!last && <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
