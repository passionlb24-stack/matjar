import Link from "next/link";
import {
  Sparkles,
  PackagePlus,
  ListChecks,
  Boxes,
  Megaphone,
  Zap,
  ChevronLeft,
} from "lucide-react";
import { WidgetCard } from "./widget-card";

// ===== OS dashboard — SuggestionsCard =====
// اقتراحات ذكية: rule-based, computed from data the page already has — never
// invented. Max 3, each with a single obvious CTA. If nothing genuinely
// helpful applies, the page hides the card entirely (no filler advice).

export type SuggestionRow = {
  key: "addItem" | "checklist" | "restock" | "campaign" | "automation";
  text: string;
  cta: string;
  href: string;
};

const KEY_ICON: Record<SuggestionRow["key"], typeof Sparkles> = {
  addItem: PackagePlus,
  checklist: ListChecks,
  restock: Boxes,
  campaign: Megaphone,
  automation: Zap,
};

export function SuggestionsCard({
  title,
  suggestions,
}: {
  title: string;
  suggestions: SuggestionRow[];
}) {
  return (
    <WidgetCard title={title} Icon={Sparkles}>
      <ul className="space-y-2">
        {suggestions.map((s) => {
          const Icon = KEY_ICON[s.key];
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                className="group flex items-center gap-3 rounded-xl border border-dashed border-primary/25 bg-primary-soft/30 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-primary shadow-xs">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                  {s.text}
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-primary">
                  {s.cta}
                  <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
