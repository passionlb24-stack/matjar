"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// The mobile modal primitive.
//
// A dialog anchored to the bottom edge is the only modal shape a thumb can
// reach on a 6-inch phone; a centred box puts its close button and its actions
// where the hand is not. Everything that needs a temporary surface — filters,
// sort, variants, modifiers, quick actions — uses this rather than inventing
// its own overlay.
//
// Accessibility is not optional here because a sheet traps the screen: it takes
// focus, returns it on close, closes on Escape and on backdrop press, and
// announces itself as a modal dialog. Body scroll is locked while open, or the
// page behind scrolls under the user's finger.
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Sticky action row — "apply", "clear", etc. */
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    panel?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      // Keep Tab inside the sheet — behind it the page is inert to the eye but
      // not to the keyboard unless we say so.
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] lg:hidden">
      <button
        type="button"
        aria-label={title}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-sheet absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl outline-none"
      >
        {/* Drag handle: purely a signal that this surface came from the bottom
            and goes back there. Decorative, so hidden from the a11y tree. */}
        <span
          aria-hidden
          className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border"
        />

        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
          <h2 className="text-h4">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={title}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-border bg-surface p-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
