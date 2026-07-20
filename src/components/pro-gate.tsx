import Link from "next/link";
import { Crown, Lock, Check } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

// Upsell shown in place of a Pro-only module when a free store opens it. Also
// used inline when the free product limit is hit (compact variant).
export function ProGate({
  lang,
  dict,
  storeId,
  title,
  body,
  compact = false,
}: {
  lang: string;
  dict: Dictionary;
  storeId: string;
  title?: string;
  body?: string;
  compact?: boolean;
}) {
  const t = dict.os.pro;
  const card = (
    <div className="mx-auto max-w-lg rounded-3xl border border-accent/40 bg-gradient-to-b from-accent-soft to-transparent p-7 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-foreground">
        {compact ? <Lock className="h-7 w-7" /> : <Crown className="h-7 w-7" />}
      </span>
      <h2 className="mt-4 text-xl font-extrabold tracking-tight">
        {title ?? t.lockedTitle}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {body ?? t.lockedBody}
      </p>

      <ul className="mx-auto mt-5 max-w-xs space-y-2 text-start">
        {t.benefits.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm font-medium">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            {b}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Link
          href={`/${lang}/merchant/${storeId}/subscription`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-amber-600"
        >
          <Crown className="h-4 w-4" />
          {t.upgrade}
        </Link>
        <p className="mt-2 text-xs font-bold text-warning">
          {t.perMonth} · {t.perYear}
        </p>
      </div>
    </div>
  );

  if (compact) return card;

  return (
    <div className="py-12">
      <Container>{card}</Container>
    </div>
  );
}
