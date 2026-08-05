"use client";

import { useEffect, useRef, useState } from "react";

// Count-up number that animates once when it scrolls into view. Respects
// reduced-motion (renders the final value immediately). Used by the hero stat
// pills and the stats band.
export function CountUp({
  to,
  suffix = "",
  duration = 1200,
  locale = "en",
  className,
}: {
  to: number;
  suffix?: string;
  duration?: number;
  locale?: "ar" | "en";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || done.current) return;
        done.current = true;
        io.disconnect();
        // Reduced motion still lands on the final number — it just skips the
        // count. Checked here rather than in the effect body so the state write
        // happens in a callback, and so the number appears when it scrolls into
        // view like every other one.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setN(to);
          return;
        }
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min((t - start) / duration, 1);
          // easeOutCubic
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.round(eased * to));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {/* ar-EG renders Arabic-Indic digits (١٢٣). Every price, order id and
          stat elsewhere in the app renders Latin digits, so these counters
          were the only place on the site showing a different numeral system —
          on the home page, directly above prices that disagreed with them.
          The -u-nu-latn extension pins the numbering system explicitly: plain
          "ar" happens to give Latin digits on current ICU, but that is a CLDR
          default that has changed before and is not the same in every
          browser. */}
      {n.toLocaleString(locale === "ar" ? "ar-u-nu-latn" : "en-US")}
      {suffix}
    </span>
  );
}
