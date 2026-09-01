import Image from "next/image";
import { BadgeCheck } from "lucide-react";

import { NEUTRAL_BLUR } from "@/lib/image-placeholder";
import type { PortfolioItem } from "@/lib/professional";
import type { ProfessionalDict } from "./copy";

// The work, as a grid.
//
// Two things here are not styling decisions.
//
// 1. A before/after is only a before/after when a `before` image genuinely
//    exists. Where it does, the item takes the full row and shows both frames
//    side by side, each labelled — a repair, a paint job, a restored piece of
//    furniture is not legible as a single "after" photo, and cropping the pair
//    into a square thumbnail throws away the only thing that made it evidence.
//    Where it does not, the item is one image and says nothing about "before".
//
// 2. `viaMatjar` is the platform vouching that this came out of a completed
//    job here — it is the single strongest claim on the page. Every portfolio
//    item on the platform today is self-uploaded, so the badge should be rare,
//    and it is marked distinctly rather than blended into the tile so that a
//    self-uploaded photo can never borrow its authority.

function Frame({
  src,
  alt,
  label,
  sizes,
}: {
  src: string;
  alt: string;
  label?: string;
  sizes: string;
}) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        placeholder="blur"
        blurDataURL={NEUTRAL_BLUR}
        className="object-cover"
      />
      {label && (
        <span className="absolute bottom-2 start-2 rounded-full bg-foreground/70 px-2 py-0.5 text-[11px] font-bold text-surface backdrop-blur-sm">
          {label}
        </span>
      )}
    </div>
  );
}

export function ProfessionalPortfolio({
  items,
  dict,
  title,
  id,
  className = "",
}: {
  items: PortfolioItem[];
  dict: ProfessionalDict;
  /** `null` suppresses the heading; omitted uses the dictionary's. */
  title?: string | null;
  id?: string;
  className?: string;
}) {
  // Nothing uploaded: nothing rendered. No dashed "add your first photo" box on
  // a page a customer is reading — that prompt belongs on the professional's
  // own dashboard, which is what ProfessionalCompleteness is.
  if (!items.length) return null;

  const t = dict.professional.portfolio;
  const heading = title === undefined ? t.title : title;

  return (
    <section id={id} className={className}>
      {heading && <h2 className="mb-3 text-lg font-extrabold">{heading}</h2>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const pair = Boolean(item.beforeImageUrl);
          const alt = item.title ?? "";
          return (
            <li
              key={item.id}
              className={`overflow-hidden rounded-2xl border border-border bg-surface ${
                pair ? "col-span-2" : ""
              }`}
            >
              <div className="relative">
                {pair ? (
                  <div className="grid grid-cols-2 gap-px bg-border">
                    <Frame
                      src={item.beforeImageUrl as string}
                      alt={alt}
                      label={t.before}
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                    <Frame
                      src={item.imageUrl}
                      alt={alt}
                      label={t.after}
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <Frame
                    src={item.imageUrl}
                    alt={alt}
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                )}

                {item.viaMatjar && (
                  <span className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.viaMatjar}
                    <span className="sr-only"> — {t.viaMatjarWhy}</span>
                  </span>
                )}
              </div>

              {(item.title || item.year) && (
                <div className="flex items-baseline justify-between gap-2 px-3 py-2">
                  {item.title && (
                    <p dir="auto" className="min-w-0 truncate text-xs font-bold">
                      {item.title}
                    </p>
                  )}
                  {item.year && (
                    <span
                      dir="ltr"
                      className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                    >
                      {item.year}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
