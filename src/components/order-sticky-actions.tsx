"use client";

import { MessageCircle, Phone } from "lucide-react";
import { waLink } from "@/lib/phone";

// The one thing a customer wants on an order screen, kept under the thumb.
//
// The actions on this page live in a wrapped row at the very top, so the moment
// someone scrolls to check what they ordered — which is most of the page — the
// way to reach the shop is gone. A late order is exactly when that happens.
//
// Only rendered while the order is still live: once it is completed, cancelled
// or rejected there is no next step to take, and a bar offering one would be
// noise pinned to every screen.
//
// It sits above the customer tab bar rather than over it, and adds the home
// indicator inset on top, so nothing is ever trapped underneath.
export function OrderStickyActions({
  statusLabel,
  nextStep,
  whatsapp,
  phone,
  labels,
}: {
  statusLabel: string;
  /** What the customer should expect now — omitted when there is nothing true
   *  to say, rather than filled with a reassuring guess. */
  nextStep?: string;
  whatsapp: string | null;
  phone: string | null;
  labels: { contact: string; call: string };
}) {
  // Local numbers like 03709064 are not dialable by wa.me without the country
  // code; waLink returns null when there is nothing usable so the button is
  // hidden rather than pointing at a dead page.
  const wa = waLink(whatsapp ?? phone);
  if (!wa && !phone) return null;

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{statusLabel}</p>
          {nextStep && (
            <p className="truncate text-xs text-muted-foreground">{nextStep}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              aria-label={labels.call}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors active:bg-surface-muted"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.97]"
            >
              <MessageCircle className="h-4 w-4" />
              {labels.contact}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
