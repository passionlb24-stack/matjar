"use client";

import { useEffect, useRef, useState } from "react";

// The merchant's own description of the business.
//
// It renders in full — it always has, and it still does from `lg` up. What
// changed is that on a phone it is no longer allowed to push the thing the
// customer came for below the fold: misk's paragraph measured 161px at 390px
// and the clinic's 89px, both sitting between the identity block and the first
// section a customer can act on.
//
// Clamped to four lines with a control to open it — never truncated away. An
// expander is the whole difference between "shorter" and "hidden".
//
// The clamp is CSS and is present in the very first paint, so nothing jumps.
// The BUTTON is what waits for a measurement: `scrollHeight > clientHeight` on
// an already-clamped paragraph is the one overflow test that is actually true
// when it says it is, so a description that fits in four lines never grows a
// control that would do nothing. With JavaScript off the paragraph is clamped
// and the button never appears — which is why the full text is also in the
// page's own metadata description, not only here.
export function StoreAbout({
  text,
  more,
  less,
}: {
  text: string;
  /** dict.store.readMore */
  more: string;
  /** dict.store.readLess */
  less: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // While open there is no clamp to overflow, so the last answer stands.
    if (open) return;
    const check = () => {
      const el = ref.current;
      if (!el) return;
      setOverflows(el.scrollHeight - el.clientHeight > 2);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, open]);

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p
        ref={ref}
        className={`text-muted-foreground ${
          open ? "" : "line-clamp-4 lg:line-clamp-none"
        }`}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex h-11 items-center text-sm font-bold text-primary lg:hidden"
        >
          {open ? less : more}
        </button>
      )}
    </div>
  );
}
