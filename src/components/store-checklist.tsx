import Link from "next/link";
import { Check, Circle, Sparkles } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export type ChecklistState = {
  logo: boolean;
  cover: boolean;
  description: boolean;
  hours: boolean;
  whatsapp: boolean;
  products: boolean;
};

// Onboarding nudge shown on the OS home until the store is fully set up.
// Profile items deep-link to the edit page; "products" links to the items page.
export function StoreChecklist({
  lang,
  dict,
  storeId,
  state,
}: {
  lang: Locale;
  dict: Dictionary;
  storeId: string;
  state: ChecklistState;
}) {
  const t = dict.merchant.checklist;
  const editHref = `/${lang}/merchant/${storeId}/edit`;
  const items: { key: keyof ChecklistState; label: string; href: string | null }[] = [
    { key: "logo", label: t.logo, href: editHref },
    { key: "cover", label: t.cover, href: editHref },
    { key: "description", label: t.description, href: editHref },
    { key: "hours", label: t.hours, href: editHref },
    { key: "whatsapp", label: t.whatsapp, href: editHref },
    { key: "products", label: t.products, href: `/${lang}/merchant/${storeId}/items` },
  ];
  const done = items.filter((i) => state[i.key]).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-extrabold">{t.title}</h2>
        <span className="ms-auto text-sm font-bold text-primary">{pct}%</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
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
              <span className={isDone ? "text-muted-foreground line-through" : "font-medium"}>
                {item.label}
              </span>
            </span>
          );
          return (
            <li key={item.key} className="flex items-center justify-between gap-3">
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
