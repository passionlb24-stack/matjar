import Link from "next/link";
import { Check, Circle, Sparkles, PartyPopper, ExternalLink } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { SITE_URL } from "@/lib/site";
import { ShareButton } from "@/components/share-button";

export type ChecklistState = {
  logo: boolean;
  cover: boolean;
  description: boolean;
  hours: boolean;
  whatsapp: boolean;
  products: boolean;
  brandColor: boolean;
  customLink: boolean;
};

// Onboarding nudge shown on the OS home. While the store is being set up it's a
// progress checklist that deep-links each missing step. Once everything is done
// it flips into a "your store is ready — share it" card, because the merchant's
// next job (and the platform's) is to get that link in front of customers.
export function StoreChecklist({
  lang,
  dict,
  storeId,
  storeName,
  storeSlug,
  state,
}: {
  lang: Locale;
  dict: Dictionary;
  storeId: string;
  storeName: string;
  storeSlug: string | null;
  state: ChecklistState;
}) {
  const t = dict.merchant.checklist;
  const editHref = `/${lang}/merchant/${storeId}/edit`;
  const items: {
    key: keyof ChecklistState;
    label: string;
    href: string | null;
  }[] = [
    { key: "logo", label: t.logo, href: editHref },
    { key: "cover", label: t.cover, href: editHref },
    { key: "description", label: t.description, href: editHref },
    { key: "hours", label: t.hours, href: editHref },
    { key: "whatsapp", label: t.whatsapp, href: editHref },
    {
      key: "products",
      label: t.products,
      href: `/${lang}/merchant/${storeId}/items`,
    },
    { key: "brandColor", label: t.brandColor, href: editHref },
    { key: "customLink", label: t.customLink, href: editHref },
  ];
  const done = items.filter((i) => state[i.key]).length;
  const pct = Math.round((done / items.length) * 100);
  const complete = done === items.length;

  const storePath = `/${lang}/${storeSlug ?? `store/${storeId}`}`;
  const storeUrl = `${SITE_URL}${storePath}`;
  const displayUrl = `matjarlb.com/${storeSlug ?? `store/${storeId}`}`;

  // Store fully set up → celebrate + push the shareable link.
  if (complete) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-5">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-primary" />
          <h2 className="font-extrabold">{t.readyTitle}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t.readySubtitle}</p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span
            dir="ltr"
            className="min-w-0 truncate rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary"
          >
            {displayUrl}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton title={storeName} dict={dict} url={storeUrl} />
            <Link
              href={storePath}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              {t.viewPage}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-extrabold">{t.title}</h2>
        <span className="ms-auto text-sm font-bold text-primary">{pct}%</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const isDone = state[item.key];
          const row = (
            <span className="flex items-center gap-2 text-sm">
              {isDone ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span
                className={
                  isDone
                    ? "text-muted-foreground line-through"
                    : "font-medium"
                }
              >
                {item.label}
              </span>
            </span>
          );
          return (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3"
            >
              {row}
              {!isDone && item.href && (
                <Link
                  href={item.href}
                  className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-surface-muted"
                >
                  {t.fix}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
