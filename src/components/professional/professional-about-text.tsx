"use client";

import { useEffect, useRef, useState } from "react";

// The clamped paragraph behind ProfessionalAbout. Internal to this folder —
// import ProfessionalAbout, not this.
//
// Behaviour is deliberately identical to components/store/store-about.tsx, and
// this is a copy of its mechanism rather than a second idea about how a long
// description should behave. The reasoning there holds here for the same
// reason: on a phone a bio is the block sitting between the identity and the
// first thing a customer can act on, and from `lg` up there is no fold to push
// anything below.
//
//   · The clamp is CSS and is in the first paint, so nothing jumps.
//   · The BUTTON waits for a measurement — `scrollHeight > clientHeight` on an
//     already-clamped paragraph is the one overflow test that is true when it
//     says it is, so a two-line bio never grows a control that would do
//     nothing.
//   · With JavaScript off the paragraph stays clamped and no button appears.
//     An expander is the difference between "shorter" and "hidden", so a route
//     that renders this should keep the full text in the page metadata as the
//     storefront does.
//
// Only the two labels cross the boundary, never a dictionary slice.
export function ProfessionalAboutText({
  text,
  more,
  less,
}: {
  text: string;
  more: string;
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
    <>
      <p
        ref={ref}
        dir="auto"
        className={`leading-relaxed text-muted-foreground ${
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
    </>
  );
}
