import { ChevronLeft, ChevronRight } from "lucide-react";

// Chevrons that mean a *direction of travel*, not a side of the screen.
//
// "Next" in Arabic points LEFT. A bare <ChevronRight/> is therefore wrong on
// every Arabic screen, and the app is Arabic-first — so the only safe way to
// spell "forward" is a component that resolves the arrow from the document
// rather than from whoever is writing the JSX.
//
// The resolution is CSS, not JavaScript: `rtl:` compiles to
// `&:where(:dir(rtl), [dir="rtl"] *)`, and `:dir()` reads the *computed*
// direction of the element. That means these render identically on the server
// and the client, need no `dir` prop, no locale lookup, no hook, and no
// hydration pass — and they stay correct if a subtree is ever rendered in the
// other direction (an LTR phone number block inside an Arabic page, say).
//
// Callers pick by MEANING:
//   <ChevronNext/> — forward, drill in, "see all", breadcrumb separator, later
//   <ChevronPrev/> — back, up a level, earlier
// Never by side. If you find yourself reaching for lucide's ChevronRight
// directly to express "next", that is the bug this file exists to prevent.
//
// The default h-4 w-4 matches the size the 70-odd hand-rolled copies used;
// pass a className to override it (sizes compose, the rotation is separate).
//
// Not covered here on purpose: two call sites (os-dashboard/alerts-card and
// suggestions-card) animate the chevron with a hover translate on the same
// element. Rotation and translation share one `transform`, so a 180° flip also
// mirrors the slide; those two spell the composition out by hand and are left
// alone rather than given a prop nothing else would use.

type Props = {
  className?: string;
  /** Marks the icon as meaningful rather than decorative. */
  "aria-hidden"?: boolean;
};

/** Forward / next / drill-in. Points right in English, left in Arabic. */
export function ChevronNext({ className = "h-4 w-4", ...props }: Props) {
  return <ChevronRight className={`rtl:rotate-180 ${className}`} {...props} />;
}

/** Back / previous / up a level. Points left in English, right in Arabic. */
export function ChevronPrev({ className = "h-4 w-4", ...props }: Props) {
  return <ChevronLeft className={`rtl:rotate-180 ${className}`} {...props} />;
}
